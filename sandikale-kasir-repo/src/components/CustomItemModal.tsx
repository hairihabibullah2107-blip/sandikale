import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CustomSablonDetails, SablonPlacement } from '../types';
import {
  Sparkles,
  Upload,
  Printer,
  Download,
  Plus,
  Trash2,
  X,
  FileText,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  Layers,
  Loader2,
  ShieldCheck,
  Calculator,
  Zap,
  Tag,
} from 'lucide-react';
import { downloadProductionSpkPdf } from '../utils/pdfExport';
import { compressUploadedImage, CompressedImageResult } from '../utils/imageCompressor';

interface CustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomItemModal: React.FC<CustomItemModalProps> = ({ isOpen, onClose }) => {
  const {
    addCustomSablonItem,
    storeSettings,
    currentUser,
    products,
    addNotification,
    runWithExportLoading,
  } = useApp();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deadline, setDeadline] = useState('');

  // 1. Garment options directly from cashier products catalog
  const garmentProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.category === 'Kaos & Apparel Polos' ||
        p.category.toLowerCase().includes('kaos') ||
        p.category.toLowerCase().includes('apparel')
    );
  }, [products]);

  // 2. DTF Sablon options directly from cashier products catalog
  const dtfProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.category === 'Jasa Sablon DTF' ||
        p.category.toLowerCase().includes('sablon') ||
        p.name.toLowerCase().includes('dtf')
    );
  }, [products]);

  // Map DTF products to selectable print size options with real-time cashier pricing
  const dtfSizeOptions = useMemo(() => {
    if (dtfProducts.length > 0) {
      return dtfProducts.map((p) => {
        const shortName = p.name
          .replace(/^Jasa Sablon DTF (High Def )?/i, '')
          .replace(/^Jasa Sablon /i, '')
          .trim();
        return {
          id: p.id,
          label: shortName || p.name,
          fullName: p.name,
          price: p.sellingPrice,
          costPrice: p.costPrice,
        };
      });
    }

    // Default fallback matching cashier database
    return [
      { id: 'dtf-logo', label: 'Logo Saku / Dada (10x10cm)', fullName: 'Jasa Sablon DTF Logo Saku (10x10cm)', price: 6000, costPrice: 3000 },
      { id: 'dtf-a5', label: 'A5 Sedang (15x21cm)', fullName: 'Jasa Sablon DTF A5 (15x21cm)', price: 10000, costPrice: 5000 },
      { id: 'dtf-a4', label: 'A4 Standar (21x29cm)', fullName: 'Jasa Sablon DTF High Def A4 (21x29cm)', price: 16000, costPrice: 9000 },
      { id: 'dtf-a3', label: 'A3 Besar (29x42cm)', fullName: 'Jasa Sablon DTF High Def A3 (29x42cm)', price: 25000, costPrice: 14000 },
      { id: 'dtf-a3plus', label: 'A3+ Super (32x48cm)', fullName: 'Jasa Sablon DTF A3+ Super (32x48cm)', price: 32000, costPrice: 18000 },
    ];
  }, [dtfProducts]);

  const EMPTY_SIZES = { S: 0, M: 0, L: 0, XL: 0, XXL: 0, '3XL': 0 };
  const DEFAULT_NOTES =
    'Press 160°C selama 15 detik, kupas dingin (Cold Peel), packing plastik klip.';

  // Semua pilihan menu dikosongkan sebelum kasir memilih objek
  const [selectedGarmentName, setSelectedGarmentName] = useState('');
  const [garmentBasePrice, setGarmentBasePrice] = useState<number>(0); // harga katalog = lengan pendek
  const [garmentColor, setGarmentColor] = useState('');
  const [sleeveType, setSleeveType] = useState<'' | 'Lengan Pendek' | 'Lengan Panjang'>('');

  // Harga lengan panjang per jenis kaos (diisi kasir, tersimpan di perangkat)
  const [longSleevePrices, setLongSleevePrices] = useState<{ [name: string]: number }>(() => {
    try {
      const raw = localStorage.getItem('sandikale_long_sleeve_prices');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('sandikale_long_sleeve_prices', JSON.stringify(longSleevePrices));
    } catch {
      /* abaikan */
    }
  }, [longSleevePrices]);

  // Size distribution matrix
  const [sizeMatrix, setSizeMatrix] = useState<{ [size: string]: number }>({ ...EMPTY_SIZES });

  // Sablon Placements initialized with actual DTF price from catalog
  const [placements, setPlacements] = useState<SablonPlacement[]>([]);

  // Sync placement prices dynamically whenever cashier DTF prices change
  useEffect(() => {
    if (dtfSizeOptions.length > 0) {
      setPlacements((prev) =>
        prev.map((pl) => {
          if (!pl.printSize) return pl;
          const match = dtfSizeOptions.find(
            (d) =>
              d.label.toLowerCase() === pl.printSize.toLowerCase() ||
              d.fullName.toLowerCase().includes(pl.printSize.toLowerCase().slice(0, 4))
          );
          if (match && match.price !== pl.price) {
            return { ...pl, price: match.price, printSize: match.label };
          }
          return pl;
        })
      );
    }
  }, [dtfSizeOptions]);

  // Sync garment price if garment products update
  useEffect(() => {
    if (selectedGarmentName.includes('Bawa Bahan')) {
      setGarmentBasePrice(0);
    } else {
      const match = garmentProducts.find((p) => p.name === selectedGarmentName);
      if (match && match.sellingPrice !== garmentBasePrice) {
        setGarmentBasePrice(match.sellingPrice);
      }
    }
  }, [garmentProducts, selectedGarmentName]);

  const [designMockupUrl, setDesignMockupUrl] = useState<string>('');
  const [isCompressingDesign, setIsCompressingDesign] = useState(false);
  const [compressionStats, setCompressionStats] = useState<CompressedImageResult | null>(null);

  const [productionNotes, setProductionNotes] = useState(DEFAULT_NOTES);

  // Setiap kali modal dibuka, form kembali kosong
  useEffect(() => {
    if (isOpen) {
      setCustomerName('');
      setCustomerPhone('');
      setDeadline('');
      setSelectedGarmentName('');
      setGarmentBasePrice(0);
      setGarmentColor('');
      setSleeveType('');
      setSizeMatrix({ ...EMPTY_SIZES });
      setPlacements([]);
      setDesignMockupUrl('');
      setCompressionStats(null);
      setProductionNotes(DEFAULT_NOTES);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const placementOptions = [
    'Depan (Dada)',
    'Belakang (Punggung)',
    'Dada Kiri (Logo Saku)',
    'Lengan Kiri',
    'Lengan Kanan',
    'Kerah Belakang',
  ];

  // Dynamic real-time calculations
  const totalPieces = Object.values(sizeMatrix).reduce((sum, q) => sum + (Number(q) || 0), 0);
  const sablonCostPerPcs = placements.reduce((sum, p) => sum + (p.price || 0), 0);
  const isOwnMaterial = selectedGarmentName.includes('Bawa Bahan');
  const shortSleevePrice = garmentBasePrice;
  const longSleevePrice = longSleevePrices[selectedGarmentName] || 0;
  const garmentUnitPrice = isOwnMaterial
    ? 0
    : sleeveType === 'Lengan Panjang'
    ? longSleevePrice
    : sleeveType === 'Lengan Pendek'
    ? shortSleevePrice
    : 0;
  const unitPriceFinal = garmentUnitPrice + sablonCostPerPcs;
  const grandTotalPrice = unitPriceFinal * totalPieces;

  // Kelengkapan form (tombol aktif setelah semua pilihan terisi)
  const missing: string[] = [];
  if (!selectedGarmentName) missing.push('bahan kaos');
  if (selectedGarmentName && !isOwnMaterial && !sleeveType) missing.push('model lengan');
  if (sleeveType === 'Lengan Panjang' && !isOwnMaterial && longSleevePrice <= 0)
    missing.push('harga lengan panjang');
  if (!garmentColor.trim()) missing.push('warna kaos');
  if (totalPieces <= 0) missing.push('jumlah per ukuran');
  if (placements.length === 0 || placements.some((pl) => !pl.placement || !pl.printSize))
    missing.push('posisi & ukuran sablon');
  const isComplete = missing.length === 0;

  // Handle local image upload with high-definition smart compression
  const handleDesignUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      alert('Ukuran file maksimal 30MB');
      return;
    }

    try {
      setIsCompressingDesign(true);
      const result = await compressUploadedImage(file, {
        maxWidth: 2400,
        maxHeight: 2400,
        quality: 0.90, // Kualitas tajam 300 DPI cetak
        preserveTransparency: true,
      });

      setDesignMockupUrl(result.dataUrl);
      setCompressionStats(result);
      addNotification(
        `Desain berhasil dioptimasi: ${result.formattedOriginalSize} ➔ ${result.formattedCompressedSize} (Hemat ${result.compressionPercent}%, tetap tajam 300 DPI)`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Gagal mengompres gambar desain.');
    } finally {
      setIsCompressingDesign(false);
      e.target.value = '';
    }
  };

  const handleGarmentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosenName = e.target.value;
    setSelectedGarmentName(chosenName);
    const found = garmentProducts.find((p) => p.name === chosenName);
    if (found) {
      setGarmentBasePrice(found.sellingPrice);
    } else {
      setGarmentBasePrice(0);
    }
  };

  const addPlacementRow = () => {
    setPlacements((prev) => [...prev, { placement: '', printSize: '', price: 0 }]);
  };

  const removePlacementRow = (idx: number) => {
    setPlacements((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePlacement = (idx: number, field: keyof SablonPlacement, val: any) => {
    setPlacements((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const buildCustomData = (): CustomSablonDetails => ({
    customerName: customerName.trim() || 'Pelanggan Custom Sablon',
    customerPhone: customerPhone.trim() || undefined,
    deadline: deadline || undefined,
    garmentType: selectedGarmentName,
    garmentSleeve: isOwnMaterial ? undefined : sleeveType || undefined,
    garmentUnitPrice,
    garmentColor,
    garmentSizes: sizeMatrix,
    placements,
    designMockupUrl,
    totalPcs: totalPieces,
    unitPrice: unitPriceFinal,
    totalPrice: grandTotalPrice,
    productionNotes,
  });

  const handleExportSpkPdf = async () => {
    if (!isComplete) return;
    const orderNumber = `SPK-${Date.now().toString().slice(-6)}`;
    const customData = buildCustomData();

    await runWithExportLoading(
      {
        title: 'Merender Dokumen SPK Produksi PDF...',
        subtitle:
          'Menyusun formulir spesifikasi bahan, matriks ukuran, rincian placement sablon DTF, dan mengoptimasi resolusi cetak artwork 300 DPI...',
        type: 'pdf',
      },
      async () => {
        await downloadProductionSpkPdf(customData, orderNumber, storeSettings, currentUser?.name || 'Kasir');
      }
    );

    addNotification('Dokumen SPK Produksi resmi berhasil diunduh sebagai PDF.', 'success');
  };

  const handleDirectPrintSpk = async () => {
    if (!isComplete) return;
    await runWithExportLoading(
      {
        title: 'Menyiapkan Lembar Kerja SPK...',
        subtitle: 'Memformat tata letak pencetakan dokumen produksi...',
        type: 'print',
        minDurationMs: 400,
      },
      async () => {
        await downloadProductionSpkPdf(
          buildCustomData(),
          `SPK-${Date.now().toString().slice(-6)}`,
          storeSettings,
          currentUser?.name || 'Kasir',
          'print'
        );
      }
    );
    addNotification('Dokumen SPK siap dicetak.', 'info');
  };

  const handleAddToCart = () => {
    if (!isComplete) {
      addNotification(`Lengkapi dulu: ${missing.join(', ')}.`, 'warning');
      return;
    }
    const customData = buildCustomData();
    addCustomSablonItem(customData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#212738] flex items-center justify-between bg-[#151a28]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Order Sablon Kustom & SPK Tim Produksi
              </h3>
              <p className="text-xs text-slate-400">
                Pilih bahan kaos, ukuran, upload file desain customer, dan unduh SPK kerja produksi.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Order Specs (7 cols) */}
          <div className="lg:col-span-7 space-y-4 text-xs">
            {/* Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nama Pemesan / Komunitas *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Cth: Mas Budi Komunitas Sablon"
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nomor WhatsApp Customer
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Estimasi Selesai (Deadline)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full sm:w-1/2 p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 font-medium"
              />
            </div>

            {/* Garment Selection & Auto Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Pilih Bahan / Kaos Polos *
                </label>
                <select
                  value={selectedGarmentName}
                  onChange={handleGarmentSelect}
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white font-semibold outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="" className="bg-[#171d2b] text-white">
                    -- Pilih bahan kaos --
                  </option>
                  {garmentProducts.map((p) => (
                    <option key={p.id} value={p.name} className="bg-[#171d2b] text-white">
                      {p.name} (Lengan Pendek Rp {p.sellingPrice.toLocaleString('id-ID')})
                    </option>
                  ))}
                  <option value="Bawa Bahan Sendiri (Hanya Jasa Sablon)" className="bg-[#171d2b] text-white">
                    Bawa Bahan Sendiri (Jasa Sablon Saja - Rp 0)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Warna Kaos / Media *
                </label>
                <input
                  type="text"
                  value={garmentColor}
                  onChange={(e) => setGarmentColor(e.target.value)}
                  placeholder="Cth: Hitam Jet Black, Putih, Maroon..."
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                />
              </div>
            </div>

            {/* Model Lengan & Harga */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Model Lengan *</label>
                <select
                  value={sleeveType}
                  disabled={!selectedGarmentName || isOwnMaterial}
                  onChange={(e) => setSleeveType(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white font-semibold outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                >
                  <option value="" className="bg-[#171d2b] text-white">
                    -- Pilih model lengan --
                  </option>
                  <option value="Lengan Pendek" className="bg-[#171d2b] text-white">
                    Lengan Pendek (Rp {shortSleevePrice.toLocaleString('id-ID')})
                  </option>
                  <option value="Lengan Panjang" className="bg-[#171d2b] text-white">
                    Lengan Panjang{longSleevePrice > 0 ? ` (Rp ${longSleevePrice.toLocaleString('id-ID')})` : ' (isi harga)'}
                  </option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Harga Lengan Panjang (Rp/pcs)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!selectedGarmentName || isOwnMaterial}
                  value={longSleevePrice || ''}
                  onChange={(e) =>
                    setLongSleevePrices({
                      ...longSleevePrices,
                      [selectedGarmentName]: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  placeholder="Isi harga lengan panjang"
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Lengan pendek mengikuti harga katalog: Rp {shortSleevePrice.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* Size Distribution Matrix */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-300">
                  Rincian Ukuran Kaos (Pcs)
                </label>
                <span className="font-black text-rose-400">
                  Total: {totalPieces} pcs
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {['S', 'M', 'L', 'XL', 'XXL', '3XL'].map((sz) => (
                  <div key={sz} className="text-center">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{sz}</span>
                    <input
                      type="number"
                      min="0"
                      value={sizeMatrix[sz] || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setSizeMatrix({
                          ...sizeMatrix,
                          [sz]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full p-2 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white text-center font-bold font-mono outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Placements & Sizes */}
            <div className="space-y-2 pt-2 border-t border-[#1f2638]">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-300 uppercase tracking-wider block">
                    Posisi & Ukuran Sablon DTF ({placements.length} Sisi)
                  </label>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    ✓ Harga otomatis mengikuti tarif DTF yang tersedia di kasir
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addPlacementRow}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg bg-rose-950/30 border border-rose-900/40 hover:bg-rose-900/40 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Sisi Sablon</span>
                </button>
              </div>

              {placements.length === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-[#293248] text-center text-slate-400 text-[11px]">
                  Belum ada sisi sablon. Klik "Tambah Sisi Sablon" untuk memilih posisi dan ukuran.
                </div>
              )}

              {placements.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#161a26] border border-[#222a3d] flex flex-wrap sm:flex-nowrap gap-2 items-center"
                >
                  <span className="font-bold text-slate-400 text-xs w-6 shrink-0">#{idx + 1}</span>

                  {/* Placement selection */}
                  <div className="flex-1 min-w-[130px]">
                    <span className="text-[9px] text-slate-400 font-bold block mb-0.5">Sisi / Posisi</span>
                    <select
                      value={p.placement}
                      onChange={(e) => updatePlacement(idx, 'placement', e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#1a2030] border border-[#273248] text-white font-medium outline-none text-xs"
                    >
                      <option value="" className="bg-[#1a2030] text-white">
                        -- Pilih posisi --
                      </option>
                      {placementOptions.map((pos) => (
                        <option key={pos} value={pos} className="bg-[#1a2030] text-white">
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DTF Print Size selection directly from cashier catalog */}
                  <div className="flex-1 min-w-[170px]">
                    <span className="text-[9px] text-rose-400 font-bold block mb-0.5 flex items-center justify-between">
                      <span>Ukuran Sablon DTF</span>
                      <span className="text-[9px] text-emerald-400">Harga Kasir</span>
                    </span>
                    <select
                      value={p.printSize}
                      onChange={(e) => {
                        if (!e.target.value) {
                          updatePlacement(idx, 'printSize', '');
                          updatePlacement(idx, 'price', 0);
                          return;
                        }
                        const sel = dtfSizeOptions.find(
                          (s) => s.label === e.target.value || s.id === e.target.value
                        );
                        if (sel) {
                          updatePlacement(idx, 'printSize', sel.label);
                          updatePlacement(idx, 'price', sel.price);
                        }
                      }}
                      className="w-full p-2 rounded-lg bg-[#1a2030] border border-[#273248] text-rose-300 font-bold outline-none text-xs"
                    >
                      <option value="" className="bg-[#1a2030] text-white">
                        -- Pilih ukuran --
                      </option>
                      {dtfSizeOptions.map((sz) => (
                        <option key={sz.id} value={sz.label} className="bg-[#1a2030] text-white">
                          {sz.label} — Rp {sz.price.toLocaleString('id-ID')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Real-time side price badge */}
                  <div className="shrink-0 text-right pr-1">
                    <span className="text-[9px] text-slate-400 block mb-0.5">Tarif Sisi</span>
                    <span className="font-mono font-bold text-xs text-white bg-[#10141f] px-2 py-1.5 rounded-lg border border-[#252f44] block">
                      Rp {(p.price || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      removePlacementRow(idx);
                      addNotification(`Sisi sablon #${idx + 1} dihapus.`, 'info');
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition cursor-pointer shrink-0 mt-3 sm:mt-0"
                    title="Hapus Sisi Sablon Ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Notes for Operator */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Catatan Produksi & Instruksi Khusus
              </label>
              <input
                type="text"
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                placeholder="Cth: Press 2x, finishing doff halus, packing klip zip..."
                className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* RIGHT: Upload Customer Design & Cost Summary (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            {/* Upload File Mockup Jadi */}
            <div className="p-4 rounded-2xl bg-[#161a26] border border-[#222a3d] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-rose-400" />
                  <span>Upload File Mockup (Depan & Belakang)</span>
                </span>
                {designMockupUrl && (
                  <button
                    type="button"
                    onClick={() => setDesignMockupUrl('')}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {isCompressingDesign ? (
                <div className="w-full h-44 rounded-2xl border border-[#273248] bg-[#0c0e14] flex flex-col items-center justify-center gap-2 p-4 text-center animate-pulse">
                  <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                  <span className="font-bold text-xs text-white">Mengompres & Menjaga Kualitas Cetak...</span>
                  <span className="text-[10px] text-slate-400 max-w-xs">
                    Mereduksi beban memori agar sistem tidak ngeleg, mempertahankan resolusi tinggi 300 DPI agar cetak tidak pecah.
                  </span>
                </div>
              ) : designMockupUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden bg-[#0c0e14] border border-[#273248] p-2 flex flex-col items-center justify-center min-h-[160px]">
                    <img
                      src={designMockupUrl}
                      alt="File Mockup"
                      className="max-h-40 object-contain rounded-xl"
                    />
                    <label className="mt-2 py-1 px-3 rounded-lg bg-[#1f2638] hover:bg-[#283248] text-slate-200 text-[11px] font-bold cursor-pointer transition">
                      Ganti File Mockup
                      <input type="file" accept="image/*" onChange={handleDesignUpload} className="hidden" />
                    </label>
                  </div>

                  {/* Smart Compression Status Pill */}
                  {compressionStats ? (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-center justify-between font-mono">
                      <span className="flex items-center gap-1 font-sans font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Optimal 300 DPI ({compressionStats.compressedDimensions.width}x{compressionStats.compressedDimensions.height})</span>
                      </span>
                      <span className="font-bold">
                        {compressionStats.formattedOriginalSize} ➔ {compressionStats.formattedCompressedSize} (-{compressionStats.compressionPercent}%)
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-[#1a2030] border border-[#273248] text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Kualitas HD Siap Cetak SPK</span>
                    </div>
                  )}
                </div>
              ) : (
                <label className="w-full h-44 rounded-2xl border-2 border-dashed border-[#293248] hover:border-rose-500 bg-[#141924] text-xs font-semibold text-slate-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition p-4 text-center">
                  <Upload className="w-6 h-6 text-rose-400" />
                  <span>Pilih File Mockup yang Sudah Jadi</span>
                  <span className="text-[10px] text-slate-400">Otomatis dikompres agar tidak lag & tidak pecah saat cetak</span>
                  <span className="text-[9px] text-slate-500 font-mono">PNG / JPG (Hingga 30MB)</span>
                  <input type="file" accept="image/*" onChange={handleDesignUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Kalkulator Hitung Kustom Sablon DTF Real-Time */}
            <div className="p-4 rounded-2xl bg-[#141926] border-2 border-rose-500/30 shadow-lg space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-xs">
                      Kalkulator Hitung Sablon DTF
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Otomatis terisi & akurat real-time
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Sync</span>
                </span>
              </div>

              {/* 1. Komponen Bahan Kaos */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1 font-semibold">
                    <Tag className="w-3 h-3 text-rose-400" />
                    <span>1. Bahan Kaos:</span>
                  </span>
                  <span className="text-white font-mono font-bold">
                    Rp {garmentUnitPrice.toLocaleString('id-ID')}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate pl-4">
                  {selectedGarmentName || '-'} · {isOwnMaterial ? 'Bahan sendiri' : sleeveType || 'Model lengan belum dipilih'} ({garmentColor || '-'})
                </p>
              </div>

              {/* 2. Komponen Sisi Sablon DTF */}
              <div className="space-y-1.5 pt-1.5 border-t border-[#1d2538]">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1 font-semibold">
                    <Layers className="w-3 h-3 text-amber-400" />
                    <span>2. Sablon DTF ({placements.length} Sisi):</span>
                  </span>
                  <span className="text-amber-300 font-mono font-bold">
                    +Rp {sablonCostPerPcs.toLocaleString('id-ID')}
                  </span>
                </div>
                
                <div className="pl-4 space-y-1">
                  {placements.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-[10.5px] text-slate-400">
                      <span className="truncate max-w-[190px]">
                        • Sisi #{idx + 1} {p.placement || 'posisi belum dipilih'} ({p.printSize ? p.printSize.split('(')[0].trim() : '-'})
                      </span>
                      <span className="text-slate-200 font-mono">
                        Rp {p.price.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Subtotal per Pcs */}
              <div className="pt-2 border-t border-[#1d2538] flex justify-between items-center text-slate-200 font-bold bg-[#182033] p-2.5 rounded-xl border border-[#273550]">
                <div>
                  <span className="block text-[11px]">Harga Satuan (Baju + Sablon):</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Rp {garmentUnitPrice.toLocaleString('id-ID')} + Rp {sablonCostPerPcs.toLocaleString('id-ID')}
                  </span>
                </div>
                <span className="text-rose-400 font-mono text-sm font-extrabold">
                  Rp {unitPriceFinal.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400">/pcs</span>
                </span>
              </div>

              {/* 4. Quantity Multiplier & Quick Presets */}
              <div className="pt-1 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">
                    Jumlah Pesanan (Qty):
                  </span>
                  <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {totalPieces} pcs
                  </span>
                </div>

                {/* Quick Add Presets to help user fill calculator quickly */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 shrink-0">Set Qty:</span>
                  <button
                    type="button"
                    onClick={() => setSizeMatrix({ S: 0, M: 0, L: 1, XL: 0, XXL: 0, '3XL': 0 })}
                    className="px-2 py-0.5 text-[9px] rounded-md bg-[#1f273d] hover:bg-[#28334e] text-slate-300 font-mono cursor-pointer"
                  >
                    1 pcs
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeMatrix({ S: 1, M: 2, L: 2, XL: 1, XXL: 0, '3XL': 0 })}
                    className="px-2 py-0.5 text-[9px] rounded-md bg-[#1f273d] hover:bg-[#28334e] text-slate-300 font-mono cursor-pointer"
                  >
                    6 (1/2 Lusin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeMatrix({ S: 2, M: 4, L: 4, XL: 2, XXL: 0, '3XL': 0 })}
                    className="px-2 py-0.5 text-[9px] rounded-md bg-[#1f273d] hover:bg-[#28334e] text-slate-300 font-mono cursor-pointer"
                  >
                    12 (1 Lusin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeMatrix({ S: 4, M: 8, L: 8, XL: 4, XXL: 0, '3XL': 0 })}
                    className="px-2 py-0.5 text-[9px] rounded-md bg-[#1f273d] hover:bg-[#28334e] text-slate-300 font-mono cursor-pointer"
                  >
                    24 (2 Lusin)
                  </button>
                </div>
              </div>

              {/* 5. Grand Total Akhir */}
              <div className="pt-2 border-t-2 border-[#2b354d] flex justify-between items-center">
                <div>
                  <span className="block text-[11px] font-black text-white uppercase tracking-wider">
                    Total Kalkulasi:
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Rp {unitPriceFinal.toLocaleString('id-ID')} × {totalPieces} pcs
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg text-rose-400 font-mono font-black block leading-none">
                    Rp {grandTotalPrice.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-medium">
                    ✓ Hitung Akurat Real-Time
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Export SPK & Add to Cart */}
            <div className="space-y-2">
              {!isComplete && (
                <p className="text-[10px] text-amber-300 text-center">
                  Lengkapi dulu: {missing.join(', ')}.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDirectPrintSpk}
                  disabled={!isComplete}
                  className="disabled:opacity-40 disabled:cursor-not-allowed py-2.5 px-3 rounded-xl bg-[#1c2232] hover:bg-[#252e42] border border-[#29354d] text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-400" />
                  <span>Cetak SPK</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSpkPdf}
                  disabled={!isComplete}
                  className="disabled:opacity-40 disabled:cursor-not-allowed py-2.5 px-3 rounded-xl bg-[#1c2232] hover:bg-[#252e42] border border-[#29354d] text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-rose-400" />
                  <span>Export SPK PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!isComplete}
                className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>+ MASUKKAN KE KERANJANG KASIR</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
