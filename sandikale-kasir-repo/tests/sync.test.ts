// Uji mesin sinkron dengan server tiruan (tanpa jaringan). Jalankan: npx tsx tests/sync.test.ts
import { CollectionSync } from '../src/lib/sync/CollectionSync';
import { Backend, BackendError, RemoteEvent, TableName } from '../src/lib/backend/types';

type Item = { id: string; [k: string]: any };

class FakeServer {
  tables: Record<string, Map<string, Item>> = {};
  subs: { table: string; h: (e: RemoteEvent<any>) => void }[] = [];
  upserts = 0;
  table(t: string) { return (this.tables[t] ||= new Map()); }
  emit(table: string, e: RemoteEvent<any>) {
    for (const s of this.subs) if (s.table === table) queueMicrotask(() => s.h(JSON.parse(JSON.stringify(e))));
  }
}

class FakeBackend implements Backend {
  kind = 'supabase' as const;
  failNext = 0;
  constructor(private s: FakeServer, public role: 'admin' | 'kasir') {}
  private maybeFail() { if (this.failNext > 0) { this.failNext--; throw new Error('Failed to fetch'); } }
  async fetchAll<T>(t: TableName) { this.maybeFail(); const m = this.s.table(t); return [...m.values()].map((x) => ({ ...x })) as T[]; }
  async upsert<T extends { id: string }>(t: TableName, items: T[], opts?: { excludeFields?: string[] }) {
    this.maybeFail();
    if (this.role !== 'admin') throw new BackendError('row-level security', { permission: true });
    this.s.upserts++;
    for (const it of items) {
      const old = this.s.table(t).get(it.id);
      let n: any = { ...it };
      if (old && opts?.excludeFields) for (const f of opts.excludeFields) n[f] = old[f];
      this.s.table(t).set(it.id, n);
      this.s.emit(t, { type: 'upsert', item: n });
    }
  }
  async remove(t: TableName, ids: string[]) {
    this.maybeFail();
    if (this.role !== 'admin') throw new BackendError('row-level security', { permission: true });
    for (const id of ids) { this.s.table(t).delete(id); this.s.emit(t, { type: 'delete', id }); }
  }
  async adjustStock(id: string, d: number) {
    this.maybeFail();
    const p = this.s.table('products').get(id)!;
    p.stock += d;
    this.s.emit('products', { type: 'upsert', item: { ...p } });
    return p.stock;
  }
  subscribe<T>(t: TableName, h: (e: RemoteEvent<T>) => void) { const o = { table: t, h }; this.s.subs.push(o); return () => { this.s.subs = this.s.subs.filter((x) => x !== o); }; }
  onConnection(cb: (o: boolean) => void) { cb(true); return () => {}; }
}

function client(server: FakeServer, role: 'admin' | 'kasir', table: TableName, initial: Item[], opts: any = {}) {
  const box = { state: initial };
  const be = new FakeBackend(server, role);
  const eng = new CollectionSync<Item>({
    table, backend: be, getState: () => box.state, setState: (u) => { box.state = u(box.state); },
    debounceMs: 5, retryMs: 30, stockField: table === 'products', ...opts,
  });
  const edit = (fn: (s: Item[]) => Item[]) => { box.state = fn(box.state); eng.schedulePush(); };
  return { box, be, eng, edit };
}
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
setTimeout(() => { console.log('TIMEOUT (kemungkinan loop tak berujung)'); process.exit(2); }, 20000).unref?.();
function ok(cond: boolean, name: string, extra = '') { if (cond) { pass++; console.log('  OK   ' + name); } else { fail++; console.log('  GAGAL ' + name + ' ' + extra); } }

