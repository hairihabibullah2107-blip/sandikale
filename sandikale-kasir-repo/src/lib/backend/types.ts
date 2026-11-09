export type TableName = 'products' | 'orders' | 'shifts' | 'users' | 'settings';

export interface RemoteEvent<T> {
  type: 'upsert' | 'delete';
  item?: T;
  id?: string;
}

export interface WriteOptions {
  /** Kolom yang tidak boleh ditimpa saat upsert (mis. stok, yang diubah lewat adjustStock). */
  excludeFields?: string[];
}

/** Kesalahan penyimpanan yang sudah dinormalisasi. */
export class BackendError extends Error {
  permission: boolean;
  conflict: boolean;
  constructor(message: string, opts: { permission?: boolean; conflict?: boolean } = {}) {
    super(message);
    this.name = 'BackendError';
    this.permission = !!opts.permission;
    this.conflict = !!opts.conflict;
  }
}

export interface Backend {
  kind: 'memory' | 'supabase';
  /** Semua baris tabel. `null` = tabel belum pernah diisi (hanya mode lokal). */
  fetchAll<T>(table: TableName): Promise<T[] | null>;
  upsert<T extends { id: string }>(table: TableName, items: T[], opts?: WriteOptions): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
  /** Ubah stok secara atomik; mengembalikan stok terbaru di server. */
  adjustStock(id: string, delta: number): Promise<number>;
  subscribe<T>(table: TableName, handler: (e: RemoteEvent<T>) => void): () => void;
  /** Status koneksi realtime (true = tersambung). */
  onConnection(cb: (online: boolean) => void): () => void;
}
