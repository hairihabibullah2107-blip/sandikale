import React, { useState, useEffect, useRef } from 'react';
import { scanBeep, useBarcodeWedge } from '../lib/scanner';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useApp } from '../context/AppContext';
import { Product, CartItem } from '../types';
import {
  Search,
  ScanBarcode,
  Camera,
  Plus,
  Minus,
  Trash2,
  Tag,
  Percent,
  Receipt,
  PauseCircle,
  CreditCard,
  User,
  ShoppingBag,
  Sparkles,
  Edit3,
  X,
  FileText,
} from 'lucide-react';

interface PosViewProps {
  onOpenPayment: (data: { customerName: string; customerPhone: string; discountTotal: number }) => void;
  onOpenCustomItem: () => void;
  onOpenHeldModal: () => void;
}

export const PosView: React.FC<PosViewProps> = ({
  onOpenPayment,
  onOpenCustomItem,
  onOpenHeldModal,
}) => {
  const {
    products,
    categories,
    cart,
    addToCart,
    soundMuted,
    updateCartItemQty,
    updateCartItem,
    removeFromCart,
    clearCart,
    holdCurrentCart,
    heldOrders,
    storeSettings,
    addNotification,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('Semua Produk');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Global Cart Discount
  const [discountType, setDiscountType] = useState<'percent' | 'nominal'>('nominal');
  const [discountInput, setDiscountInput] = useState<string>('0');

  // Item edit modal / state
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [itemNoteEdit, setItemNoteEdit] = useState('');
  const [itemDiscountEdit, setItemDiscountEdit] = useState(0);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'Semua Produk' || p.category === selectedCategory;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    return matchCat && matchSearch;
  });

  // Handle barcode scanner submission
  // Satu pintu untuk semua sumber scan: kolom input, scanner USB/Bluetooth, dan kamera.
  const processScan = (raw: string): string | null => {
    const code = raw.trim();
    if (!code) return null;
    const matched = products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );
    if (!matched) {
      scanBeep(false, soundMuted);
      addNotification(`Barcode "${code}" tidak ditemukan dalam sistem!`, 'warning');
      return null;
    }
    if (matched.stock <= 0) {
      scanBeep(false, soundMuted);
      addNotification(`Produk "${matched.name}" telah habis!`, 'warning');
      return null;
    }
    addToCart(matched, 1);
    scanBeep(true, soundMuted);
    addNotification(`Scanned: ${matched.name}`, 'success');
    return matched.name;
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;
    const found = processScan(barcodeQuery);
    if (found) setBarcodeQuery('');
    barcodeInputRef.current?.focus();
  };

  const [scannerOpen, setScannerOpen] = useState(false);
  useBarcodeWedge((code) => {
    processScan(code);
  }, !scannerOpen);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Hold Bill
      if (e.key === 'F2') {
        e.preventDefault();
        handleHoldBill();
      }
      // F4: Custom Item
      if (e.key === 'F4') {
        e.preventDefault();
        onOpenCustomItem();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerName]);

  // Calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const subtotalAfterItemDiscount = Math.max(0, rawSubtotal - itemDiscounts);

  // Calculate order discount
  const discountVal = parseFloat(discountInput) || 0;
  const calculatedOrderDiscount =
    discountType === 'percent'
      ? Math.round(subtotalAfterItemDiscount * (Math.min(100, Math.max(0, discountVal)) / 100))
      : Math.min(subtotalAfterItemDiscount, Math.max(0, discountVal));

  const totalDiscount = itemDiscounts + calculatedOrderDiscount;
  const baseForTax = Math.max(0, rawSubtotal - totalDiscount);

  const taxAmount = storeSettings.enableTax
    ? Math.round(baseForTax * (storeSettings.taxRatePercent / 100))
    : 0;
  const serviceCharge = storeSettings.enableServiceCharge
    ? Math.round(baseForTax * (storeSettings.serviceChargePercent / 100))
    : 0;

  const grandTotal = baseForTax + taxAmount + serviceCharge;

  // HP & tablet portrait: daftar produk dan keranjang bergantian layar penuh
  const [mobileCart, setMobileCart] = useState(false);
  useEffect(() => {
    if (cart.length === 0) setMobileCart(false);
  }, [cart.length]);
  const totalCartQty = cart.reduce((sum, i) => sum + i.qty, 0);

  // Hold current cart
  const handleHoldBill = () => {
    if (cart.length === 0) {
      addNotification('Keranjang masih kosong, tidak ada yang dapat ditahan.', 'warning');
      return;
    }
    const name = customerName.trim() || 'Pelanggan Walk-in';
    const held = holdCurrentCart(name, 'Antrean Kasir', calculatedOrderDiscount);
    if (held) {
      setCustomerName('');
      setCustomerPhone('');
      setDiscountInput('0');
    }
  };

  // Open checkout modal
  const handlePayClick = () => {
    if (cart.length === 0) return;
    onOpenPayment({
      customerName: customerName.trim() || 'Pelanggan Umum',
      customerPhone: customerPhone.trim(),
      discountTotal: calculatedOrderDiscount,
    });
  };

  const openItemEdit = (item: CartItem) => {
    setEditingItem(item);
    setItemNoteEdit(item.notes || '');
    setItemDiscountEdit(item.discountAmount || 0);
  };

  const saveItemEdit = () => {
    if (!editingItem) return;
    updateCartItem(editingItem.id, {
      notes: itemNoteEdit.trim() || undefined,
      discountAmount: itemDiscountEdit,
    });
    setEditingItem(null);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#0d1017]">
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => processScan(code)}
      />
      {/* LEFT: Product Catalog, Category Filters & Barcode Scan */}
      <div
        className={`flex-1 min-h-0 flex-col h-full overflow-hidden border-r border-[#1f2638] ${
          mobileCart ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Top Search & Barcode Bar */}
        <div className="p-3 sm:p-4 bg-[#131722] border-b border-[#1f2638] flex flex-wrap gap-2.5 items-center justify-between">
          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk, SKU, barcode (F1)..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#191f2e] border border-[#273248] text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>

          {/* Barcode Fast Scanner Form */}
          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-1.5">
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                placeholder="Scan barcode..."
                className="w-36 sm:w-44 px-3 py-2 text-xs rounded-xl bg-[#191f2e] border border-[#273248] text-white font-mono placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500"
              />
              <ScanBarcode className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            >
              Scan
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              title="Scan dengan kamera"
              aria-label="Scan dengan kamera"
              className="px-2.5 py-2 bg-[#1e2538] hover:bg-[#273048] border border-[#2d3852] text-slate-200 rounded-xl transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-rose-400" />
            </button>
          </form>

          {/* Custom Non-Catalog Item Button */}
          <button
            onClick={onOpenCustomItem}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1e2538] hover:bg-[#273048] border border-[#2d3852] text-slate-200 text-xs font-bold transition cursor-pointer"
            title="Tambah item custom atau jasa manual (F4)"
          >
            <Plus className="w-3.5 h-3.5 text-rose-400" />
            <span>+ Item Custom</span>
          </button>
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="px-3 py-2 bg-[#10141e] border-b border-[#1f2638] flex items-center gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.name
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
                  : 'bg-[#171d2b] border border-[#232b3e] text-slate-300 hover:text-white hover:bg-[#1f2638]'
              }`}
            >
              <Tag className="w-3 h-3 text-rose-300" />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500">
              <ShoppingBag className="w-12 h-12 mb-2 opacity-30 text-slate-400" />
              <p className="font-semibold text-sm text-slate-300">Tidak ada produk yang cocok</p>
              <p className="text-xs text-slate-500">Coba ganti kata kunci pencarian atau scan barcode</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0 && p.category !== 'Jasa & Percetakan';
                const isLowStock = p.stock <= p.minStock && p.category !== 'Jasa & Percetakan';

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p, 1)}
                    className={`group bg-[#151926] border border-[#222a3d] hover:border-rose-500/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isOutOfStock ? 'opacity-40 grayscale pointer-events-none' : ''
                    }`}
                  >
                    {/* Image Area */}
                    <div className="relative aspect-square w-full bg-[#1a2030] overflow-hidden">
                      <img
                        src={p.img}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-md bg-black/75 text-slate-200 backdrop-blur-xs">
                        {p.category}
                      </span>
                      {isLowStock && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-black shadow-xs">
                          Sisa {p.stock}
                        </span>
                      )}
                      {isOutOfStock && (
                        <span className="absolute inset-0 bg-black/75 flex items-center justify-center font-bold text-xs text-rose-400">
                          STOK HABIS
                        </span>
                      )}
                    </div>

                    {/* Metadata & Price */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-rose-300 transition-colors line-clamp-2 leading-tight">
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-[#222a3d] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block -mb-0.5">Harga</span>
                          <span className="font-extrabold text-xs sm:text-sm text-rose-400">
                            Rp {p.sellingPrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <span className="w-7 h-7 rounded-xl bg-[#1e2538] text-rose-300 border border-[#2d3852] flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition">
                          <Plus className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bilah keranjang (HP & tablet portrait) */}
        {cart.length > 0 && (
          <button
            onClick={() => setMobileCart(true)}
            className="lg:hidden shrink-0 m-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white font-extrabold flex items-center justify-between shadow-lg cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm">
              <Receipt className="w-4 h-4" />
              <span>Keranjang ({totalCartQty} item)</span>
            </span>
            <span className="font-mono text-sm">Rp {grandTotal.toLocaleString('id-ID')} &rsaquo;</span>
          </button>
        )}
      </div>

      {/* RIGHT: Active Shopping Cart / Register Panel */}
      <div
        className={`w-full lg:w-96 min-h-0 bg-[#131622] flex-col justify-between shadow-2xl z-10 border-t lg:border-t-0 lg:border-l border-[#1f2638] ${
          mobileCart ? 'flex flex-1' : 'hidden lg:flex'
        }`}
      >
        <button
          onClick={() => setMobileCart(false)}
          className="lg:hidden shrink-0 px-4 py-3 text-left text-xs font-bold text-rose-300 bg-[#161a28] border-b border-[#1f2638] cursor-pointer"
        >
          &lsaquo; Kembali ke daftar produk
        </button>

        {/* Customer Header & Held Badge */}
        <div className="p-3.5 border-b border-[#1f2638] bg-[#161a28] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-400" />
              <h3 className="font-black text-sm text-white">Keranjang Kasir</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {totalCartQty} item
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-slate-400 hover:text-rose-400 font-bold transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Customer Input */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Pelanggan..."
                className="w-full pl-7 pr-2 py-1.5 rounded-xl bg-[#1a2030] border border-[#273248] text-white text-xs outline-none focus:ring-1 focus:ring-rose-500 placeholder-slate-400"
              />
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>
            <div>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="No WhatsApp (Opsional)"
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#1a2030] border border-[#273248] text-white text-xs outline-none focus:ring-1 focus:ring-rose-500 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[360px] lg:max-h-none">
          {cart.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-500 text-center p-6">
              <Receipt className="w-12 h-12 mb-3 opacity-20 text-slate-400" />
              <p className="text-sm font-bold text-slate-300">Keranjang Masih Kosong</p>
              <p className="text-xs mt-1 text-slate-400">Pilih produk dari katalog atau scan barcode untuk transaksi baru.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#181d2a] border border-[#222a3d] flex items-start gap-2.5 hover:border-[#2f3952] transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h5 className="font-bold text-xs text-white leading-tight truncate">
                      {item.name}
                    </h5>
                    <button
                      onClick={() => openItemEdit(item)}
                      className="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer"
                      title="Edit diskon item & catatan"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  {item.notes && (
                    <p className="text-[10px] text-amber-300/90 italic mt-0.5">
                      Catatan: {item.notes}
                    </p>
                  )}

                  {item.discountAmount > 0 && (
                    <p className="text-[10px] text-rose-400 font-semibold mt-0.5">
                      Diskon: -Rp {item.discountAmount.toLocaleString('id-ID')}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-black text-rose-400 font-mono">
                      Rp {(item.price * item.qty - (item.discountAmount || 0)).toLocaleString('id-ID')}
                    </span>

                    {/* Stepper Buttons */}
                    <div className="flex items-center gap-1.5 bg-[#121622] px-1.5 py-0.5 rounded-lg border border-[#273248]">
                      <button
                        onClick={() => updateCartItemQty(item.id, -1)}
                        className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#20273a] transition cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-white">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateCartItemQty(item.id, 1)}
                        className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#20273a] transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                  title="Hapus item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Cart Bottom Summary & Checkout Button */}
        <div className="p-4 bg-[#161a28] border-t border-[#1f2638] space-y-3">
          {/* Subtotal & Diskon Nota */}
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal Item</span>
              <span className="font-semibold text-slate-200">
                Rp {rawSubtotal.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Quick Discount Input */}
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1 text-slate-300">
                <Percent className="w-3 h-3 text-rose-400" />
                <span>Diskon Nota</span>
              </span>
              <div className="flex items-center gap-1">
                <div className="flex rounded-lg overflow-hidden border border-[#273248] text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType('nominal')}
                    className={`px-1.5 py-0.5 font-bold ${
                      discountType === 'nominal' ? 'bg-rose-600 text-white' : 'bg-[#1a2030] text-slate-400'
                    }`}
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-1.5 py-0.5 font-bold ${
                      discountType === 'percent' ? 'bg-rose-600 text-white' : 'bg-[#1a2030] text-slate-400'
                    }`}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-20 px-2 py-0.5 rounded-lg bg-[#1a2030] border border-[#273248] text-right font-bold text-xs text-rose-400 outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-rose-400 font-semibold">
                <span>Total Diskon Terpasang</span>
                <span>-Rp {totalDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}

            {storeSettings.enableTax && (
              <div className="flex justify-between">
                <span>PPN ({storeSettings.taxRatePercent}%)</span>
                <span className="font-semibold text-slate-200">
                  Rp {taxAmount.toLocaleString('id-ID')}
                </span>
              </div>
            )}

            {storeSettings.enableServiceCharge && (
              <div className="flex justify-between">
                <span>Biaya Layanan ({storeSettings.serviceChargePercent}%)</span>
                <span className="font-semibold text-slate-200">
                  Rp {serviceCharge.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="pt-2 border-t border-dashed border-[#273248] flex justify-between items-baseline">
            <span className="font-extrabold text-sm text-white">TOTAL AKHIR</span>
            <span className="font-black text-xl text-rose-400 font-mono tracking-tight">
              Rp {grandTotal.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Action Buttons: Hold Bill & Checkout */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handleHoldBill}
              disabled={cart.length === 0}
              className="py-3 px-2 rounded-xl bg-[#1e2538] hover:bg-[#273248] border border-[#2d3852] text-amber-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer disabled:opacity-40"
              title="Tahan Pesanan (F2)"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Hold (F2)</span>
            </button>

            <button
              type="button"
              onClick={handlePayClick}
              disabled={cart.length === 0}
              className="col-span-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition transform active:scale-98 disabled:opacity-40 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>BAYAR SEKARANG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Item Edit Modal (Catatan & Diskon Khusus) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#151926] rounded-2xl p-5 border border-[#242c3e] max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#212738]">
              <h4 className="font-bold text-sm text-white">Edit Item: {editingItem.name}</h4>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Catatan Khusus (Contoh: Tanpa Gula / Warna Khusus)
              </label>
              <input
                type="text"
                value={itemNoteEdit}
                onChange={(e) => setItemNoteEdit(e.target.value)}
                placeholder="Masukkan catatan item..."
                className="w-full p-2.5 rounded-xl bg-[#1c2232] border border-[#2a354c] text-white text-xs outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Potongan Diskon Item (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={itemDiscountEdit}
                onChange={(e) => setItemDiscountEdit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full p-2.5 rounded-xl bg-[#1c2232] border border-[#2a354c] text-rose-400 font-bold text-sm outline-none focus:ring-1 focus:ring-rose-500 font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2 rounded-xl bg-[#20273a] text-slate-300 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={saveItemEdit}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-900/30"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
