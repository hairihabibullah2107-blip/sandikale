import { Backend, RemoteEvent, TableName, WriteOptions } from './types';

// Mode lokal: data di localStorage + pemberitahuan antar-tab lewat BroadcastChannel.
// Berfungsi sebagai "database" sehingga dua tab/jendela di perangkat yang sama saling sinkron.
const PREFIX = 'sandikale_db_v1_';
const CHANNEL = 'sandikale-db';

type Msg = { table: TableName; upserts: any[]; deletes: string[]; from: string };

export class MemoryBackend implements Backend {
  kind = 'memory' as const;
  private id = Math.random().toString(36).slice(2);
  private bc: BroadcastChannel | null = null;
  private handlers = new Map<TableName, Set<(e: RemoteEvent<any>) => void>>();
  private connCbs = new Set<(online: boolean) => void>();

  constructor() {
    try {
      this.bc = new BroadcastChannel(CHANNEL);
      this.bc.onmessage = (ev: MessageEvent<Msg>) => {
        const m = ev.data;
        if (!m || m.from === this.id) return;
        const hs = this.handlers.get(m.table);
        if (!hs) return;
        m.upserts.forEach((item) => hs.forEach((h) => h({ type: 'upsert', item })));
        m.deletes.forEach((id) => hs.forEach((h) => h({ type: 'delete', id })));
      };
    } catch {
      this.bc = null;
    }
  }

  private read(table: TableName): any[] | null {
    try {
      const raw = localStorage.getItem(PREFIX + table);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private write(table: TableName, rows: any[]) {
    try {
      localStorage.setItem(PREFIX + table, JSON.stringify(rows));
    } catch (e) {
      console.warn('Gagal menyimpan basis data lokal', e);
    }
  }

  private emit(table: TableName, upserts: any[], deletes: string[]) {
    this.bc?.postMessage({ table, upserts, deletes, from: this.id } as Msg);
  }

  async fetchAll<T>(table: TableName): Promise<T[] | null> {
    return this.read(table) as T[] | null;
  }

  async upsert<T extends { id: string }>(table: TableName, items: T[], opts?: WriteOptions): Promise<void> {
    const rows = this.read(table) ?? [];
    const idx = new Map(rows.map((r, i) => [r.id, i] as const));
    const out: any[] = [];
    for (const it of items) {
      const i = idx.get(it.id);
      let item: any = it;
      if (i !== undefined) {
        const old = rows[i];
        if (opts?.excludeFields) for (const f of opts.excludeFields) item = { ...item, [f]: old[f] };
        rows[i] = item;
      } else {
        idx.set(it.id, rows.length);
        rows.push(item);
      }
      out.push(item);
    }
    this.write(table, rows);
    this.emit(table, out, []);
  }

  async remove(table: TableName, ids: string[]): Promise<void> {
    const set = new Set(ids);
    this.write(table, (this.read(table) ?? []).filter((r) => !set.has(r.id)));
    this.emit(table, [], ids);
  }

  async adjustStock(id: string, delta: number): Promise<number> {
    const rows = this.read('products') ?? [];
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error('Produk tidak ditemukan');
    const next = { ...rows[i], stock: (Number(rows[i].stock) || 0) + delta };
    rows[i] = next;
    this.write('products', rows);
    this.emit('products', [next], []);
    return next.stock;
  }

  subscribe<T>(table: TableName, handler: (e: RemoteEvent<T>) => void): () => void {
    if (!this.handlers.has(table)) this.handlers.set(table, new Set());
    this.handlers.get(table)!.add(handler);
    return () => this.handlers.get(table)?.delete(handler);
  }

  onConnection(cb: (online: boolean) => void): () => void {
    this.connCbs.add(cb);
    cb(true);
    return () => this.connCbs.delete(cb);
  }
}
