// Konfigurasi lingkungan. Nilai berasal dari file .env (lokal) atau secrets CI (hosting).
// Kunci "anon" Supabase memang publik; keamanan data dijaga oleh RLS di database.
// JANGAN pernah menaruh kunci service_role di sini.
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
export const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

// true = mode cloud (Supabase + realtime antar-perangkat); false = mode lokal (data di browser).
export const CLOUD_MODE: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const MIN_PIN_LENGTH_CLOUD = 6;
