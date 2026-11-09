import { CLOUD_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from '../env';
import { MemoryBackend } from './memoryBackend';
import type { Backend } from './types';
import type { CloudBackend } from './supabaseBackend';

let instance: Promise<Backend> | null = null;

/** Satu backend untuk seluruh aplikasi: Supabase bila dikonfigurasi, jika tidak penyimpanan lokal. */
export function getBackend(): Promise<Backend> {
  if (!instance) {
    instance = CLOUD_MODE
      ? import('./supabaseBackend').then((m) => m.createSupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY))
      : Promise.resolve(new MemoryBackend());
  }
  return instance;
}

export const isCloudBackend = (b: Backend): b is CloudBackend => b.kind === 'supabase';
export type { Backend } from './types';
