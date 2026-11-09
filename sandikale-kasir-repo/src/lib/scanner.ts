import { useEffect } from 'react';

/** Bunyi singkat konfirmasi scan (berhasil / gagal). */
export function scanBeep(success: boolean, muted: boolean) {
  if (muted) return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = success ? 1400 : 280;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.09 : 0.22));
    osc.onended = () => ctx.close();
  } catch {
    /* audio tidak tersedia */
  }
  try {
    navigator.vibrate?.(success ? 40 : [60, 40, 60]);
  } catch {
    /* getar tidak tersedia */
  }
}

/**
 * Scanner USB / Bluetooth (mode "keyboard wedge"): alat mengetik kode dengan sangat cepat lalu menekan Enter.
 * Kode ditangkap walau kursor tidak sedang berada di kolom scan. Pengetikan manusia (lambat) diabaikan.
 */
export function useBarcodeWedge(onScan: (code: string) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let buf = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const editable =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (editable) return; // kolom isian ditangani oleh formnya sendiri
      const now = performance.now();
      if (e.key === 'Enter') {
        if (buf.length >= 4) {
          e.preventDefault();
          const code = buf;
          buf = '';
          onScan(code);
        }
        buf = '';
        return;
      }
      if (e.key.length !== 1) return;
      if (now - last > 80) buf = ''; // jeda lama = ketikan manusia, mulai ulang
      buf += e.key;
      last = now;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, onScan]);
}
