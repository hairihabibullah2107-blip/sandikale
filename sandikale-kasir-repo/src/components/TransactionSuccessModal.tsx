import React from 'react';
import { Order, StoreSettings } from '../types';
import {
  Printer,
  MessageSquare,
  CheckCircle2,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface TransactionSuccessModalProps {
  order: Order | null;
  storeSettings: StoreSettings;
  onClose: () => void;
  onOpenReceipt: (order: Order) => void;
}

export const TransactionSuccessModal: React.FC<TransactionSuccessModalProps> = ({
  order,
  storeSettings,
  onClose,
  onOpenReceipt,
}) => {
  if (!order) return null;

  const handleWhatsApp = () => {
    let cleanPhone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

    const itemsSummary = order.items.map((i) => `  - ${i.qty}x ${i.name}`).join('\n');
    const msg =
      `*${storeSettings.storeName.toUpperCase()} - BUKTI TRANSAKSI LUNAS*\n` +
      `${storeSettings.tagline}\n` +
      `-----------------------------------\n` +
      `No. Struk : ${order.invoiceNumber}\n` +
      `Tanggal   : ${order.date}\n` +
      `Pelanggan : ${order.customerName}\n` +
      `-----------------------------------\n` +
      `${itemsSummary}\n` +
      `-----------------------------------\n` +
      `*Total Belanja:* Rp ${order.grandTotal.toLocaleString('id-ID')}\n` +
      `*Metode Bayar:* ${order.paymentMethod} (Rp ${order.amountPaid.toLocaleString('id-ID')})\n` +
      (order.status === 'dp'
        ? `*SISA TAGIHAN :* Rp ${(order.remainingBalance || 0).toLocaleString('id-ID')}\n`
        : `*Kembalian   :* Rp ${order.change.toLocaleString('id-ID')}\n`) +
      `-----------------------------------\n` +
      `_${storeSettings.receiptFooter}_\n` +
      `Alamat: ${storeSettings.address}\n` +
      `Instagram: ${storeSettings.instagram || '@_sandikale'}`;

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in overflow-hidden">
      {/* Background Animated Celebration Ribbon Streamers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating Paper Airplane 1 */}
        <div className="absolute top-1/4 -left-10 w-24 h-24 opacity-80 animate-bounce">
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl text-rose-500">
            <path d="M10 50 L90 20 L55 85 L45 55 Z" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />
          </svg>
        </div>

        {/* Celebratory Floating Sparkles */}
        <div className="absolute top-12 right-20 text-amber-400 animate-ping">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="absolute bottom-16 left-24 text-rose-400 animate-pulse">
          <Sparkles className="w-7 h-7" />
        </div>
      </div>

      {/* Main Celebration Card */}
      <div className="relative z-20 bg-[#141824] rounded-3xl shadow-2xl border border-rose-500/40 w-full max-w-lg overflow-hidden p-6 sm:p-8 animate-in zoom-in-95 duration-300 animate-glow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Transaksi Berhasil & Lunas
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Animated Celebration Icon */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-rose-950/60 border border-white/20 transform -rotate-3 hover:rotate-0 transition duration-300 overflow-hidden">
            {storeSettings.logoUrl ? (
              <img
                src={storeSettings.logoUrl}
                alt="Logo Toko"
                className="w-full h-full object-contain p-2 bg-[#0d1017]"
              />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-white" />
            )}
          </div>
          <h2 className="font-panchang font-extrabold text-xl sm:text-2xl text-white mt-4 tracking-wide uppercase">
            PEMBAYARAN SUKSES!
          </h2>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Struk transaksi telah tercatat otomatis ke dalam pembukuan kasir & shift aktif.
          </p>
        </div>

        {/* Summary Card */}
        <div className="p-4 rounded-2xl bg-[#191f2e] border border-[#273248] space-y-2.5 mb-6 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-[#232c3f]">
            <span className="text-slate-400">No. Invoice Struk:</span>
            <span className="font-mono font-bold text-white bg-[#121622] px-2.5 py-1 rounded-md border border-[#273248]">
              {order.invoiceNumber}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Nama Pelanggan:</span>
            <span className="font-bold text-white">{order.customerName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Metode Pembayaran:</span>
            <span className="font-bold text-slate-200">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-[#232c3f]">
            <div>
              <span className="text-[11px] text-slate-400 block">Total Belanja</span>
              <span className="font-mono font-black text-xl text-rose-400">
                Rp {order.grandTotal.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">
                {order.status === 'dp' ? 'Sisa Tagihan' : 'Uang Kembalian'}
              </span>
              <span className={`font-mono font-black text-base ${order.status === 'dp' ? 'text-amber-300' : 'text-emerald-400'}`}>
                Rp {(order.status === 'dp' ? order.remainingBalance || 0 : order.change).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                onClose();
                onOpenReceipt(order);
              }}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Cetak Nota Struk</span>
            </button>
            <button
              onClick={handleWhatsApp}
              className="py-3 px-3 rounded-xl bg-[#0f5132] hover:bg-[#146c43] text-emerald-100 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-300" />
              <span>Kirim Struk WA</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1d2334] hover:bg-[#252c42] border border-[#273248] text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>Selesai & Transaksi Baru</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
