import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Monitor,
  ShoppingBag,
  Store,
  QrCode,
  Sparkles,
  X,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

interface CustomerDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerDisplayModal: React.FC<CustomerDisplayModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { cart, storeSettings, currentUser } = useApp();

  if (!isOpen) return null;

  const rawSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const baseForTax = Math.max(0, rawSubtotal - itemDiscounts);

  const taxAmount = storeSettings.enableTax
    ? Math.round(baseForTax * (storeSettings.taxRatePercent / 100))
    : 0;
  const serviceCharge = storeSettings.enableServiceCharge
    ? Math.round(baseForTax * (storeSettings.serviceChargePercent / 100))
    : 0;

  const grandTotal = baseForTax + taxAmount + serviceCharge;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 overflow-hidden animate-in fade-in">
      <div className="bg-[#0f121a] rounded-3xl shadow-2xl border-2 border-[#2b354c] w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-white relative">
        {/* Top Customer Display Header */}
        <div className="p-4 sm:p-5 bg-[#141924] border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 overflow-hidden border border-white/20">
              {storeSettings.logoUrl ? (
                <img
                  src={storeSettings.logoUrl}
                  alt="Logo Toko"
                  className="w-full h-full object-contain p-1.5 bg-[#0b0e14]"
                />
              ) : (
                <Store className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="font-panchang font-extrabold text-base sm:text-lg tracking-wide uppercase">
                {storeSettings.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE'}
              </h2>
              <p className="text-xs text-slate-400">
                Selamat Datang! Dilayani oleh Kasir: <strong className="text-white">{currentUser?.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Layar Pelanggan Aktif</span>
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-[#1e2536] hover:bg-[#283248] text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Columns: Left (Scanned Items) & Right (Totals & QRIS) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT: Items List (7 cols) */}
          <div className="lg:col-span-7 p-4 sm:p-6 overflow-y-auto border-r border-[#212a3d] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Daftar Belanja Anda ({cart.reduce((s, i) => s + i.qty, 0)} Pcs)
              </h3>

              {cart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-[#161c28] flex items-center justify-center text-slate-600">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-300">
                      Menunggu Pemindaian Produk...
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Kasir sedang memindai belanjaan Anda. Item akan muncul secara otomatis di layar ini.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[#151a26] border border-[#212a3d] flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-3">
                        <h4 className="font-bold text-sm text-white truncate leading-tight">
                          {item.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.qty} x Rp {item.price.toLocaleString('id-ID')}
                        </p>
                        {item.notes && (
                          <span className="text-[10px] text-amber-300 italic block mt-0.5">
                            {item.notes}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-sm text-rose-400 font-mono whitespace-nowrap">
                        Rp {(item.qty * item.price - (item.discountAmount || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Slogan */}
            <div className="pt-4 border-t border-[#1f2638] text-xs text-slate-500 flex items-center justify-between">
              <span>{storeSettings.tagline}</span>
              <span>{storeSettings.phone}</span>
            </div>
          </div>

          {/* RIGHT: Grand Total & Live QRIS (5 cols) */}
          <div className="lg:col-span-5 p-4 sm:p-6 bg-[#131722] flex flex-col justify-between space-y-4">
            {/* Grand Total Highlight Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-rose-950/40 via-[#191f2e] to-[#121622] border-2 border-rose-500/40 shadow-xl space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Total Yang Harus Dibayar:
              </span>
              <span className="font-black text-3xl sm:text-4xl text-rose-400 font-mono tracking-tight block">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>

              <div className="space-y-1 pt-3 border-t border-[#273248] text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal Belanja</span>
                  <span className="text-white font-medium">Rp {rawSubtotal.toLocaleString('id-ID')}</span>
                </div>
                {itemDiscounts > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Diskon Hemat</span>
                    <span>-Rp {itemDiscounts.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {storeSettings.enableTax && (
                  <div className="flex justify-between">
                    <span>PPN ({storeSettings.taxRatePercent}%)</span>
                    <span className="text-white font-medium">Rp {taxAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* QRIS Direct Scan */}
            <div className="p-4 rounded-3xl bg-[#161a26] border border-[#222a3d] text-center space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-200">
                <QrCode className="w-4 h-4 text-rose-400" />
                <span>Bayar Instan dengan Scan QRIS</span>
              </div>
              <div className="p-2.5 bg-white rounded-2xl inline-block shadow-md">
                <img
                  src={storeSettings.qrisImageUrl}
                  alt="QRIS Pelanggan"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain mx-auto"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Scan via GoPay, BCA, Livin, OVO, Dana, ShopeePay, atau Bank apa saja.
              </p>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-slate-400 italic">
              {storeSettings.receiptFooter}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
