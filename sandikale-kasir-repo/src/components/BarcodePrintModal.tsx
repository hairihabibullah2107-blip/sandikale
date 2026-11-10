import React, { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { Download, Printer, X } from 'lucide-react';
import type { Product } from '../types';

type PaperMode = 'A4' | '50x30' | '40x25' | '58x40';

interface Props {
  products: Product[];
  onClose: () => void;
}

const PAPER_OPTIONS: { value: PaperMode; label: string; width: number; height: number }[] = [
  { value: 'A4', label: 'A4 — label 63,5 × 38,1 mm', width: 63.5, height: 38.1 },
  { value: '50x30', label: 'Thermal — 50 × 30 mm', width: 50, height: 30 },
  { value: '40x25', label: 'Thermal — 40 × 25 mm', width: 40, height: 25 },
  { value: '58x40', label: 'Thermal — 58 × 40 mm', width: 58, height: 40 },
];

function createBarcodeCanvas(value: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value, {
    format: 'CODE128',
    width: 2,
    height: 150,
    displayValue: false,
    margin: 8,
    lineColor: '#000000',
    background: '#ffffff',
  });
  return canvas;
}

function BarcodeCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    try {
      const generated = createBarcodeCanvas(value);
      canvas.width = generated.width;
      canvas.height = generated.height;
      const context = canvas.getContext('2d');
      if (context) {
        context.imageSmoothingEnabled = false;
        context.drawImage(generated, 0, 0);
      }
    } catch (error) {
      console.error('Gagal membuat barcode:', error);
      canvas.width = 1;
      canvas.height = 1;
    }
  }, [value]);

  return <canvas ref={canvasRef} className="barcode-print-image" aria-label={`Barcode ${value}`} />;
}

