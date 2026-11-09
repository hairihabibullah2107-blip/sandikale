import { User } from '../../types';
import { Backend, BackendError, RemoteEvent, TableName, WriteOptions } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Pemetaan tabel aplikasi -> tabel Supabase. Kolom penting dibuat relasional,
// sisanya disimpan utuh di kolom `data` (jsonb).
interface TableMap {
  db: string;
  order: { col: string; asc: boolean }[];
  toRow: (item: any) => Record<string, unknown>;
  fromRow: (row: any) => any;
}

const TABLES: Record<TableName, TableMap> = {
  products: {
    db: 'products',
    order: [{ col: 'name', asc: true }, { col: 'id', asc: true }],
    toRow: (p) => ({
      id: p.id,
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
      name: p.name,
      category: p.category ?? null,
      cost_price: p.costPrice ?? 0,
      selling_price: p.sellingPrice ?? 0,
      stock: p.stock ?? 0,
      min_stock: p.minStock ?? 0,
      data: p,
    }),
    fromRow: (r) => ({ ...(r.data || {}), id: r.id, stock: r.stock }),
  },
  orders: {
    db: 'orders',
    order: [{ col: 'created_at', asc: false }, { col: 'id', asc: true }],
    toRow: (o) => ({
      id: o.id,
      invoice_number: o.invoiceNumber ?? null,
      status: o.status,
      shift_id: o.shiftId ?? null,
      customer_name: o.customerName ?? null,
      grand_total: o.grandTotal ?? 0,
      data: o,
    }),
    fromRow: (r) => ({ ...(r.data || {}), id: r.id }),
  },
  shifts: {
    db: 'shifts',
    order: [{ col: 'created_at', asc: false }, { col: 'id', asc: true }],
    toRow: (s) => ({
      id: s.id,
      cashier_id: s.cashierId ?? undefined,
      shift_number: s.shiftNumber ?? null,
      status: s.status,
      data: s,
    }),
    fromRow: (r) => ({ ...(r.data || {}), id: r.id, status: r.status }),
  },
  users: {
    db: 'profiles',
    order: [{ col: 'created_at', asc: true }, { col: 'id', asc: true }],
    toRow: (u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      phone: u.phone ?? null,
      avatar: u.avatar ?? null,
      active: u.active ?? true,
    }),
    fromRow: (r) => ({
      id: r.id,
      username: r.username,
      name: r.name,
      role: r.role,
      phone: r.phone ?? undefined,
      avatar: r.avatar ?? undefined,
      active: r.active,
      pin: '',
    }),
  },
  settings: {
    db: 'store_settings',
    order: [{ col: 'id', asc: true }],
    toRow: ({ id: _id, ...rest }) => ({ id: 1, data: rest }),
    fromRow: (r) => ({ ...(r.data || {}), id: String(r.id) }),
  },
};

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase().replace(/\\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
}
const toEmail = (username: string) => `${normalizeUsername(username)}@sandikale.id`;

// Akun admin pertama sudah terdaftar di Supabase Auth memakai Gmail.
// Username aplikasi tetap "hairi"; akun baru lainnya tetap memakai domain internal.
const toLoginEmail = (username: string) =>
  normalizeUsername(username) === 'hairi'
    ? 'hairihabibullah2107@gmail.com'
    : toEmail(username);

function toError(err: any): BackendError {
  const code = String(err?.code ?? '');
  const msg = String(err?.message ?? err ?? 'Kesalahan tidak dikenal');
  const permission =
    ['42501', 'PGRST301', '401', '403'].includes(code) || /row-level security|permission denied|not authorized/i.test(msg);
  const conflict = code === '23505' || /duplicate key/i.test(msg);
  return new BackendError(msg, { permission, conflict });
}

export interface CloudAuth {
  getSession(): Promise<User | null>;
  signIn(username: string, pin: string): Promise<{ user?: User; error?: string }>;
  signOut(): Promise<void>;
  onAuthChange(cb: (signedIn: boolean) => void): () => void;
  createUser(u: { username: string; pin: string; name: string; role: string; phone?: string }): Promise<{ id?: string; error?: string }>;
  changeOwnPin(oldPin: string, newPin: string): Promise<{ error?: string }>;
  adminSetPin(userId: string, pin: string): Promise<{ error?: string }>;
  deleteUser(userId: string): Promise<{ error?: string }>;
  verifyAdminPin(pin: string): Promise<boolean>;
  updateMyProfile(p: { name: string; phone?: string; avatar?: string }): Promise<{ error?: string }>;
}

export type CloudBackend = Backend & { auth: CloudAuth };

