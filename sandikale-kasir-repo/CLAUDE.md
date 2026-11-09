# CLAUDE.md - Aturan Proyek SANDIKALE Kasir

Baca sebelum mengubah kode. Urutan kerja: analisis -> 7 lapisan (Monitoring, Deploy, Env, Database, Test, Rules, Aplikasi) -> implementasi -> test -> laporan.

## Arsitektur
- `src/context/AppContext.tsx`: state + aturan bisnis. Data tersinkron lewat `src/lib/sync/useAppSync.ts`.
- `src/lib/backend`: `Backend` (Supabase atau MemoryBackend lokal). Mode ditentukan `src/lib/env.ts` (CLOUD_MODE).
- `src/lib/sync/CollectionSync.ts`: diff -> upsert/hapus; stok dikirim sebagai DELTA lewat `adjustStock` (RPC `adjust_stock`), bukan ditimpa.
- Server menolak (RLS/duplikat) -> state dipulihkan dari server (rollback). Jangan menonaktifkan perilaku ini.
- Shift: satu shift terbuka per kasir (`currentShift` diturunkan dari `shifts`). Sesi login berlaku selama tab terbuka (sessionStorage; Supabase `auth.storage` juga sessionStorage). Dibuka dari awal = wajib login. Jangan menyimpan sesi/PIN di localStorage.

## Database (supabase/migrations)
- Perubahan skema = file migrasi BARU berurutan (0004_...), jangan mengedit yang sudah dijalankan.
- Setiap tabel wajib RLS. Hapus transaksi/shift hanya admin. Fungsi sensitif `security definer` + `revoke from anon`.
- PIN minimal 6 karakter (aturan Supabase Auth). Username -> email `<username>@sandikale.id`.

## Env & Deploy
- Hanya `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Dilarang menaruh `service_role`/secret di kode.
- GitHub Pages lewat `.github/workflows/deploy.yml` (secrets repo). `VITE_BASE` diatur workflow.

## Gaya & tema
- Tailwind v3. Tema Terang/Krem = `src/themes.generated.css` hasil `npm run themes` (jangan diedit manual).
- Jangan memakai warna inline (`style`) untuk teks/latar; tidak ikut tema.
- Layout wajib lolos 360 px (HP), 820 px (tablet), 1180 px+ (desktop) tanpa scroll horizontal halaman.

## Aturan
- Jangan ubah file yang tidak terkait; jangan hapus fitur yang berjalan.
- Penyimpanan berkas lewat `saveBlob`/`printPdfBlob` (src/utils/fileSave.ts).
- Nama owner di laporan: Hairi Habibullah (`OWNER_NAME` di pdfExport.ts).
- Setelah perubahan besar: `npm run test:sync`, uji alur kasir -> DP -> pelunasan -> laporan, uji responsif & kontras tema.

## Risiko yang diketahui
- PIN cadangan demo (mode lokal) tertanam; tidak berlaku di mode cloud.
- Pembaruan pesanan (mis. pelunasan DP) boleh oleh semua akun aktif (RLS); perketat bila perlu.
- Kode Supabase belum diuji ke server asli di lingkungan pengembangan awal; uji dengan proyek Supabase sebelum produksi.
