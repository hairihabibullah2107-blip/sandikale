# SANDIKALE Kasir

Sistem kasir (POS) untuk Sandikale: kasir, shift X/Z, order sablon custom + SPK, DP & pelunasan, stok, laporan PDF,
scan barcode (kamera & scanner USB), tema Gelap / Terang Lembut / Krem Hangat. Berjalan di HP, tablet, dan desktop.

Dua mode, otomatis sesuai konfigurasi:

| Mode | Kapan aktif | Data |
|---|---|---|
| **Cloud** | `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` terisi | Supabase (Postgres). Perubahan admin dan transaksi kasir langsung muncul di semua perangkat yang sedang login (realtime). |
| **Lokal** | kedua variabel kosong | Hanya di browser perangkat itu (sinkron antar-tab). Cocok untuk demo/uji. |

## 1. Siapkan Supabase (gratis)
1. Buat proyek di https://supabase.com.
2. Buka **SQL Editor**, jalankan isi `supabase/setup_all.sql` sekali (atau 3 file di `supabase/migrations/` berurutan).
   Opsional: jalankan `supabase/seed_demo_products.sql` untuk 12 produk contoh.
3. **Authentication → Providers → Email**: matikan **Confirm email**. Biarkan pendaftaran aktif
   (akun baru otomatis *nonaktif* sampai admin mengaktifkan, jadi orang luar tidak mendapat akses).
4. **Authentication → Users → Add user**: buat admin pertama.
   - Email: `<username>@sandikale.id` (mis. `hairi.habibullah@sandikale.id`), centang **Auto Confirm User**.
   - Password: PIN **minimal 6 karakter** (ini PIN yang diketik saat login).
   - Akun pertama otomatis menjadi **admin**. Login di aplikasi memakai *username* (bagian sebelum `@`) dan PIN.
5. **Project Settings → API**: salin **Project URL** dan **anon public key**.

User berikutnya dibuat admin lewat **Pengaturan → Manajemen User** (PIN minimal 6 karakter).

## 2. Jalankan di komputer
```bash
cp .env.example .env      # isi URL dan anon key dari langkah 1.5
npm install
npm run dev               # http://localhost:3000
npm run test:sync         # uji mesin sinkron (tanpa jaringan)
```

## 3. GitHub + hosting gratis (GitHub Pages)
```bash
git remote add origin https://github.com/<akun>/<repo>.git
git push -u origin main
```
1. Repo → **Settings → Secrets and variables → Actions → New repository secret**: tambahkan
   `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Setiap `git push` ke `main` otomatis build dan deploy ke `https://<akun>.github.io/<repo>/`.

Hosting gratis lain (Cloudflare Pages, Netlify, Vercel): build command `npm run build`, output `dist`, isi dua variabel env di dashboard hosting, **jangan** set `VITE_BASE`.

## Keamanan
- Kunci *anon* memang publik; data dilindungi **RLS** di database (`0002_security.sql`). Jangan pernah memakai kunci `service_role` di aplikasi.
- Hanya akun aktif yang bisa membaca data. Hapus laporan (transaksi/shift) hanya admin, dijaga di database.
- Stok berubah atomik lewat fungsi `adjust_stock` (dua kasir menjual barang yang sama tidak saling menimpa).
- PIN admin untuk void/reset diverifikasi di server. Pada mode lokal, PIN cadangan demo (`1234`, `hairi21`) masih berlaku; jangan dipakai untuk produksi.

## Catatan operasional
- Proyek Supabase gratis **dijeda otomatis bila 7 hari tanpa aktivitas**; buka aplikasi minimal seminggu sekali atau aktifkan kembali dari dashboard.
- Setiap kasir punya shift sendiri (satu shift terbuka per kasir). Shift dibuka otomatis saat login pertama dan dilanjutkan saat login berikutnya.
- **Login:** membuka aplikasi dari awal (tab baru / aplikasi ditutup lalu dibuka lagi) selalu menampilkan halaman login. Selama tab yang sama masih terbuka, muat ulang tidak meminta login lagi sampai menekan **Keluar**. Sesi disimpan per-tab (`sessionStorage`), bukan permanen. Saat admin menonaktifkan/menghapus akun, sesinya otomatis keluar.
- Nomor invoice mode cloud memuat dua huruf kode kasir (mis. `INV-20261104-003-HA`) agar tidak bentrok antar perangkat.
- Tema: menu pengguna → **Tema Tampilan** (disimpan per perangkat). Setelah menambah kelas warna baru, jalankan `npm run themes`.

## Struktur
```
src/lib/backend     # Supabase & penyimpanan lokal (satu antarmuka)
src/lib/sync        # mesin sinkron realtime (CollectionSync, useAppSync)
src/context         # state & aturan bisnis aplikasi
supabase/           # skema, RLS, fungsi server, realtime, seed
tests/              # uji mesin sinkron
```
