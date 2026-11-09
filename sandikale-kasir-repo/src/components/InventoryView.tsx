import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import {
  Package,
  Plus,
  Search,
  Download,
  Trash2,
  Edit2,
  Barcode,
  Printer,
  Layers,
  AlertTriangle,
  X,
  Upload,
  Camera,
  Image as ImageIcon,
  ShieldAlert,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { downloadProductsCatalogPdf } from '../utils/pdfExport';
import { BarcodePrintModal } from './BarcodePrintModal';
import { compressUploadedImage, CompressedImageResult } from '../utils/imageCompressor';

export const InventoryView: React.FC = () => {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    currentUser,
    addNotification,
    runWithExportLoading,
    storeSettings,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('Semua');
  const [barcodePrintProducts, setBarcodePrintProducts] = useState<Product[] | null>(null);

  // Modal Add / Edit Product
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Kaos & Apparel Polos');
  const [costPrice, setCostPrice] = useState<number>(20000);
  const [sellingPrice, setSellingPrice] = useState<number>(35000);
  const [stock, setStock] = useState<number>(50);
  const [minStock, setMinStock] = useState<number>(10);
  const [unit, setUnit] = useState('pcs');
  const [img, setImg] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  // Delete product confirmation state
  const [deleteTargetProduct, setDeleteTargetProduct] = useState<Product | null>(null);

  // Image compression state
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [imgCompressionStats, setImgCompressionStats] = useState<CompressedImageResult | null>(null);

  const confirmDeleteProduct = () => {
    if (!deleteTargetProduct) return;
    deleteProduct(deleteTargetProduct.id);
    setDeleteTargetProduct(null);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File gambar maksimal 25MB');
      return;
    }

    try {
      setIsCompressingImage(true);
      const result = await compressUploadedImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.88,
        preserveTransparency: true,
      });

      setImg(result.dataUrl);
      setImgCompressionStats(result);
      addNotification(
        `Foto produk dioptimasi: ${result.formattedOriginalSize} ➔ ${result.formattedCompressedSize} (Hemat ${result.compressionPercent}%, tetap tajam)`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Gagal mengompres gambar produk.');
    } finally {
      setIsCompressingImage(false);
      e.target.value = '';
    }
  };

  const handleExportPdf = async () => {
    await runWithExportLoading(
      {
        title: 'Membuat Laporan Stok & Katalog (PDF)...',
        subtitle: 'Mengalkulasi nilai modal HPP, stok persediaan, dan menyusun dokumen PDF...',
        type: 'pdf',
      },
      async () => {
        await downloadProductsCatalogPdf(products, storeSettings);
      }
    );
  };

  const openAdd = () => {
    if (!isAdmin) {
      alert('Akses ditolak: Hanya Admin/Owner yang dapat menambahkan produk.');
      return;
    }
    setEditingProd(null);
    setName('');
    setBarcode('899' + Math.floor(1000000 + Math.random() * 9000000));
    setCategory('Kaos & Apparel Polos');
    setCostPrice(20000);
    setSellingPrice(35000);
    setStock(50);
    setMinStock(10);
    setUnit('pcs');
    setImg('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    if (!isAdmin) {
      alert('Akses ditolak: Hanya Admin/Owner yang dapat mengedit produk.');
      return;
    }
    setEditingProd(p);
    setName(p.name);
    setBarcode(p.barcode);
    setCategory(p.category);
    setCostPrice(p.costPrice);
    setSellingPrice(p.sellingPrice);
    setStock(p.stock);
    setMinStock(p.minStock);
    setUnit(p.unit);
    setImg(p.img);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const defaultImg =
      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="%231a1e2b"/><text x="50%" y="50%" fill="%23ffffff" font-family="sans-serif" font-weight="bold" font-size="16" text-anchor="middle">${encodeURIComponent(name.slice(0, 20))}</text></svg>`;

    if (editingProd) {
      updateProduct(editingProd.id, {
        name: name.trim(),
        barcode: barcode.trim(),
        category,
        costPrice,
        sellingPrice,
        stock,
        minStock,
        unit,
        img: img || defaultImg,
      });
    } else {
      addProduct({
        name: name.trim(),
        barcode: barcode.trim(),
        category,
        costPrice,
        sellingPrice,
        stock,
        minStock,
        unit,
        img: img || defaultImg,
      });
    }
    setModalOpen(false);
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCat === 'Semua' || p.category === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    return matchCat && matchSearch;
  });

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1017] p-3 sm:p-5 space-y-4">
      {/* Top Banner */}
      <div className="bg-[#121622] p-4 rounded-2xl border border-[#212738] flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-rose-400" />
              <span>Katalog Produk & Manajemen Stok</span>
            </h2>
            {lowStockCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {lowStockCount} Menipis
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Kelola HPP modal, harga jual, foto produk (upload dari device), dan stok opname kasir.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 rounded-xl bg-[#1a2030] hover:bg-[#232b40] border border-[#273248] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Ekspor PDF</span>
          </button>
          <button
            onClick={() => setBarcodePrintProducts(filtered)}
            disabled={filtered.length === 0}
            className="px-3.5 py-2 rounded-xl bg-[#1a2030] hover:bg-[#232b40] border border-[#273248] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Cetak Barcode</span>
          </button>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Produk</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang, barcode, SKU..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#161a26] border border-[#222a3d] text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedCat('Semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedCat === 'Semua'
                ? 'bg-rose-600 text-white'
                : 'bg-[#161a26] text-slate-400 hover:text-white'
            }`}
          >
            Semua ({products.length})
          </button>
          {categories.filter((c) => c.name !== 'Semua Produk').map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedCat === cat.name
                  ? 'bg-rose-600 text-white'
                  : 'bg-[#161a26] text-slate-400 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 bg-[#121622] rounded-2xl border border-[#212738] overflow-y-auto shadow-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#151a28] text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-[#212738]">
            <tr>
              <th className="p-3">Produk</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">HPP Modal</th>
              <th className="p-3">Harga Jual</th>
              <th className="p-3 text-center">Stok</th>
              <th className="p-3 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2436]">
            {filtered.map((prod) => {
              const isLow = prod.stock <= prod.minStock;
              return (
                <tr key={prod.id} className="hover:bg-[#161a28] transition">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={prod.img}
                        alt={prod.name}
                        className="w-10 h-10 rounded-lg object-cover bg-[#1c2232] border border-[#263148] shrink-0"
                      />
                      <div>
                        <h4 className="font-bold text-white text-xs leading-tight">{prod.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{prod.sku}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Barcode className="w-3 h-3 text-slate-500" />
                            {prod.barcode}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md bg-[#191f2e] border border-[#273248] text-[10px] font-semibold text-slate-300">
                      {prod.category}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-300">
                    Rp {prod.costPrice.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 font-mono font-bold text-rose-400">
                    Rp {prod.sellingPrice.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`font-black text-xs font-mono px-2 py-0.5 rounded-full ${
                        prod.stock <= 0
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                          : isLow
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {prod.stock} {prod.unit}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Fast Stock Steppers */}
                      <button
                        onClick={() => adjustStock(prod.id, 5)}
                        className="px-2 py-1 rounded-lg bg-[#14261c] hover:bg-[#1a3827] text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                        title="Tambah 5 Stok"
                      >
                        +5
                      </button>
                      <button
                        onClick={() => adjustStock(prod.id, -1)}
                        className="px-2 py-1 rounded-lg bg-[#281318] hover:bg-[#38161f] text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer"
                        title="Kurang 1 Stok"
                      >
                        -1
                      </button>

                      {/* Edit (Admin only) */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setBarcodePrintProducts([prod])}
                            className="p-1.5 rounded-lg bg-[#1c2232] hover:bg-[#252e42] text-amber-300 border border-[#273248] cursor-pointer"
                            title="Cetak Barcode Produk"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(prod)}
                            className="p-1.5 rounded-lg bg-[#1c2232] hover:bg-[#252e42] text-slate-300 border border-[#273248] cursor-pointer ml-1"
                            title="Edit Produk"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteTargetProduct(prod)}
                            className="p-1.5 rounded-lg bg-[#281318] hover:bg-rose-900/40 text-rose-400 border border-rose-900/40 cursor-pointer transition"
                            title="Hapus Produk dari Katalog"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Add / Edit Product with Device File Upload */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#121622] rounded-3xl p-6 border border-[#212738] max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#212738]">
              <h3 className="font-extrabold text-base text-white">
                {editingProd ? 'Edit Informasi Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cth: Kaos Combed 20s Heavyweight"
                  className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Barcode / Kode Batang</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="Kaos & Apparel Polos">Kaos & Apparel Polos</option>
                    <option value="Jasa Sablon DTF">Jasa Sablon DTF</option>
                    <option value="Merchandise & Aksesoris">Merchandise & Aksesoris</option>
                    <option value="Paket Usaha & Lainnya">Paket Usaha & Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">HPP Modal (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-rose-400 font-bold font-mono outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Min. Alert</label>
                  <input
                    type="number"
                    min="1"
                    value={minStock}
                    onChange={(e) => setMinStock(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs / cup / sisi"
                    className="w-full p-2.5 rounded-xl bg-[#181d2a] border border-[#273248] text-white outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Upload Foto Produk dari Device */}
              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Upload Foto Produk dari Device (File Gambar)</span>
                  {img && (
                    <button
                      type="button"
                      onClick={() => {
                        setImg('');
                        setImgCompressionStats(null);
                      }}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </label>
                {isCompressingImage ? (
                  <div className="py-3 px-3 rounded-xl border border-[#273248] bg-[#161a26] text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                    <span>Mengompres & Mengoptimasi Foto...</span>
                  </div>
                ) : img ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#161a26] border border-[#273248]">
                      <img src={img} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-[#2f3952]" />
                      <div className="flex-1 text-xs">
                        <p className="font-bold text-white">Foto Produk Terpasang</p>
                        <label className="text-[11px] text-rose-400 hover:underline cursor-pointer inline-block mt-0.5">
                          Ganti Foto dari Device
                          <input type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                    {imgCompressionStats && (
                      <div className="p-1.5 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-center justify-between font-mono">
                        <span className="flex items-center gap-1 font-sans font-bold">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>HD Teroptimasi</span>
                        </span>
                        <span>
                          {imgCompressionStats.formattedOriginalSize} ➔ {imgCompressionStats.formattedCompressedSize} (-{imgCompressionStats.compressionPercent}%)
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="w-full py-3.5 px-3 rounded-xl border border-dashed border-[#29354d] hover:border-rose-500 bg-[#161a26] text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-rose-400" />
                    <span>Pilih Foto Produk dari Komputer / HP</span>
                    <input type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1e2538] text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold shadow-md shadow-rose-950/40"
                >
                  {editingProd ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-app Product Deletion Confirmation Modal */}
      {deleteTargetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#141824] rounded-3xl p-6 border border-rose-900/60 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 flex items-center justify-center border border-rose-800">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">Hapus Produk</h4>
                <span className="text-xs text-rose-300 font-mono font-bold">
                  {deleteTargetProduct.sku}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus produk <strong className="text-white">"{deleteTargetProduct.name}"</strong> secara permanen dari katalog kasir?
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e2538] text-slate-300 font-bold text-xs hover:bg-[#283248] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {barcodePrintProducts && (
        <BarcodePrintModal
          products={barcodePrintProducts}
          onClose={() => setBarcodePrintProducts(null)}
        />
      )}
    </div>
  );
};
