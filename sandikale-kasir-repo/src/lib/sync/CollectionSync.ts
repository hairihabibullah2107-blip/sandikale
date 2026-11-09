import { Backend, BackendError, RemoteEvent, TableName } from '../backend/types';
import { canonical } from './canonical';

type Item = { id: string };
export type SyncPhase = 'idle' | 'syncing' | 'error';

export interface CollectionSyncOptions<T extends Item> {
  table: TableName;
  backend: Backend;
  getState: () => T[];
  setState: (updater: (prev: T[]) => T[]) => void;
  /** Produk: kolom `stock` diubah lewat adjustStock (delta), bukan ditimpa. */
  stockField?: boolean;
  /** Boleh mengirim perubahan lokal ke server? (mis. hanya admin untuk produk). */
  canPush?: () => boolean;
  /** Isi server dari data lokal bila server kosong (mode lokal / admin saat pertama kali). */
  seedWhenEmpty?: () => boolean;
  /** Anggap tabel kosong (0 baris) juga perlu diisi; bila false hanya tabel yang belum pernah dibuat (null). */
  seedOnEmptyRows?: boolean;
  /** Posisi item baru dari perangkat lain. */
  insertAt?: 'start' | 'end';
  onPhase?: (phase: SyncPhase, err?: Error) => void;
  onRemote?: (e: RemoteEvent<T>) => void;
  debounceMs?: number;
  retryMs?: number;
}

/**
 * Mesin sinkron satu koleksi (daftar item ber-id).
 * - hydrate(): ambil dari server -> menjadi sumber kebenaran.
 * - schedulePush(): kirim selisih (upsert/hapus/delta stok) ke server.
 * - applyRemote(): terapkan perubahan dari perangkat lain (abaikan gema perubahan sendiri).
 * - Jika server menolak karena izin, state dipulihkan dari server (rollback).
 */
export class CollectionSync<T extends Item> {
  private synced = new Map<string, string>();
  private stockSynced = new Map<string, number>();
  private inflight = new Set<string>(); // stok yang sedang dikirim (gema tulisan sendiri jangan dihitung dua kali)
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private again = false;
  private unsub: (() => void) | null = null;
  private stopped = false;
  hydrated = false;

  constructor(private o: CollectionSyncOptions<T>) {}

  private strip(item: T): string {
    if (this.o.stockField) {
      const { stock: _stock, ...rest } = item as any;
      return canonical(rest);
    }
    return canonical(item);
  }

  private rebuild(items: T[]) {
    this.synced.clear();
    this.stockSynced.clear();
    for (const it of items) {
      this.synced.set(it.id, this.strip(it));
      if (this.o.stockField) this.stockSynced.set(it.id, Number((it as any).stock) || 0);
    }
  }

  async hydrate(): Promise<void> {
    this.o.onPhase?.('syncing');
    const rows = await this.o.backend.fetchAll<T>(this.o.table);
    const local = this.o.getState();
    const needsSeed = rows === null || (!!this.o.seedOnEmptyRows && rows.length === 0);
    if (needsSeed && this.o.seedWhenEmpty?.() && local.length > 0) {
      await this.o.backend.upsert(this.o.table, local);
      this.rebuild(local);
    } else {
      const list = rows ?? [];
      this.o.setState(() => list);
      this.rebuild(list);
    }
    this.hydrated = true;
    this.o.onPhase?.('idle');
  }

  start() {
    this.stopped = false;
    this.unsub?.();
    this.unsub = this.o.backend.subscribe<T>(this.o.table, (e) => this.applyRemote(e));
  }

  stop() {
    this.stopped = true;
    this.unsub?.();
    this.unsub = null;
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  /** Ambil ulang dari server (setelah koneksi pulih / tab aktif kembali / rollback). */
  async resync(): Promise<void> {
    try {
      await this.hydrate();
    } catch (err) {
      this.o.onPhase?.('error', err as Error);
      this.scheduleRetry(() => this.resync());
    }
  }

  applyRemote(e: RemoteEvent<T>) {
    if (this.stopped) return;
    if (e.type === 'delete' && e.id) {
      this.synced.delete(e.id);
      this.stockSynced.delete(e.id);
      this.o.setState((prev) => prev.filter((x) => x.id !== e.id));
      this.o.onRemote?.(e);
      return;
    }
    if (e.type !== 'upsert' || !e.item) return;
    let item = e.item;
    const id = item.id;
    const h = this.strip(item);
    const stockNow = this.o.stockField ? Number((item as any).stock) || 0 : 0;
    const sending = !!this.o.stockField && this.inflight.has(id);
    // Gema dari tulisan sendiri: abaikan.
    if (this.synced.get(id) === h && (sending || !this.o.stockField || this.stockSynced.get(id) === stockNow)) return;

    this.synced.set(id, h);
    if (this.o.stockField) {
      const local = this.o.getState().find((x) => x.id === id);
      if (sending && local) {
        // Selagi stok dikirim, angka stok dari server diabaikan; jawaban pengiriman yang menjadi acuan.
        item = { ...(item as any), stock: (local as any).stock };
      } else {
        const prevSynced = this.stockSynced.get(id);
        // Pertahankan perubahan stok lokal yang belum terkirim.
        const pending = local && prevSynced !== undefined ? Number((local as any).stock) - prevSynced : 0;
        this.stockSynced.set(id, stockNow);
        if (pending !== 0) item = { ...(item as any), stock: stockNow + pending };
      }
    }
    const at = this.o.insertAt ?? 'start';
    this.o.setState((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = item;
        return next;
      }
      return at === 'start' ? [item, ...prev] : [...prev, item];
    });
    this.o.onRemote?.({ type: 'upsert', item });
  }

