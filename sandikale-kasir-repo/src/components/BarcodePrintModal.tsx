import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarcodeFormat, EncodeHintType, MultiFormatWriter } from '@zxing/library';
import { Printer, X } from 'lucide-react';
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

function BarcodeCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    try {
      const hints = new Map();
      hints.set(EncodeHintType.MARGIN, 8);
      const matrix = new MultiFormatWriter().encode(value, BarcodeFormat.CODE_128, 440, 110, hints);
      const width = matrix.getWidth();
      const height = matrix.getHeight();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#000';
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (matrix.get(x, y)) context.fillRect(x, y, 1, 1);
        }
      }
    } catch (error) {
      console.error('Gagal membuat barcode:', error);
    }
  }, [value]);

  return <canvas ref={canvasRef} className="barcode-print-image" aria-label={`Barcode ${value}`} />;
}

export const BarcodePrintModal: React.FC<Props> = ({ products, onClose }) => {
  const [paper, setPaper] = useState<PaperMode>('A4');
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const selectedPaper = PAPER_OPTIONS.find((item) => item.value === paper) || PAPER_OPTIONS[0];
  const printableProducts = useMemo(() => products.filter((product) => product.barcode?.trim()), [products]);
  const missingBarcodeCount = products.length - printableProducts.length;
  const labels = useMemo(
    () => printableProducts.flatMap((product) => Array.from({ length: copies }, (_, index) => ({ product, key: `${product.id}-${index}` }))),
    [printableProducts, copies]
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-6">
      <style>{`
        .barcode-print-label { box-sizing: border-box; width: ${selectedPaper.width}mm; height: ${selectedPaper.height}mm; padding: 2mm; overflow: hidden; background: #fff; color: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; border: 1px dashed #ddd; break-inside: avoid; }
        .barcode-print-name { width: 100%; font: 700 9pt Arial, sans-serif; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .barcode-print-image { display: block; width: 92%; height: auto; max-height: 55%; object-fit: contain; }
        .barcode-print-code { font: 8pt monospace; letter-spacing: .5px; text-align: center; }
        .barcode-print-price { font: 700 9pt Arial, sans-serif; }
        .barcode-print-grid { display: grid; grid-template-columns: repeat(3, ${selectedPaper.width}mm); gap: 1.5mm; align-content: start; justify-content: start; }
        @media print {
          @page { size: ${paper === 'A4' ? 'A4 portrait' : `${selectedPaper.width}mm ${selectedPaper.height}mm`}; margin: ${paper === 'A4' ? '8mm' : '0'}; }
          body * { visibility: hidden !important; }
          #barcode-print-root, #barcode-print-root * { visibility: visible !important; }
          #barcode-print-root { position: absolute !important; inset: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; background: #fff !important; padding: 0 !important; margin: 0 !important; }
          #barcode-print-root > .p-4 { padding: 0 !important; overflow: visible !important; }
          .barcode-print-controls { display: none !important; }
          .barcode-print-grid { ${paper === 'A4' ? `display: grid; grid-template-columns: repeat(3, ${selectedPaper.width}mm); gap: 1.5mm;` : 'display: block;'} }
          ${paper === 'A4' ? '' : '.barcode-print-label { break-after: page; } .barcode-print-label:last-child { break-after: auto; }'}
          .barcode-print-label { border: none; }
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
          <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm px-4 py-2.5">
            <Printer size={16} /> Cetak
          </button>
        </div>

        <div className="p-4 overflow-auto">
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