(async () => {
  console.log('1. Hydrate & seed');
  const s1 = new FakeServer();
  const A = client(s1, 'admin', 'products', [{ id: 'p1', name: 'Kaos', price: 100, stock: 10 }], { seedWhenEmpty: () => true, seedOnEmptyRows: true });
  await A.eng.hydrate(); A.eng.start();
  ok(s1.table('products').size === 1, 'server terisi dari data lokal admin');
  const B = client(s1, 'kasir', 'products', []);
  await B.eng.hydrate(); B.eng.start();
  ok(B.box.state.length === 1 && B.box.state[0].name === 'Kaos', 'kasir menerima data dari server');

  console.log('2. Perubahan admin langsung sampai ke kasir');
  const before = s1.upserts;
  A.edit((s) => s.map((p) => (p.id === 'p1' ? { ...p, price: 150, name: 'Kaos Premium' } : p)));
  await wait();
  ok(B.box.state[0].price === 150 && B.box.state[0].name === 'Kaos Premium', 'harga & nama berubah di kasir tanpa muat ulang');
  ok(s1.upserts === before + 1, 'tidak ada pengiriman berulang (gema diabaikan)', `upserts=${s1.upserts - before}`);

  console.log('3. Stok atomik dari dua perangkat');
  A.edit((s) => s.map((p) => ({ ...p, stock: p.stock - 2 })));   // admin jual 2
  B.edit((s) => s.map((p) => ({ ...p, stock: p.stock - 3 })));   // kasir jual 3 (bersamaan)
  await wait(120);
  ok(s1.table('products').get('p1')!.stock === 5, 'stok server = 10-2-3 = 5', `server=${s1.table('products').get('p1')!.stock}`);
  ok(A.box.state[0].stock === 5 && B.box.state[0].stock === 5, 'kedua perangkat konvergen ke 5', `A=${A.box.state[0].stock} B=${B.box.state[0].stock}`);

  console.log('4. Kasir tidak boleh menghapus / mengubah produk (RLS) -> rollback');
  B.edit(() => []);
  await wait(120);
  ok(s1.table('products').size === 1, 'server tetap menyimpan produk');
  ok(B.box.state.length === 1, 'tampilan kasir dipulihkan dari server (rollback)');
  B.edit((s) => s.map((p) => ({ ...p, price: 1 })));
  await wait(120);
  ok(B.box.state[0].price === 150, 'perubahan harga ilegal oleh kasir dibatalkan', `price=${B.box.state[0].price}`);

  console.log('5. Item baru & hapus oleh admin sampai ke kasir');
  A.edit((s) => [...s, { id: 'p2', name: 'Hoodie', price: 300, stock: 4 }]);
  await wait();
  ok(B.box.state.some((p) => p.id === 'p2'), 'produk baru muncul di kasir');
  A.edit((s) => s.filter((p) => p.id !== 'p2'));
  await wait();
  ok(!B.box.state.some((p) => p.id === 'p2'), 'produk yang dihapus admin hilang di kasir');

  console.log('6. Stok lokal yang belum terkirim tidak hilang saat ada update remote');
  const s2 = new FakeServer();
  const A2 = client(s2, 'admin', 'products', [{ id: 'x', name: 'X', stock: 10 }], { seedWhenEmpty: () => true, seedOnEmptyRows: true, debounceMs: 10_000 });
  await A2.eng.hydrate(); A2.eng.start();
  A2.box.state = A2.box.state.map((p) => ({ ...p, stock: 9 }));           // jual 1 (belum terkirim)
  A2.eng.applyRemote({ type: 'upsert', item: { id: 'x', name: 'X', stock: 7 } });  // perangkat lain jual 3
  ok(A2.box.state[0].stock === 6, 'stok = 7 (server) - 1 (lokal tertunda) = 6', `stok=${A2.box.state[0].stock}`);

  console.log('7. Jaringan putus lalu pulih (retry otomatis)');
  const s3 = new FakeServer();
  const A3 = client(s3, 'admin', 'orders', [], { seedWhenEmpty: () => true, seedOnEmptyRows: true, insertAt: 'start' });
  await A3.eng.hydrate(); A3.eng.start();
  A3.be.failNext = 2;
  A3.edit((s) => [{ id: 'o1', total: 5 }, ...s]);
  await wait(250);
  ok(s3.table('orders').has('o1'), 'transaksi tetap terkirim setelah jaringan pulih');

  console.log('8. Duplikat dari perangkat lain tidak menggandakan item');
  const s4 = new FakeServer();
  const A4 = client(s4, 'admin', 'orders', [], { seedWhenEmpty: () => true, seedOnEmptyRows: true });
  const B4 = client(s4, 'kasir', 'orders', []);
  await A4.eng.hydrate(); A4.eng.start(); await B4.eng.hydrate(); B4.eng.start();
  A4.edit((s) => [{ id: 'o9', total: 1 }, ...s]); await wait();
  A4.edit((s) => s.map((o) => ({ ...o, total: 2 }))); await wait();
  ok(B4.box.state.length === 1 && B4.box.state[0].total === 2, 'satu item, nilai terbaru');

  console.log('9. Tabel yang sengaja dikosongkan (reset) tidak diisi ulang dari cache lama');
  const s5 = new FakeServer();                       // server kosong ([]), bukan "belum pernah dibuat"
  const A5 = client(s5, 'admin', 'orders', [{ id: 'lama', total: 1 }], { seedWhenEmpty: () => true });
  await A5.eng.hydrate();
  ok(s5.table('orders').size === 0 && A5.box.state.length === 0, 'cache lokal lama tidak menghidupkan kembali data yang sudah dihapus');

  console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})();
