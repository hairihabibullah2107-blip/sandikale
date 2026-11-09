import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveBlob, printPdfBlob, ensureJsPdf } from './fileSave';
import { IG_ICON, WA_ICON } from '../assets/socialIcons';
import { Order, Product, ShiftRecord, StoreSettings, CustomSablonDetails } from '../types';

interface OptimizedImageInfo {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
}

// In-memory image cache to prevent repeated canvas re-compression
const pdfImageCache = new Map<string, OptimizedImageInfo>();

/**
 * Ultra-fast, zero-lag browser download helper for jsPDF.
 * Uses native Blob and ObjectURL to prevent jsPDF internal thread-blocking save routine.
 */
async function triggerPdfDownload(
  doc: jsPDF,
  filename: string,
  mode: 'download' | 'print' = 'download'
): Promise<void> {
  const blob = doc.output('blob');
  if (mode === 'print') await printPdfBlob(blob, filename);
  else await saveBlob(blob, filename);
}

/**
 * Pre-processes images specifically for ultra-fast, zero-lag jsPDF insertion.
 * Scales down giant base64 payloads to crisp PDF-native dimensions and uses
 * hardware-accelerated canvas to prevent main thread freezing during PDF export.
 */
async function getOptimizedPdfImage(
  src: string | undefined,
  maxDimension = 600
): Promise<OptimizedImageInfo | null> {
  if (!src || (!src.startsWith('data:image') && !src.startsWith('blob:'))) return null;

  const cacheKey = `${src.slice(0, 80)}_${src.length}_${maxDimension}`;
  if (pdfImageCache.has(cacheKey)) {
    return pdfImageCache.get(cacheKey)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      if (origW <= 0 || origH <= 0) {
        resolve(null);
        return;
      }

      // Calculate scale to bound maximum dimension
      const scale = Math.min(1, maxDimension / Math.max(origW, origH));
      const targetW = Math.max(1, Math.round(origW * scale));
      const targetH = Math.max(1, Math.round(origH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      const isPng = src.startsWith('data:image/png');

      if (!isPng) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const result: OptimizedImageInfo = {
        dataUrl: isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85),
        width: origW,
        height: origH,
        format: isPng ? 'PNG' : 'JPEG',
      };

      pdfImageCache.set(cacheKey, result);
      resolve(result);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Struk thermal PDF 58mm/80mm: teks dibungkus rapi, tinggi kertas menyesuaikan isi.
 */
export async function downloadReceiptPdf(
  order: Order,
  store: StoreSettings,
  mode: 'download' | 'print' = 'download'
): Promise<void> {
  const is58mm = store.printerPaperSize === '58mm';
  const paperWidth = is58mm ? 58 : 80;
  const logoInfo = await getOptimizedPdfImage(store.logoUrl, 300);
  await ensureJsPdf();

  const M = is58mm ? 3.5 : 4.5;
  const L = M;
  const R = paperWidth - M;
  const CW = R - L;
  const S = {
    title: is58mm ? 10.5 : 12.5,
    base: is58mm ? 7 : 8,
    small: is58mm ? 6 : 6.8,
    total: is58mm ? 9 : 10.5,
  };
  const lineH = (pt: number) => pt * 0.3528 * 1.28;
  const rupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
  const storeDisplayName =
    store.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE';

  // Gambar struk; dry=true hanya untuk mengukur tinggi kertas
  const draw = (doc: any, dry: boolean): number => {
    let y = 5;
    const font = (style: 'normal' | 'bold' | 'italic', size: number) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
    };
    const centered = (text: string, style: 'normal' | 'bold' | 'italic', size: number, gap = 0) => {
      font(style, size);
      const lines: string[] = doc.splitTextToSize(text, CW);
      lines.forEach((ln) => {
        doc.text(ln, paperWidth / 2, y, { align: 'center' });
        y += lineH(size);
      });
      y += gap;
    };
    const rule = (gap = 1.6) => {
      doc.setDrawColor(90, 90, 90);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([0.7, 0.7], 0);
      doc.line(L, y, R, y);
      doc.setLineDashPattern([], 0);
      y += gap + 1.2;
    };
    const row = (left: string, right: string, style: 'normal' | 'bold' = 'normal', size = S.base) => {
      font(style, size);
      doc.text(left, L, y);
      doc.text(right, R, y, { align: 'right' });
      y += lineH(size);
    };
    const labelValue = (label: string, value: string) => {
      font('normal', S.base);
      const x0 = L + (is58mm ? 15 : 17);
      doc.text(label, L, y);
      doc.text(':', x0 - 1.6, y);
      const lines: string[] = doc.splitTextToSize(value, R - x0);
      lines.forEach((ln, i) => {
        doc.text(ln, x0, y);
        if (i < lines.length - 1) y += lineH(S.base);
      });
      y += lineH(S.base);
    };

    // Logo
    if (logoInfo && !dry) {
      try {
        const maxW = is58mm ? 20 : 24;
        const maxH = is58mm ? 15 : 18;
        let lw = maxW;
        let lh = (logoInfo.height * maxW) / logoInfo.width;
        if (lh > maxH) {
          lh = maxH;
          lw = (logoInfo.width * maxH) / logoInfo.height;
        }
        doc.addImage(logoInfo.dataUrl, logoInfo.format, paperWidth / 2 - lw / 2, y, lw, lh);
        y += lh + 2.5;
      } catch {
        /* lewati logo */
      }
    } else if (logoInfo && dry) {
      const maxW = is58mm ? 20 : 24;
      const maxH = is58mm ? 15 : 18;
      let lh = (logoInfo.height * maxW) / logoInfo.width;
      if (lh > maxH) lh = maxH;
      y += lh + 2.5;
    }

    // Kop toko
    centered(storeDisplayName.toUpperCase(), 'bold', S.title, 0.4);
    if (store.tagline) centered(store.tagline, 'normal', S.small);
    if (store.address) centered(store.address, 'normal', S.small);
    centered(`WA: ${store.phone || '-'}  |  IG: ${store.instagram || '@_sandikale'}`, 'normal', S.small, 1);
    rule();

    // Info nota
    labelValue('No. Struk', order.invoiceNumber);
    labelValue('Tanggal', order.date);
    labelValue('Kasir', order.cashierName);
    labelValue('Pelanggan', order.customerName);
    rule();

    // Item
    order.items.forEach((item) => {
      font('bold', S.base);
      (doc.splitTextToSize(item.name, CW) as string[]).forEach((ln) => {
        doc.text(ln, L, y);
        y += lineH(S.base);
      });
      const cd: any = (item as any).customDetails;
      if (cd) {
        const sizes = Object.entries(cd.garmentSizes || {})
          .filter(([, q]) => (q as number) > 0)
          .map(([k, q]) => `${k}:${q}`)
          .join(' ');
        const detail = [cd.garmentSleeve, cd.garmentColor, sizes].filter(Boolean).join(' | ');
        if (detail) {
          font('italic', S.small);
          (doc.splitTextToSize(detail, CW - 2) as string[]).forEach((ln) => {
            doc.text(ln, L + 2, y);
            y += lineH(S.small);
          });
        }
      }
      const itemTotal = item.qty * item.price - (item.discountAmount || 0);
      font('normal', S.base);
      doc.text(`${item.qty} x ${rupiah(item.price)}`, L + 2, y);
      doc.text(rupiah(itemTotal), R, y, { align: 'right' });
      y += lineH(S.base);
      if (item.discountAmount > 0) {
        font('italic', S.small);
        doc.text(`Diskon item: -${rupiah(item.discountAmount)}`, L + 2, y);
        y += lineH(S.small);
      }
      y += 0.8;
    });
    rule();

    // Rincian total
    row('Subtotal', rupiah(order.subtotal));
    if (order.discountTotal > 0) row('Diskon', `-${rupiah(order.discountTotal)}`);
    if (order.taxAmount > 0) row(`PPN (${order.taxRate}%)`, rupiah(order.taxAmount));
    if (order.serviceCharge > 0) row('Layanan', rupiah(order.serviceCharge));
    y += 1.2;
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.3);
    doc.line(L, y, R, y);
    y += lineH(S.total) * 0.95;
    row('TOTAL', rupiah(order.grandTotal), 'bold', S.total);
    y += 0.8;

    // Pembayaran
    if (order.payments && order.payments.length > 0) {
      order.payments.forEach((pay) => {
        row(`${pay.kind === 'dp' ? 'DP' : 'Pelunasan'} (${pay.method})`, rupiah(pay.amount));
      });
      y += 0.6;
      if (order.status === 'dp') {
        const remaining = order.remainingBalance || 0;
        if (!dry) {
          doc.setFillColor(235, 235, 235);
          doc.rect(L, y - 3.4, CW, lineH(S.total) + 1.2, 'F');
        }
        row('SISA PEMBAYARAN', rupiah(remaining), 'bold', S.total - (is58mm ? 1.2 : 1.5));
        y += 0.8;
        centered('Sisa dilunasi sebelum barang diambil.', 'italic', S.small);
      } else {
        row('STATUS', 'LUNAS', 'bold', S.base + 0.6);
      }
    } else {
      row('Metode', String(order.paymentMethod).replace('_', ' '));
      row('Bayar', rupiah(order.amountPaid));
      row('Kembalian', rupiah(order.change), 'bold');
    }
    y += 1;
    rule();

    // Catatan kaki
    const footer = store.receiptFooter || 'Terima kasih atas kunjungan Anda!';
    centered(footer, 'italic', S.small, 0.6);
    if (!/tukar/i.test(footer)) {
      centered('Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.', 'italic', S.small);
    }
    return y + 4;
  };

  // Ukur tinggi lalu gambar pada kertas dengan tinggi pas
  const scratch: any = new jsPDF({ unit: 'mm', format: [paperWidth, 1500] });
  const totalHeight = draw(scratch, true);
  const doc: any = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [paperWidth, Math.max(60, totalHeight)],
  });
  draw(doc, false);

  await new Promise((r) => setTimeout(r, 20));
  await triggerPdfDownload(doc, `Struk_${order.invoiceNumber}.pdf`, mode);
}