export async function createSupabaseBackend(url: string, anonKey: string): Promise<CloudBackend> {
  const { createClient } = await import('@supabase/supabase-js');
  const client: any = createClient(url, anonKey, {
    // Sesi disimpan per-tab (sessionStorage): membuka aplikasi dari awal selalu meminta login.
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'sandikale-auth',
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem('sandikale-auth'); // sisa sesi permanen lama
  } catch {
    /* abaikan */
  }
  const connCbs = new Set<(online: boolean) => void>();
  const notifyConn = (online: boolean) => connCbs.forEach((cb) => cb(online));
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => notifyConn(true));
    window.addEventListener('offline', () => notifyConn(false));
  }

  async function loadProfile(id: string): Promise<User | null> {
    const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return TABLES.users.fromRow(data) as User;
  }

  const auth: CloudAuth = {
    async getSession() {
      const { data } = await client.auth.getSession();
      const uid = data?.session?.user?.id;
      if (!uid) return null;
      const p = await loadProfile(uid);
      return p && p.active !== false ? p : null;
    },
    async signIn(username, pin) {
      const { data, error } = await client.auth.signInWithPassword({ email: toLoginEmail(username), password: pin });
      if (error || !data?.user) {
        return { error: /invalid login/i.test(error?.message || '') ? 'Username atau PIN tidak sesuai.' : error?.message || 'Gagal masuk.' };
      }
      const profile = await loadProfile(data.user.id);
      if (!profile) {
        await client.auth.signOut();
        return { error: 'Profil pengguna tidak ditemukan.' };
      }
      if (profile.active === false) {
        await client.auth.signOut();
        return { error: 'Akun belum diaktifkan oleh admin.' };
      }
      return { user: profile };
    },
    async signOut() {
      await client.auth.signOut();
    },
    onAuthChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event: string, session: any) => cb(!!session));
      return () => data?.subscription?.unsubscribe?.();
    },
    async createUser(u) {
      // Pembuatan akun staf dilakukan server-side agar email konfirmasi tidak
      // menghalangi login dan sesi admin yang sedang aktif tidak tertimpa.
      if (u.role !== 'kasir') {
        return { error: 'Pembuatan akun melalui fungsi ini saat ini hanya mendukung role kasir.' };
      }
      const { data, error } = await client.functions.invoke('create-staff', {
        body: {
          username: normalizeUsername(u.username),
          pin: u.pin,
          name: u.name,
          phone: u.phone ?? null,
        },
      });
      if (error) {
        const details = (error as any)?.context;
        let message = error.message || 'Gagal membuat akun kasir.';
        if (details && typeof details.json === 'function') {
          try {
            const payload = await details.json();
            if (payload?.error) message = payload.error;
          } catch {
            // Gunakan pesan bawaan jika respons bukan JSON.
          }
        }
        return { error: message };
      }
      if (!data?.id) return { error: data?.error || 'Server tidak mengembalikan ID akun baru.' };
      return { id: data.id };
    },
    async changeOwnPin(oldPin, newPin) {
      const { error } = await client.rpc('change_my_pin', { p_old: oldPin, p_new: newPin });
      return error ? { error: error.message } : {};
    },
    async adminSetPin(userId, pin) {
      const { error } = await client.rpc('admin_set_user_pin', { p_user: userId, p_new: pin });
      return error ? { error: error.message } : {};
    },
    async deleteUser(userId) {
      const { error } = await client.rpc('admin_delete_user', { p_user: userId });
      return error ? { error: error.message } : {};
    },
    async verifyAdminPin(pin) {
      const { data, error } = await client.rpc('verify_admin_pin', { p_pin: pin });
      return !error && data === true;
    },
    async updateMyProfile(p) {
      const { error } = await client.rpc('update_my_profile', {
        p_name: p.name,
        p_phone: p.phone ?? null,
        p_avatar: p.avatar ?? null,
      });
      return error ? { error: error.message } : {};
    },
  };

  const backend: CloudBackend = {
    kind: 'supabase',
    auth,

    async fetchAll<T>(table: TableName): Promise<T[]> {
      const m = TABLES[table];
      const out: T[] = [];
      for (let from = 0; ; from += 1000) {
        let q = client.from(m.db).select('*');
        for (const o of m.order) q = q.order(o.col, { ascending: o.asc });
        const { data, error } = await q.range(from, from + 999);
        if (error) throw toError(error);
        for (const row of data || []) out.push(m.fromRow(row));
        if (!data || data.length < 1000) break;
      }
      return out;
    },

    async upsert<T extends { id: string }>(table: TableName, items: T[], opts?: WriteOptions) {
      const m = TABLES[table];
      if (table === 'users') {
        // Profil hanya bisa diubah (dibuat lewat Auth).
        for (const u of items as any[]) {
          const row: any = m.toRow(u);
          const { id, ...rest } = row;
          const { error } = await client.from('profiles').update(rest).eq('id', id);
          if (error) throw toError(error);
        }
        return;
      }
      for (let i = 0; i < items.length; i += 100) {
        const rows = items.slice(i, i + 100).map((it) => {
          const row = m.toRow(it);
          if (opts?.excludeFields) for (const f of opts.excludeFields) delete row[f];
          for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
          return row;
        });
        const { error } = await client.from(m.db).upsert(rows, { onConflict: 'id' });
        if (error) throw toError(error);
      }
    },

    async remove(table: TableName, ids: string[]) {
      if (table === 'users') {
        for (const id of ids) {
          const { error } = await client.rpc('admin_delete_user', { p_user: id });
          if (error) throw toError(error);
        }
        return;
      }
      const m = TABLES[table];
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await client.from(m.db).delete().in('id', ids.slice(i, i + 100));
        if (error) throw toError(error);
      }
    },

    async adjustStock(id: string, delta: number) {
      const { data, error } = await client.rpc('adjust_stock', { p_id: id, p_delta: delta });
      if (error) throw toError(error);
      return Number(data);
    },

    subscribe<T>(table: TableName, handler: (e: RemoteEvent<T>) => void) {
      const m = TABLES[table];
      const ch = client
        .channel(`rt-${m.db}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: m.db }, (payload: any) => {
          if (payload.eventType === 'DELETE') handler({ type: 'delete', id: String(payload.old?.id) });
          else handler({ type: 'upsert', item: m.fromRow(payload.new) as T });
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') notifyConn(true);
          else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) notifyConn(false);
        });
      return () => {
        client.removeChannel(ch);
      };
    },

    onConnection(cb) {
      connCbs.add(cb);
      cb(typeof navigator === 'undefined' ? true : navigator.onLine);
      return () => connCbs.delete(cb);
    },
  };
  return backend;
}
