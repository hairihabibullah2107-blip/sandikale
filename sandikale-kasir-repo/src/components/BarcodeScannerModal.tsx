import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, Flashlight, Check, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Kembalikan teks hasil ke pemanggil; nilai kembali = pesan hasil (mis. nama produk) atau null bila tidak dikenal. */
  onDetected: (code: string) => string | null;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code'];

function explain(err: any): string {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, atau gunakan scanner USB / ketik kode manual.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini.';
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.';
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'Kamera hanya bisa dipakai lewat alamat HTTPS.';
  return 'Kamera tidak bisa dibuka di tampilan ini. Gunakan scanner USB atau ketik kode manual.';
}

/** Scan barcode / QR memakai kamera. Berjalan terus-menerus sampai ditutup (cocok untuk banyak barang). */
export const BarcodeScannerModal: React.FC<Props> = ({ isOpen, onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [manual, setManual] = useState('');

  const handleCode = useCallback((raw: string) => {
    const code = (raw || '').trim();
    if (!code) return;
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < 1800) return; // cegah baca ganda
    lastRef.current = { code, at: now };
    const msg = onDetectedRef.current(code);
    setFlash({ ok: !!msg, text: msg || `Kode ${code} tidak ditemukan` });
    setTimeout(() => setFlash(null), 1200);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus('starting');
    setError('');
    setFlash(null);
    setTorchOn(false);

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no media'), { name: 'NotFoundError' });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        try {
          const caps: any = stream.getVideoTracks()[0]?.getCapabilities?.() || {};
          setCanTorch(!!caps.torch);
        } catch {
          setCanTorch(false);
        }
        setStatus('scanning');

        const BD = (window as any).BarcodeDetector;
        if (BD) {
          let formats = FORMATS;
          try {
            const supported: string[] = await BD.getSupportedFormats();
            formats = FORMATS.filter((f) => supported.includes(f));
          } catch {
            /* pakai daftar bawaan */
          }
          const detector = new BD({ formats });
          let timer: ReturnType<typeof setTimeout>;
          const tick = async () => {
            if (cancelled) return;
            try {
              if (video.readyState >= 2) {
                const found = await detector.detect(video);
                if (found && found[0]?.rawValue) handleCode(found[0].rawValue);
              }
            } catch {
              /* frame gagal dibaca, lanjut */
            }
            timer = setTimeout(tick, 150);
          };
          tick();
          stopRef.current = () => clearTimeout(timer);
        } else {
          // Peramban tanpa BarcodeDetector (mis. Chrome desktop): pakai pustaka ZXing.
          const { BrowserMultiFormatReader } = await import('@zxing/library');
          const reader = new BrowserMultiFormatReader();
          reader.decodeFromStream(stream, video, (result: any) => {
            if (result && !cancelled) handleCode(result.getText());
          });
          stopRef.current = () => reader.reset();
        }
      } catch (err) {
        if (cancelled) return;
        setError(explain(err));
        setStatus('error');
      }
    };
    start();

    return () => {
      cancelled = true;
      try {
        stopRef.current();
      } catch {
        /* abaikan */
      }
      stopRef.current = () => {};
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isOpen, handleCode]);

  const toggleTorch = async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      await (track as any)?.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch {
      /* senter tidak didukung */
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3">
      <div className="bg-[#121622] rounded-3xl border border-[#212738] w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-4 flex items-center justify-between border-b border-[#212738]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-rose-400" />
            <h3 className="font-extrabold text-sm text-white">Scan Barcode dengan Kamera</h3>
          </div>
          <button onClick={onClose} aria-label="Tutup scanner" className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3]">
          <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-cover" />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-300 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Membuka kamera...</span>
            </div>
          )}
          {status === 'scanning' && (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-white/70 rounded-xl pointer-events-none">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-rose-500/80" />
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-200 bg-black/70">
              {error}
            </div>
          )}
          {flash && (
            <div
              data-testid="scan-flash"
              className={`absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                flash.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {flash.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span className="truncate">{flash.text}</span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCode(manual);
              setManual('');
            }}
            className="flex gap-2"
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Atau ketik kode barcode / SKU"
              className="flex-1 px-3 py-2.5 text-xs rounded-xl bg-[#191f2e] border border-[#273248] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500"
            />
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#1f2638] text-slate-200 text-xs font-bold cursor-pointer">
              Tambah
            </button>
          </form>
          <div className="flex gap-2">
            {canTorch && (
              <button
                onClick={toggleTorch}
                className="flex-1 py-2.5 rounded-xl bg-[#1f2638] text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Flashlight className="w-4 h-4" />
                <span>{torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 text-white text-xs font-extrabold cursor-pointer"
            >
              Selesai
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center">Arahkan kamera ke barcode. Kode terbaca otomatis dan masuk keranjang.</p>
        </div>
      </div>
    </div>
  );
};