type RGB = [number, number, number];

function parseShirtColor(name: string): RGB {
  const t = (name || '').toLowerCase();
  const table: [RegExp, RGB][] = [
    [/hitam|black/, [22, 22, 24]],
    [/putih|white/, [246, 246, 246]],
    [/maroon|marun|burgundy/, [110, 22, 38]],
    [/navy|dongker|biru tua/, [22, 32, 72]],
    [/biru|blue/, [34, 84, 170]],
    [/merah|red/, [190, 28, 36]],
    [/abu|grey|gray|charcoal/, [120, 122, 128]],
    [/hijau|green|army|olive/, [52, 100, 62]],
    [/kuning|yellow|mustard/, [232, 190, 40]],
    [/orange|oranye/, [230, 120, 30]],
    [/coklat|cokelat|brown|mocca|mocha/, [110, 76, 54]],
    [/krem|cream|beige|sand/, [232, 220, 196]],
    [/pink|rose|salem/, [236, 160, 180]],
    [/ungu|purple|lilac/, [120, 80, 160]],
  ];
  for (const [re, rgb] of table) if (re.test(t)) return rgb;
  return [196, 198, 204];
}

function parseCm(label: string): { w: number; h: number } | null {
  const m = (label || '').match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  return { w: parseFloat(m[1].replace(',', '.')), h: parseFloat(m[2].replace(',', '.')) };
}