  /** Dipanggil setiap state berubah. */
  schedulePush() {
    if (!this.hydrated || this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.o.debounceMs ?? 250);
  }

  hasPending(): boolean {
    const state = this.o.getState();
    const ids = new Set<string>();
    for (const it of state) {
      ids.add(it.id);
      if (this.synced.get(it.id) !== this.strip(it)) return true;
      if (this.o.stockField && this.stockSynced.get(it.id) !== (Number((it as any).stock) || 0)) return true;
    }
    for (const id of this.synced.keys()) if (!ids.has(id)) return true;
    return false;
  }

  private scheduleRetry(fn: () => void) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.stopped) return;
    this.retryTimer = setTimeout(fn, this.o.retryMs ?? 15000);
  }

  async flush(): Promise<void> {
    if (this.stopped || !this.hydrated) return;
    if (this.o.canPush && !this.o.canPush()) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.flushOnce();
      } while (this.again && !this.stopped);
      this.o.onPhase?.('idle');
    } catch (err) {
      const e = err as BackendError;
      this.o.onPhase?.('error', e);
      if (e && (e.permission || e.conflict)) {
        // Ditolak server (izin/duplikat): pulihkan tampilan dari server.
        await this.resync();
      } else {
        this.scheduleRetry(() => this.flush());
      }
    } finally {
      this.running = false;
    }
  }

  private async flushOnce() {
    const state = this.o.getState();
    const ids = new Set(state.map((i) => i.id));
    const toInsert: T[] = [];
    const toUpdate: T[] = [];
    const deltas: { id: string; delta: number; sent: number }[] = [];

    for (const it of state) {
      const known = this.synced.has(it.id);
      if (!known) {
        toInsert.push(it);
        continue;
      }
      if (this.synced.get(it.id) !== this.strip(it)) toUpdate.push(it);
      if (this.o.stockField) {
        const ss = this.stockSynced.get(it.id);
        const s = Number((it as any).stock) || 0;
        if (ss !== undefined && s !== ss) deltas.push({ id: it.id, delta: s - ss, sent: s });
      }
    }
    const removed = [...this.synced.keys()].filter((id) => !ids.has(id));
    if (!toInsert.length && !toUpdate.length && !deltas.length && !removed.length) return;

    this.o.onPhase?.('syncing');
    if (toInsert.length) {
      await this.o.backend.upsert(this.o.table, toInsert);
      for (const it of toInsert) {
        this.synced.set(it.id, this.strip(it));
        if (this.o.stockField) this.stockSynced.set(it.id, Number((it as any).stock) || 0);
      }
    }
    if (toUpdate.length) {
      await this.o.backend.upsert(this.o.table, toUpdate, this.o.stockField ? { excludeFields: ['stock'] } : undefined);
      for (const it of toUpdate) this.synced.set(it.id, this.strip(it));
    }
    for (const d of deltas) {
      this.inflight.add(d.id);
      let serverStock: number;
      try {
        serverStock = await this.o.backend.adjustStock(d.id, d.delta);
      } finally {
        this.inflight.delete(d.id);
      }
      this.stockSynced.set(d.id, serverStock);
      const local = this.o.getState().find((x) => x.id === d.id);
      if (local) {
        const localNow = Number((local as any).stock) || 0;
        // Angka server = stok awal + perubahan semua perangkat. Tambahkan perubahan lokal setelah pengiriman.
        const next = serverStock + (localNow - d.sent);
        if (next !== localNow) {
          this.o.setState((prev) => prev.map((x) => (x.id === d.id ? ({ ...(x as any), stock: next } as T) : x)));
        }
      }
    }
    if (removed.length) {
      await this.o.backend.remove(this.o.table, removed);
      for (const id of removed) {
        this.synced.delete(id);
        this.stockSynced.delete(id);
      }
    }
    // Ada perubahan baru selagi mengirim? jalankan lagi.
    if (this.hasPending()) this.again = true;
  }
}