export const BarcodePrintModal: React.FC<Props> = ({ products, onClose }) => {
  const [paper, setPaper] = useState<PaperMode>('A4');
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [pdfError, setPdfError] = useState('');
  const selectedPaper = PAPER_OPTIONS.find((item) => item.value === paper) || PAPER_OPTIONS[0];
  const printableProducts = useMemo(() => products.filter((product) => product.barcode?.trim()), [products]);
  const missingBarcodeCount = products.length - printableProducts.length;
  const labels = useMemo(
    () => printableProducts.flatMap((product) => Array.from({ length: copies }, (_, index) => ({ product, key: `${product.id}-${index}` }))),
    [printableProducts, copies]
  );

  const downloadPdf = () => {
    setPdfError('');
    if (labels.length === 0) {
      setPdfError('Tidak ada label barcode yang dapat dibuat.');
      return;
    }
    try {
      const isA4 = paper === 'A4';
      const doc = new jsPDF({
        orientation: isA4 ? 'portrait' : 'landscape',
        unit: 'mm',
        format: isA4 ? 'a4' : [selectedPaper.width, selectedPaper.height],
        compress: true,
      });
      const margin = 8;
      const gap = 1.5;
      const columns = isA4 ? 3 : 1;
      const rowsPerPage = isA4 ? 7 : 1;
      const labelsPerPage = columns * rowsPerPage;

      labels.forEach(({ product }, index) => {
        if (index > 0 && index % labelsPerPage === 0) {
          if (isA4) doc.addPage('a4', 'portrait');
        }
        if (!isA4 && index > 0) doc.addPage([selectedPaper.width, selectedPaper.height], 'landscape');

        const pageIndex = index % labelsPerPage;
        const column = isA4 ? pageIndex % columns : 0;
        const row = isA4 ? Math.floor(pageIndex / columns) : 0;
        const x = isA4 ? margin + column * (selectedPaper.width + gap) : 0;
        const y = isA4 ? margin + row * (selectedPaper.height + gap) : 0;
        const w = selectedPaper.width;
        const h = selectedPaper.height;
        const inset = isA4 ? 2 : 2.5;

        doc.setTextColor(15, 15, 15);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA4 ? 8 : 7);
        const nameLines = doc.splitTextToSize(product.name || 'Produk SANDIKALE', w - inset * 2);
        doc.text(nameLines.slice(0, 1), x + w / 2, y + (isA4 ? 5 : 4.5), { align: 'center' });

        const barcodeCanvas = createBarcodeCanvas(product.barcode);
        const barcodeHeight = isA4 ? 17 : Math.max(8, h * 0.38);
        const barcodeY = y + (isA4 ? 8 : 7);
        doc.addImage(barcodeCanvas.toDataURL('image/png'), 'PNG', x + inset, barcodeY, w - inset * 2, barcodeHeight);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isA4 ? 7 : 6);
        doc.text(product.barcode, x + w / 2, barcodeY + barcodeHeight + (isA4 ? 3 : 2.5), { align: 'center' });

        if (showPrice) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(isA4 ? 8 : 6);
          doc.text(`Rp ${Number(product.sellingPrice || 0).toLocaleString('id-ID')}`, x + w / 2, y + h - (isA4 ? 3 : 2), { align: 'center' });
        }
      });

      doc.save(`label-barcode-sandikale-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Gagal membuat PDF barcode:', error);
      setPdfError('PDF gagal dibuat. Periksa apakah kode barcode produk menggunakan huruf/angka standar.');
    }
  };

  return (
    <div id="barcode-print-overlay" className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-6">
      <style>{`
        .barcode-print-label { box-sizing: border-box; width: ${selectedPaper.width}mm; height: ${selectedPaper.height}mm; padding: 2mm; overflow: hidden; background: #fff; color: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; border: 1px dashed #ddd; break-inside: avoid; }
        .barcode-print-name { width: 100%; font: 700 9pt Arial, sans-serif; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .barcode-print-image { display: block; flex: 0 0 auto; width: 92%; height: 18mm; max-height: none; object-fit: fill; image-rendering: pixelated; }
        .barcode-print-code { font: 8pt monospace; letter-spacing: .5px; text-align: center; }
        .barcode-print-price { font: 700 9pt Arial, sans-serif; }
        .barcode-print-grid { display: grid; grid-template-columns: repeat(3, ${selectedPaper.width}mm); gap: 1.5mm; align-content: start; justify-content: start; }
        @media print {
          @page { size: ${paper === 'A4' ? 'A4 portrait' : `${selectedPaper.width}mm ${selectedPaper.height}mm`}; margin: ${paper === 'A4' ? '8mm' : '0'}; }
          body * { visibility: hidden !important; }
          #barcode-print-overlay, #barcode-print-root, #barcode-print-root * { visibility: visible !important; }
          #barcode-print-overlay { position: static !important; inset: auto !important; display: block !important; padding: 0 !important; background: #fff !important; }
          #barcode-print-root { position: static !important; inset: auto !important; width: 100% !important; max-width: none !important; max-height: none !important; height: auto !important; overflow: visible !important; background: #fff !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          #barcode-print-root > .p-4 { padding: 0 !important; overflow: visible !important; }
          .barcode-print-controls { display: none !important; }
          .barcode-print-grid { ${paper === 'A4' ? `display: grid; grid-template-columns: repeat(3, ${selectedPaper.width}mm); gap: 1.5mm;` : 'display: block;'} }
          ${paper === 'A4' ? '' : '.barcode-print-label { break-after: page; page-break-after: always; } .barcode-print-label:last-child { break-after: auto; page-break-after: auto; }'}
          .barcode-print-label { border: none; break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div id="barcode-print-root" className="w-full max-w-5xl max-h-[95vh] overflow-auto bg-white text-slate-900 rounded-2xl shadow-2xl">
        <div className="barcode-print-controls sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-t-2xl">
          <div>
            <h3 className="font-bold text-base">Cetak Label Barcode</h3>
            <p className="text-xs text-slate-300">{printableProducts.length} produk siap cetak · {labels.length} label</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700" aria-label="Tutup"><X size={18} /></button>
        </div>

        <div className="barcode-print-controls p-4 flex flex-wrap gap-3 items-end border-b border-slate-200">
          <label className="text-xs font-semibold flex flex-col gap-1">
            Ukuran kertas / label
            <select value={paper} onChange={(event) => setPaper(event.target.value as PaperMode)} className="border border-slate-300 rounded-lg px-3 py-2 bg-white">
              {PAPER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold flex flex-col gap-1">
            Jumlah per produk
            <input type="number" min={1} max={100} value={copies} onChange={(event) => setCopies(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="w-28 border border-slate-300 rounded-lg px-3 py-2" />
          </label>
          <label className="text-xs flex items-center gap-2 pb-2">
            <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
            Tampilkan harga jual
          </label>
          <button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm px-4 py-2.5">
            <Download size={16} /> Unduh PDF
          </button>
          <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm px-4 py-2.5">
            <Printer size={16} /> Cetak
          </button>
        </div>

        <div className="p-4 overflow-auto">
          {pdfError && <p role="alert" className="mb-3 text-xs text-red-700">{pdfError}</p>}
          {missingBarcodeCount > 0 && <p className="mb-3 text-xs text-amber-700">{missingBarcodeCount} produk dilewati karena belum memiliki barcode.</p>}
          {printableProducts.length === 0 ? (
            <p className="text-sm text-slate-600">Tidak ada produk dengan barcode yang bisa dicetak.</p>
          ) : (
            <div className="barcode-print-grid">
              {labels.map(({ product, key }) => (
                <div className="barcode-print-label" key={key}>
                  <div className="barcode-print-name">{product.name}</div>
                  <BarcodeCanvas value={product.barcode} />
                  <div className="barcode-print-code">{product.barcode}</div>
                  {showPrice && <div className="barcode-print-price">Rp {product.sellingPrice.toLocaleString('id-ID')}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