interface TeeBox {
  side: 'front' | 'back';
  main: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const UNIT_PER_CM = 60 / 52; // lebar badan kaos 60 unit ~ 52 cm
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function buildTeeBoxes(placements: { placement: string; printSize: string }[]): TeeBox[] {
  return placements.map((p) => {
    const t = (p.placement || '').toLowerCase();
    const d = parseCm(p.printSize || '');
    const short = (p.printSize || '').replace(/\s*\(.*\)\s*/, '').trim();
    const label = `${short}${d ? ` ${d.w}x${d.h}cm` : ''}`.trim();
    const cw = d ? d.w * UNIT_PER_CM : 0;
    const ch = d ? d.h * UNIT_PER_CM : 0;
    if (t.includes('kerah')) {
      const w = d ? clamp(cw, 8, 24) : 14;
      const h = d ? clamp(ch, 3, 8) : 5;
      return { side: 'back', main: false, x: 50 - w / 2, y: 11, w, h, label } as TeeBox;
    }
    if (t.includes('lengan')) {
      const w = d ? clamp(cw, 5, 12) : 8;
      const h = d ? clamp(ch, 5, 12) : 8;
      const cx = t.includes('kiri') ? 90 : 10;
      return { side: 'front', main: false, x: cx - w / 2, y: 27 - h / 2, w, h, label } as TeeBox;
    }
    if (t.includes('dada kiri') || t.includes('saku')) {
      const w = d ? clamp(cw, 6, 22) : 11.5;
      const h = d ? clamp(ch, 6, 22) : 11.5;
      return { side: 'front', main: false, x: 64 - w / 2, y: 19, w, h, label } as TeeBox;
    }
    const back = t.includes('belakang') || t.includes('punggung');
    const w = d ? clamp(cw, 12, 54) : 30;
    const h = d ? clamp(ch, 12, 66) : 40;
    return { side: back ? 'back' : 'front', main: true, x: 50 - w / 2, y: back ? 15 : 18, w, h, label } as TeeBox;
  });
}

type PathOp = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number];

function drawPath(doc: any, ops: PathOp[], ox: number, oy: number, s: number, style: 'FD' | 'S' | 'F', closed: boolean) {
  const first = ops[0] as ['M', number, number];
  let cx = first[1];
  let cy = first[2];
  const segs: number[][] = [];
  for (let i = 1; i < ops.length; i++) {
    const op = ops[i];
    if (op[0] === 'L') {
      segs.push([(op[1] - cx) * s, (op[2] - cy) * s]);
      cx = op[1];
      cy = op[2];
    } else if (op[0] === 'C') {
      const o = op as unknown as number[];
      segs.push([(o[1] - cx) * s, (o[2] - cy) * s, (o[3] - cx) * s, (o[4] - cy) * s, (o[5] - cx) * s, (o[6] - cy) * s]);
      cx = o[5];
      cy = o[6];
    }
  }
  doc.lines(segs, ox + first[1] * s, oy + first[2] * s, [1, 1], style, closed);
}

function drawTee(doc: any, ox: number, oy: number, s: number, rgb: RGB, back: boolean) {
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const dark = lum < 110;
  const edge: RGB = dark ? [78, 78, 82] : [165, 167, 172];
  const neckY = back ? 7.5 : 12;
  const body: PathOp[] = [
    ['M', 38, 3],
    ['C', 38, neckY, 62, neckY, 62, 3] as any,
    ['L', 80, 9],
    ['L', 99, 33],
    ['L', 88, 43],
    ['L', 80, 36],
    ['L', 80, 98],
    ['L', 20, 98],
    ['L', 20, 36],
    ['L', 12, 43],
    ['L', 1, 33],
    ['L', 20, 9],
  ];
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.setDrawColor(edge[0], edge[1], edge[2]);
  doc.setLineWidth(0.5);
  drawPath(doc, body, ox, oy, s, 'FD', true);

  // jahitan bahu, lengan, kerah, dan keliman
  doc.setLineWidth(0.3);
  drawPath(doc, [['M', 80, 9], ['L', 80, 36]], ox, oy, s, 'S', false);
  drawPath(doc, [['M', 20, 9], ['L', 20, 36]], ox, oy, s, 'S', false);
  drawPath(doc, [['M', 20, 93.5], ['L', 80, 93.5]], ox, oy, s, 'S', false);
  drawPath(doc, [['M', 99, 33], ['L', 88, 43]], ox, oy, s, 'S', false);
  drawPath(doc, [['M', 1, 33], ['L', 12, 43]], ox, oy, s, 'S', false);
  const ribY = back ? 10 : 17;
  drawPath(doc, [['M', 39.5, 3.8], ['C', 39.5, ribY, 60.5, ribY, 60.5, 3.8] as any], ox, oy, s, 'S', false);
}

