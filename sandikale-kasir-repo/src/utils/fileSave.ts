// Penyimpanan berkas: memakai kemampuan "downloads" di halaman terbit, dan jalur cadangan
// (unduh biasa, dialog bantuan) bila tampilan tidak mengizinkan unduhan langsung.
type DownloadsNs = {
  save: (req: { filename: string; data: Blob | string }) => Promise<{ status: string }>;
} | null;

let downloadsPromise: Promise<DownloadsNs> | null = null;

function getDownloads(): Promise<DownloadsNs> {
  if (!downloadsPromise) {
    downloadsPromise = (async () => {
      try {
        const c = (window as any).claude;
        if (c && typeof c.use === 'function') {
          const ns = await Promise.race([
            c.use('downloads'),
            new Promise((r) => setTimeout(() => r(null), 12000)),
          ]);
          return (ns as DownloadsNs) || null;
        }
      } catch {
        /* tidak tersedia */
      }
      return null;
    })();
  }
  return downloadsPromise;
}
// Siapkan lebih awal supaya siap saat tombol ditekan
void getDownloads();

const isFramed = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

// ---------- Dialog bantuan (tampil di atas aplikasi) ----------
function overlay(title: string, bodyHtml: string, actions: { label: string; onClick: () => void; primary?: boolean }[]) {
  const old = document.getElementById('file-help-dialog');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'file-help-dialog';
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;';
  const box = document.createElement('div');
  box.style.cssText =
    'background:#141824;color:#e2e8f0;border:1px solid #2a3350;border-radius:18px;max-width:420px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);font-size:13px;line-height:1.5;';
  box.innerHTML = `<div style="font-weight:800;font-size:15px;margin-bottom:8px;color:#fff">${title}</div><div style="color:#cbd5e1">${bodyHtml}</div>`;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;';
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.style.cssText = `flex:1;min-width:90px;padding:10px 12px;border-radius:12px;border:0;cursor:pointer;font-weight:700;font-size:13px;${
      a.primary ? 'background:#e11d48;color:#fff;' : 'background:#222a3d;color:#e2e8f0;'
    }`;
    b.onclick = a.onClick;
    row.appendChild(b);
  });
  box.appendChild(row);
  wrap.appendChild(box);
  document.body.appendChild(wrap);
  return () => wrap.remove();
}

export function showExportError(message: string) {
  const close = overlay(
    'Berkas belum berhasil dibuat',
    `${message.replace(/</g, '&lt;')}<br/><br/>Periksa koneksi internet lalu coba lagi.`,
    [{ label: 'Tutup', primary: true, onClick: () => close() }]
  );
}

function showFileHelp(blob: Blob, filename: string, why: string) {
  const url = URL.createObjectURL(blob);
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  const canShare = !!(navigator as any).canShare && (navigator as any).canShare({ files: [file] });
  const actions: { label: string; onClick: () => void; primary?: boolean }[] = [
    {
      label: 'Unduh',
      primary: true,
      onClick: () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
    },
    {
      label: 'Buka',
      onClick: () => {
        const w = window.open(url, '_blank');
        if (!w) {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      },
    },
  ];
  if (canShare) {
    actions.push({
      label: 'Bagikan',
      onClick: () => {
        (navigator as any).share({ files: [file], title: filename }).catch(() => {});
      },
    });
  }
  actions.push({
    label: 'Tutup',
    onClick: () => {
      close();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
  });
  const close = overlay(
    `Berkas siap: ${filename.replace(/</g, '&lt;')}`,
    `${why}<br/><br/>Coba tombol <b>Unduh</b>, <b>Buka</b>${canShare ? ', atau <b>Bagikan</b>' : ''}. ` +
      `Jika tetap tidak berhasil, buka sistem kasir lewat link artifact di claude.ai (layar penuh) ` +
      `sehingga muncul konfirmasi <b>Simpan</b> setiap kali ekspor atau cetak.`,
    actions
  );
}

function anchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function saveBlob(blob: Blob, filename: string): Promise<'saved' | 'declined'> {
  const dl = await getDownloads();
  let why = 'Penyimpanan otomatis tidak tersedia di tampilan ini.';
  if (dl) {
    try {
      await dl.save({ filename, data: blob });
      return 'saved';
    } catch (e: any) {
      if (e && e.code === 'declined') return 'declined';
      why = `Penyimpanan otomatis gagal${e && e.code ? ` (${e.code})` : ''}.`;
    }
  }
  if (isFramed()) {
    showFileHelp(blob, filename, why);
  } else {
    anchorDownload(blob, filename);
  }
  return 'saved';
}

export async function saveText(content: string, filename: string, mime: string) {
  return saveBlob(new Blob([content], { type: mime }), filename);
}

// Cetak PDF: dengan kemampuan downloads PDF siap cetak disimpan lalu dibuka dari perangkat;
// di halaman penuh dialog cetak dibuka langsung.
export async function printPdfBlob(blob: Blob, filename: string): Promise<'saved' | 'declined' | 'printed'> {
  const dl = await getDownloads();
  if (dl || isFramed()) return saveBlob(blob, filename);
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
  };
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120000);
  return 'printed';
}

// ---------- Pemuatan jsPDF sesuai kebutuhan (cadangan bila tag script awal gagal) ----------
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gagal memuat ' + src));
    document.head.appendChild(s);
  });
}

async function loadFirst(urls: string[]) {
  let last: any;
  for (const u of urls) {
    try {
      await loadScript(u);
      return;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('gagal memuat pustaka PDF');
}

export async function ensureJsPdf(): Promise<void> {
  const w = window as any;
  if (!w.jspdf || !w.jspdf.jsPDF) {
    await loadFirst([
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
    ]);
  }
  if (!w.jspdf || !w.jspdf.jsPDF) throw new Error('Pustaka PDF (jsPDF) tidak termuat.');
  const probe = (w.jspdf.jsPDF as any).API;
  if (!(probe && probe.autoTable) && !w.jspdf.autoTable) {
    try {
      await loadFirst([
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
      ]);
    } catch {
      /* tabel dibutuhkan hanya oleh sebagian laporan */
    }
  }
}