async function renderPdfTitleImage(
  title: string,
  subtitle: string
): Promise<{ dataUrl: string; aspect: number } | null> {
  try {
    if (typeof document === 'undefined') return null;
    try {
      await Promise.race([
        Promise.all([
          (document as any).fonts.load('800 100px Panchang'),
          (document as any).fonts.load('900 100px Unbounded'),
          (document as any).fonts.load('500 40px "Barlow Condensed"'),
        ]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch {
      /* gunakan font cadangan */
    }
    const W = 1600;
    const H = 260;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#111111';
    ctx.textBaseline = 'alphabetic';

    const heavy = (px: number) => `800 ${px}px Panchang, Unbounded, "Arial Black", Impact, Helvetica, sans-serif`;
    let size = 190;
    ctx.font = heavy(size);
    let tw = ctx.measureText(title).width;
    if (tw > 1560) {
      size = Math.floor((size * 1560) / tw);
      ctx.font = heavy(size);
      tw = ctx.measureText(title).width;
    }
    ctx.fillText(title, (W - tw) / 2, 190);

    const subFont = '500 40px "Barlow Condensed", "Arial Narrow", Helvetica, sans-serif';
    ctx.font = subFont;
    const chars = subtitle.split('');
    const widths = chars.map((c) => ctx.measureText(c).width);
    const sumW = widths.reduce((a, b) => a + b, 0);
    const target = Math.min(tw * 0.76, 1500);
    const gap = chars.length > 1 ? Math.max(4, (target - sumW) / (chars.length - 1)) : 0;
    let x = (W - (sumW + gap * (chars.length - 1))) / 2;
    chars.forEach((c, i) => {
      ctx.fillText(c, x, 245);
      x += widths[i] + gap;
    });
    return { dataUrl: canvas.toDataURL('image/png'), aspect: W / H };
  } catch {
    return null;
  }
}

function formatWaNumber(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const intl = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  const local = intl.startsWith('62') ? intl.slice(2) : '';
  if (local.length === 11) return `+62 ${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
  return '+' + intl;
}

/**
 * SPK produksi bergaya lembar desain: judul brand, tabel spesifikasi 3x3,
 * tampak depan & belakang kaos dengan penanda posisi sablon, serta kontak toko.
 */
export async function downloadProductionSpkPdf(
  custom: CustomSablonDetails,
  orderNumber: string,
  store: StoreSettings,
  cashierName: string,
  mode: 'download' | 'print' = 'download'
): Promise<void> {
  const storeName =
    store.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE';

  const [logoInfo, mockupArt, titleImg] = await Promise.all([
    getOptimizedPdfImage(store.logoUrl, 400),
    getOptimizedPdfImage(custom.designMockupUrl, 2400),
    renderPdfTitleImage('SNDKL PROJECT', 'DESIGN & PRODUCTIONS'),
  ]);

  await ensureJsPdf();
  const doc: any = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [210, 210] });
  const PW = 210;
  const INK: RGB = [20, 20, 20];

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const deadlineStr = custom.deadline
    ? new Date(custom.deadline + 'T00:00:00')
        .toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  // ---------- Bingkai halaman ----------
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(1.1);
  doc.rect(0.8, 0.8, PW - 1.6, PW - 1.6, 'S');

  // ---------- Judul ----------
  if (titleImg) {
    const iw = 153;
    doc.addImage(titleImg.dataUrl, 'PNG', (PW - iw) / 2, 1.5, iw, iw / titleImg.aspect);
  } else {
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.text('SNDKL PROJECT', PW / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('D E S I G N  &  P R O D U C T I O N S', PW / 2, 23, { align: 'center' });
  }

  // ---------- Tabel spesifikasi ----------
  const tx = 10.2;
  const ty = 29.5;
  const tw = 189.6;
  const rowH = 7.3;
  const logoW = 32;
  const colW = (tw - logoW) / 3;
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.5);
  doc.rect(tx, ty, tw, rowH * 3, 'S');
  doc.line(tx + logoW, ty, tx + logoW, ty + rowH * 3);
  for (let c = 1; c < 3; c++) doc.line(tx + logoW + colW * c, ty, tx + logoW + colW * c, ty + rowH * 3);
  for (let r = 1; r < 3; r++) doc.line(tx + logoW, ty + rowH * r, tx + tw, ty + rowH * r);

  // logo toko
  if (logoInfo) {
    try {
      const bw = logoW - 5;
      const bh = rowH * 3 - 5;
      let lw = bw;
      let lh = (logoInfo.height * bw) / logoInfo.width;
      if (lh > bh) {
        lh = bh;
        lw = (logoInfo.width * bh) / logoInfo.height;
      }
      doc.addImage(logoInfo.dataUrl, logoInfo.format, tx + (logoW - lw) / 2, ty + (rowH * 3 - lh) / 2, lw, lh);
    } catch {
      /* lewati logo */
    }
  } else {
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(storeName.toUpperCase(), tx + logoW / 2, ty + rowH * 1.5, { align: 'center' });
  }

  const sleeve = custom.garmentSleeve || '';
  const modelText = sleeve === 'Lengan Panjang' ? 'LENGAN PANJANG' : sleeve === 'Lengan Pendek' ? 'OBLONG' : '-';
  const sizesText =
    Object.entries(custom.garmentSizes || {})
      .filter(([, q]) => q > 0)
      .map(([sz, q]) => `${sz}:${q}`)
      .join(', ') || '-';
  const cells: [string, string][][] = [
    [
      ['BRAND', (custom.customerName || '-').toUpperCase()],
      ['COLOR', (custom.garmentColor || '-').toUpperCase()],
      ['SIZE', sizesText],
    ],
    [
      ['MODEL', modelText],
      ['DESIGNER', storeName.toUpperCase()],
      ['SABLON', 'DTF'],
    ],
    [
      ['MATERIAL', (custom.garmentType || '-').replace(/^Kaos\s+/i, '').toUpperCase()],
      ['DATE', dateStr],
      ['QTY', String(custom.totalPcs)],
    ],
  ];
  cells.forEach((row, r) =>
    row.forEach(([label, value], c) => {
      const cx = tx + logoW + colW * c;
      const cy = ty + rowH * r + rowH / 2 + 1;
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(label, cx + 2.6, cy);
      doc.text(':', cx + 20.6, cy);
      doc.setFont('helvetica', 'normal');
      const avail = colW - 23.6 - 1.5;
      let fs = 9;
      doc.setFontSize(fs);
      while (fs > 5 && doc.getTextWidth(value) > avail) {
        fs -= 0.5;
        doc.setFontSize(fs);
      }
      let v = value;
      while (v.length > 2 && doc.getTextWidth(v) > avail) v = v.slice(0, -2) + '…';
      doc.text(v, cx + 23.6, cy);
    })
  );

  // ---------- Tampak kaos / file mockup ----------
  if (mockupArt) {
    const ax = 10.2;
    const ay = 54;
    const aw = 189.6;
    const ah = 105;
    let rw = aw;
    let rh = (mockupArt.height * aw) / mockupArt.width;
    if (rh > ah) {
      rh = ah;
      rw = (mockupArt.width * ah) / mockupArt.height;
    }
    try {
      doc.addImage(mockupArt.dataUrl, mockupArt.format, ax + (aw - rw) / 2, ay + (ah - rh) / 2, rw, rh);
    } catch {
      /* lewati gambar */
    }
  } else {
  const shirt = parseShirtColor(custom.garmentColor);
  const lum = 0.299 * shirt[0] + 0.587 * shirt[1] + 0.114 * shirt[2];
  const mark: RGB = lum < 110 ? [235, 235, 235] : [40, 40, 40];
  const s = 0.98;
  const oy = 55;
  const views = [
    { side: 'front' as const, ox: 52.5 - 49, title: 'DEPAN', art: null as any },
    { side: 'back' as const, ox: 157.5 - 49, title: 'BELAKANG', art: null as any },
  ];
  const boxes = buildTeeBoxes(custom.placements || []);

  views.forEach((v) => {
    drawTee(doc, v.ox, oy, s, shirt, v.side === 'back');
    const mine = boxes.filter((b) => b.side === v.side);
    let artDrawn = false;
    mine.forEach((b) => {
      const bx = v.ox + b.x * s;
      const by = oy + b.y * s;
      const bw = b.w * s;
      const bh = b.h * s;
      if (b.main && v.art && !artDrawn) {
        try {
          let rw = bw;
          let rh = (v.art.height * bw) / v.art.width;
          if (rh > bh) {
            rh = bh;
            rw = (v.art.width * bh) / v.art.height;
          }
          doc.addImage(v.art.dataUrl, v.art.format, bx + (bw - rw) / 2, by + (bh - rh) / 2, rw, rh);
          artDrawn = true;
        } catch {
          /* lewati gambar */
        }
      }
      doc.setDrawColor(mark[0], mark[1], mark[2]);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1.6, 1.1], 0);
      doc.rect(bx, by, bw, bh, 'S');
      doc.setLineDashPattern([], 0);
      doc.setTextColor(mark[0], mark[1], mark[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      if (b.label) {
        const ly = b.main ? by + bh + 3.4 : by + bh + 3;
        doc.text(b.label, bx + bw / 2, ly, { align: 'center' });
      }
    });
    // desain yang diunggah tetapi belum ada posisi utamanya: tampilkan di dada/punggung
    if (v.art && !artDrawn) {
      try {
        const bw = 30 * s;
        const bh = 36 * s;
        let rw = bw;
        let rh = (v.art.height * bw) / v.art.width;
        if (rh > bh) {
          rh = bh;
          rw = (v.art.width * bh) / v.art.height;
        }
        doc.addImage(v.art.dataUrl, v.art.format, v.ox + 50 * s - rw / 2, oy + 20 * s, rw, rh);
      } catch {
        /* lewati gambar */
      }
    }
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(v.title, v.ox + 50 * s, oy + 98 * s + 5.5, { align: 'center', charSpace: 1.2 });
  });

  }

  // ---------- Keterangan ----------
  const sy = 163.5;
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.3);
  doc.line(10.2, sy - 2.5, 199.8, sy - 2.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('KETERANGAN SABLON', 11, sy + 1);
  doc.text('CATATAN PRODUKSI', 108, sy + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  (custom.placements || []).slice(0, 6).forEach((p, i) => {
    const line = `${i + 1}. ${p.placement} - ${p.printSize}`;
    doc.text(doc.splitTextToSize(line, 92)[0], 11, sy + 5.4 + i * 3.7);
  });
  const noteLines: string[] = doc.splitTextToSize(custom.productionNotes || '-', 88).slice(0, 3);
  noteLines.forEach((ln: string, i: number) => doc.text(ln, 108, sy + 5.4 + i * 3.7));
  const metaY = sy + 5.4 + 3 * 3.7;
  doc.setFontSize(7);
  doc.text(`No. SPK ${orderNumber}  |  Penerima order: ${cashierName}`, 108, metaY);
  if (deadlineStr) doc.text(`Estimasi selesai: ${deadlineStr}`, 108, metaY + 3.6);

  // ---------- Footer kontak ----------
  const ig = (store.instagram || '@_sandikale').replace(/^@/, '');
  const wa = formatWaNumber(store.phone || '');
  doc.setFont('times', 'normal');
  doc.setFontSize(15);
  const igW = doc.getTextWidth(ig);
  const waW = wa ? doc.getTextWidth(wa) : 0;
  const icon = 7.2;
  const gap = 2.4;
  const between = wa ? 13 : 0;
  const total = icon + gap + igW + (wa ? between + icon + gap + waW : 0);
  let fx = (PW - total) / 2;
  const fy = 199.6;
  const midY = fy - 1.5;
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.addImage(IG_ICON, 'PNG', fx, midY - icon / 2, icon, icon);
  doc.text(ig, fx + icon + gap, fy);
  fx += icon + gap + igW + between;
  if (wa) {
    const wi = icon * 1.15; // ikon WhatsApp punya tepi putih, diperbesar sedikit
    doc.addImage(WA_ICON, 'PNG', fx - (wi - icon) / 2, midY - wi / 2, wi, wi);
    doc.text(wa, fx + icon + gap, fy);
  }

  await new Promise((r) => setTimeout(r, 20));
  await triggerPdfDownload(doc, `SPK_${orderNumber}.pdf`, mode);
}

/**
 * Downloads a Z-Report (Laporan Tutup Shift Kasir) in formal PDF.
 */
export async function downloadShiftReportPdf(shift: ShiftRecord, store: StoreSettings): Promise<void> {
  const storeDisplayName = store.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE';

  // Pre-optimize logo
  const logoInfo = await getOptimizedPdfImage(store.logoUrl, 300);

  await ensureJsPdf();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 30, 'F');

  // Store Logo in Banner if uploaded
  if (logoInfo) {
    try {
      const maxLw = 20;
      const maxLh = 20;
      let lw = maxLw;
      let lh = (logoInfo.height * maxLw) / logoInfo.width;
      if (lh > maxLh) {
        lh = maxLh;
        lw = (logoInfo.width * maxLh) / logoInfo.height;
      }
      doc.addImage(logoInfo.dataUrl, logoInfo.format, 12, 5 + (20 - lh) / 2, lw, lh);
    } catch {
      // fallback
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN PENUTUPAN KASIR (Z-REPORT)', 105, 12, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${storeDisplayName} - ${store.address} | Telp: ${store.phone} | IG: ${store.instagram || '@_sandikale'}`, 105, 18, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text(`Shift ID: ${shift.shiftNumber} | Dicetak: ${new Date().toLocaleString('id-ID')}`, 105, 24, { align: 'center' });

  // Shift Meta Box
  doc.setTextColor(15, 23, 42);
  let curY = 38;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, curY - 5, 180, 26, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, curY - 5, 180, 26, 2, 2, 'S');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Kasir Bertugas : ${shift.cashierName}`, 20, curY);
  doc.text(`Status Shift  : ${shift.status.toUpperCase()}`, 120, curY);
  curY += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Waktu Buka    : ${shift.startTime}`, 20, curY);
  doc.text(`Waktu Tutup   : ${shift.endTime || 'Masih Aktif'}`, 120, curY);
  curY += 7;
  doc.text(`Total Transaksi: ${shift.totalTransactions} transaksi`, 20, curY);
  doc.text(`Catatan       : ${shift.notes || 'Normal'}`, 120, curY);

  curY += 15;

  // Financial Breakdown Table
  const cashInTotal = shift.drawerTransactions
    .filter((d) => d.type === 'cash_in')
    .reduce((s, d) => s + d.amount, 0);
  const cashOutTotal = shift.drawerTransactions
    .filter((d) => d.type === 'cash_out')
    .reduce((s, d) => s + d.amount, 0);

  const summaryRows = [
    ['1', 'Modal Awal Kas (Starting Float)', `Rp ${shift.startingCash.toLocaleString('id-ID')}`],
    ['2', 'Total Penjualan Tunai (Cash Sales)', `Rp ${shift.totalSalesCash.toLocaleString('id-ID')}`],
    ['3', 'Kas Masuk Tambahan (Cash In)', `Rp ${cashInTotal.toLocaleString('id-ID')}`],
    ['4', 'Kas Keluar Operasional (Cash Out / Petty)', `- Rp ${cashOutTotal.toLocaleString('id-ID')}`],
    ['5', 'Total Saldo Kas Sistem (Expected Cash)', `Rp ${shift.expectedCashEnding.toLocaleString('id-ID')}`],
    ['6', 'Hitungan Kas Fisik Aktual (Actual Cash)', `Rp ${(shift.actualCashEnding ?? shift.expectedCashEnding).toLocaleString('id-ID')}`],
    [
      '7',
      'Selisih Kas (Difference Over/Short)',
      (shift.cashDifference ?? 0) === 0
        ? 'Rp 0 (PAS / SEIMBANG)'
        : (shift.cashDifference ?? 0) > 0
        ? `+ Rp ${(shift.cashDifference ?? 0).toLocaleString('id-ID')} (LEBIH)`
        : `- Rp ${Math.abs(shift.cashDifference ?? 0).toLocaleString('id-ID')} (KURANG)`,
    ],
    ['8', 'Total Penjualan Non-Tunai (QRIS/Card/Transfer)', `Rp ${shift.totalSalesNonCash.toLocaleString('id-ID')}`],
    [
      '9',
      'TOTAL OMZET SHIFT INI',
      `Rp ${(shift.totalSalesCash + shift.totalSalesNonCash).toLocaleString('id-ID')}`,
    ],
  ];

  autoTable(doc, {
    startY: curY,
    head: [['No', 'Uraian Kas & Penjualan', 'Nominal']],
    body: summaryRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 14;

  // Signatures
  doc.setFontSize(9);
  doc.text('Kasir Yang Menyerahkan:', 25, finalY);
  doc.line(20, finalY + 24, 75, finalY + 24);
  doc.text(shift.cashierName, 25, finalY + 28);

  doc.text('Supervisor / Head Store:', 135, finalY);
  doc.line(130, finalY + 24, 185, finalY + 24);
  doc.text('Hairi Habibullah (Owner)', 135, finalY + 28);

  // Microtask tick to ensure smooth UI animation before save
  await new Promise((r) => setTimeout(r, 20));
  await triggerPdfDownload(doc, `Z_Report_${shift.shiftNumber}.pdf`);
}

/**
 * Downloads a complete sales audit report in A4 PDF.
 */
const OWNER_NAME = 'Hairi Habibullah';
const rpf = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

async function startLandscapeReport(
  title: string,
  store: StoreSettings,
  scopeLabel?: string
): Promise<{ doc: any; storeName: string; W: number; H: number }> {
  const storeName =
    store.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE';
  const logoInfo = await getOptimizedPdfImage(store.logoUrl, 300);
  await ensureJsPdf();
  const doc: any = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 28, 'F');
  if (logoInfo) {
    try {
      const box = 20;
      let lw = box;
      let lh = (logoInfo.height * box) / logoInfo.width;
      if (lh > box) {
        lh = box;
        lw = (logoInfo.width * box) / logoInfo.height;
      }
      doc.addImage(logoInfo.dataUrl, logoInfo.format, 12, 4 + (20 - lh) / 2, lw, lh);
    } catch {
      /* lewati logo */
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, W / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${storeName} | ${store.address || ''} | IG: ${store.instagram || '@_sandikale'}`, W / 2, 18, { align: 'center' });
  doc.text(
    `${scopeLabel ? scopeLabel + ' | ' : ''}Dicetak: ${new Date().toLocaleString('id-ID')} | Owner: ${OWNER_NAME}`,
    W / 2,
    23,
    { align: 'center' }
  );
  return { doc, storeName, W, H };
}

function finishLandscapeReport(doc: any, storeName: string, W: number, H: number, signer: string) {
  const lastY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 40;
  let y = lastY + 12;
  if (y > H - 38) {
    doc.addPage();
    y = 24;
  }
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Disahkan oleh,', W - 70, y);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(W - 80, y + 22, W - 20, y + 22);
  doc.setFont('helvetica', 'bold');
  doc.text(OWNER_NAME, W - 50, y + 27, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(signer, W - 50, y + 31, { align: 'center' });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${storeName} - Dokumen laporan`, 12, H - 6);
    doc.text(`Halaman ${i} dari ${pages}`, W - 12, H - 6, { align: 'right' });
  }
}

export async function downloadSalesAuditPdf(
  orders: Order[],
  store: StoreSettings,
  scopeLabel?: string
): Promise<void> {
  const { doc, storeName, W, H } = await startLandscapeReport('LAPORAN PENJUALAN KASIR', store, scopeLabel);
  const dpOrders = orders.filter((o) => o.status === 'dp');
  const dpRemaining = dpOrders.reduce((s, o) => s + (o.remainingBalance || 0), 0);
  const completed = orders.filter((o) => o.status === 'completed');
  const omzet = completed.reduce((s, o) => s + o.grandTotal, 0);
  const diskon = completed.reduce((s, o) => s + o.discountTotal, 0);
  const batal = orders.length - completed.length;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Transaksi berhasil: ${completed.length}`, 12, 36);
  doc.text(`Total omzet: ${rpf(omzet)}`, 80, 36);
  doc.text(`Total diskon: ${rpf(diskon)}`, 150, 36);
  doc.text(`Dibatalkan/void: ${batal}`, 215, 36);
  doc.text(`Pesanan DP berjalan: ${dpOrders.length} (sisa tagihan ${rpf(dpRemaining)})`, 12, 41);

  autoTable(doc, {
    startY: 45,
    head: [['No', 'No. Invoice', 'Tanggal', 'Pelanggan', 'Metode', 'Subtotal', 'Diskon', 'PPN', 'Layanan', 'Grand Total', 'Dibayar', 'Sisa', 'Status', 'Kasir']],
    body: orders.map((o, i) => [
      `${i + 1}`,
      o.invoiceNumber,
      o.date,
      o.customerName,
      o.paymentMethod,
      rpf(o.subtotal),
      rpf(o.discountTotal),
      rpf(o.taxAmount),
      rpf(o.serviceCharge),
      rpf(o.grandTotal),
      rpf(o.status === 'voided' ? 0 : Math.min(o.amountPaid, o.grandTotal)),
      rpf(o.remainingBalance || 0),
      o.status === 'dp' ? 'DP' : String(o.status).toUpperCase(),
      o.cashierName,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right', fontStyle: 'bold' }, 10: { halign: 'right' }, 11: { halign: 'right' } },
    margin: { left: 12, right: 12, bottom: 14 },
  });
  finishLandscapeReport(doc, storeName, W, H, 'Owner');
  await new Promise((r) => setTimeout(r, 20));
  await triggerPdfDownload(doc, `Laporan_Penjualan_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function downloadShiftsRecapPdf(shifts: ShiftRecord[], store: StoreSettings): Promise<void> {
  const { doc, storeName, W, H } = await startLandscapeReport('REKAP BUKU SHIFT KASIR', store);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Total sesi shift: ${shifts.length}`, 12, 36);
  doc.text(
    `Total penjualan tunai: ${rpf(shifts.reduce((s, x) => s + (x.totalSalesCash || 0), 0))}`,
    80,
    36
  );
  doc.text(
    `Total non-tunai: ${rpf(shifts.reduce((s, x) => s + (x.totalSalesNonCash || 0), 0))}`,
    165,
    36
  );

  autoTable(doc, {
    startY: 41,
    head: [['Shift', 'Kasir', 'Buka', 'Tutup', 'Modal Awal', 'Tunai', 'Non-Tunai', 'Trx', 'Saldo Sistem', 'Kas Fisik', 'Selisih', 'Status', 'Catatan']],
    body: shifts.map((s) => [
      s.shiftNumber,
      s.cashierName,
      s.startTime,
      s.endTime || 'Aktif',
      rpf(s.startingCash),
      rpf(s.totalSalesCash),
      rpf(s.totalSalesNonCash),
      `${s.totalTransactions}`,
      rpf(s.expectedCashEnding),
      s.actualCashEnding == null ? '-' : rpf(s.actualCashEnding),
      s.cashDifference == null ? '-' : `${s.cashDifference > 0 ? '+' : ''}${rpf(s.cashDifference)}`,
      String(s.status).toUpperCase(),
      s.notes || '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7, cellPadding: 1.6 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'center' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' } },
    margin: { left: 12, right: 12, bottom: 14 },
  });
  finishLandscapeReport(doc, storeName, W, H, 'Owner');
  await new Promise((r) => setTimeout(r, 20));
  await triggerPdfDownload(doc, `Rekap_Shift_Kasir_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function downloadProductsCatalogPdf(products: Product[], store: StoreSettings): Promise<void> {
  const { doc, storeName, W, H } = await startLandscapeReport('LAPORAN STOK & KATALOG PRODUK', store);
  const aset = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const habis = products.filter((p) => p.stock <= 0).length;
  const menipis = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Total SKU: ${products.length}`, 12, 36);
  doc.text(`Estimasi nilai stok (HPP): ${rpf(aset)}`, 62, 36);
  doc.text(`Stok menipis: ${menipis}`, 170, 36);
  doc.text(`Stok habis: ${habis}`, 220, 36);

  autoTable(doc, {
    startY: 41,
    head: [['SKU', 'Barcode', 'Nama Produk', 'Kategori', 'HPP', 'Harga Jual', 'Margin', 'Stok', 'Min', 'Satuan', 'Status']],
    body: products.map((p) => [
      p.sku,
      p.barcode,
      p.name,
      p.category,
      rpf(p.costPrice),
      rpf(p.sellingPrice),
      rpf(p.sellingPrice - p.costPrice),
      `${p.stock}`,
      `${p.minStock}`,
      p.unit,
      p.stock <= 0 ? 'HABIS' : p.stock <= p.minStock ? 'MENIPIS' : 'AMAN',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'center' }, 8: { halign: 'center' }, 10: { fontStyle: 'bold' } },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 10) {
        if (data.cell.raw === 'HABIS') data.cell.styles.textColor = [190, 18, 60];
        else if (data.cell.raw === 'MENIPIS') data.cell.styles.textColor = [180, 83, 9];
        else data.cell.styles.textColor = [21, 128, 61];
      }
    },
    margin: { left: 12, right: 12, bottom: 14 },
  });
  finishLandscapeReport(doc, storeName, W, H, 'Owner');
  await new Promise((r) => setTimeout(r, 20));
  await triggerPdfDownload(doc, `Katalog_Stok_Produk_${new Date().toISOString().slice(0, 10)}.pdf`);
}
