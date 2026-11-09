import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentMethod, Order } from '../types';
import {
  Banknote,
  QrCode,
  CreditCard,
  Building2,
  CheckCircle2,
  X,
  Delete,
  ShieldCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutData: {
    customerName: string;
    customerPhone?: string;
    discountTotal: number;
  };
  onPaymentSuccess: (order: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  checkoutData,
  onPaymentSuccess,
}) => {
  const { cart, storeSettings, processCheckout, addNotification } = useApp();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashInput, setCashInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const cashInputRef = useRef<HTMLInputElement>(null);
  const [dpInput, setDpInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDpInput('');
    }
  }, [isOpen]);

  // Auto-focus physical keyboard input when Cash is selected
  useEffect(() => {
    if (isOpen && paymentMethod === 'Cash') {
      setTimeout(() => {
        cashInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, paymentMethod]);

  if (!isOpen) return null;

  // Calculate bill total
  const rawSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const totalDiscount = itemDiscounts + (checkoutData.discountTotal || 0);
  const baseForTax = Math.max(0, rawSubtotal - totalDiscount);

  const taxAmount = storeSettings.enableTax
    ? Math.round(baseForTax * (storeSettings.taxRatePercent / 100))
    : 0;
  const serviceCharge = storeSettings.enableServiceCharge
    ? Math.round(baseForTax * (storeSettings.serviceChargePercent / 100))
    : 0;

  const grandTotal = baseForTax + taxAmount + serviceCharge;

  // Numeric cash received directly typed or from quick buttons
  const customItem = cart.find((i) => !!i.customDetails);
  const hasCustom = !!customItem;
  // Kolom DP terisi => pesanan DP. Kosong => uang pas / kembalian dibaca otomatis.
  const dpAmount = parseInt(dpInput, 10) || 0;
  const dpEnabled = dpAmount > 0;
  const dpInvalid = dpEnabled && dpAmount >= grandTotal;
  const cashTyped = parseInt(cashInput, 10) || 0;
  const cashEmpty = cashInput.trim() === '';
  const numPaid = dpEnabled
    ? dpAmount
    : paymentMethod === 'Cash'
    ? cashEmpty
      ? grandTotal
      : cashTyped
    : grandTotal;
  const change = dpEnabled ? 0 : Math.max(0, numPaid - grandTotal);
  const isUnderpaid = !dpEnabled && paymentMethod === 'Cash' && !cashEmpty && cashTyped < grandTotal;

  // Quick cash chips
  const quickCashOptions = [
    grandTotal, // Uang pas
    Math.ceil(grandTotal / 10000) * 10000,
    Math.ceil(grandTotal / 50000) * 50000,
    100000,
    200000,
    500000,
  ].filter((v, i, a) => v >= grandTotal && a.indexOf(v) === i).slice(0, 5);

  const handleNumpad = (key: string) => {
    if (key === 'CLEAR') {
      setCashInput('');
      cashInputRef.current?.focus();
    } else if (key === 'BACK') {
      setCashInput((prev) => prev.slice(0, -1));
      cashInputRef.current?.focus();
    } else if (key === '00' || key === '000') {
      if (!cashInput || cashInput === '0') return;
      setCashInput((prev) => prev + key);
      cashInputRef.current?.focus();
    } else {
      setCashInput((prev) => {
        if (prev === '0') return key;
        return prev + key;
      });
      cashInputRef.current?.focus();
    }
  };

  const GENERIC_NAME = /^pelanggan (umum|custom sablon)$/i;
  const cartName = checkoutData.customerName?.trim() || '';
  const customName = customItem?.customDetails?.customerName || '';
  const resolvedName =
    (!cartName || GENERIC_NAME.test(cartName)) && customName && !GENERIC_NAME.test(customName)
      ? customName
      : cartName || customName;

  const handleCompletePayment = async () => {
    if (dpInvalid) {
      addNotification('Nominal DP harus kurang dari total tagihan. Kosongkan kolom DP untuk bayar penuh.', 'warning');
      return;
    }
    if (dpEnabled && (!resolvedName || GENERIC_NAME.test(resolvedName))) {
      addNotification('Isi nama pelanggan terlebih dahulu untuk pesanan DP.', 'warning');
      return;
    }
    if (isUnderpaid) {
      addNotification('Uang yang dibayarkan kurang dari total tagihan!', 'warning');
      cashInputRef.current?.focus();
      return;
    }

    setIsProcessing(true);
    // Realistic system loading animation
    setTimeout(async () => {
      try {
        const order = await processCheckout({
          customerName: resolvedName,
          customerPhone:
            checkoutData.customerPhone ||
            customItem?.customDetails?.customerPhone,
          discountTotal: checkoutData.discountTotal,
          paymentMethod,
          amountPaid: numPaid,
          dp: dpEnabled,
        });

        setIsProcessing(false);
        onPaymentSuccess(order);
        onClose();
      } catch (err: any) {
        setIsProcessing(false);
        addNotification(`Gagal memproses pembayaran: ${err?.message || 'Error'}`, 'warning');
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#212738] flex items-center justify-between bg-[#151a28]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-700 to-amber-600 flex items-center justify-center text-white shadow-md">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Pembayaran Kasir</h3>
              <p className="text-xs text-slate-400">
                Pelanggan: <strong className="text-white">{checkoutData.customerName}</strong>
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

        {/* Body Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Payment Methods & Details (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Grand Total Display */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-[#181d2c] to-[#121622] border border-rose-500/30">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Total Yang Harus Dibayar:
              </span>
              <span className="font-black text-2xl sm:text-3xl text-rose-400 font-mono tracking-tight block mt-1">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 mt-2 border-t border-[#263148]">
                <span>Item Belanja: {cart.reduce((s, i) => s + i.qty, 0)} pcs</span>
                {totalDiscount > 0 && (
                  <span className="text-rose-400 font-bold">
                    Hemat: Rp {totalDiscount.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>

            {/* Payment Method Selector Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Pilih Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Cash', label: 'Tunai (Cash)', icon: Banknote },
                  { id: 'QRIS', label: 'QRIS', icon: QrCode },
                  { id: 'Debit', label: 'Kartu Debit', icon: CreditCard },
                  { id: 'Kredit', label: 'Kartu Kredit', icon: CreditCard },
                  { id: 'Transfer_BCA', label: 'BCA Transfer', icon: Building2 },
                  { id: 'Transfer_Mandiri', label: 'Mandiri Transfer', icon: Building2 },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = paymentMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPaymentMethod(item.id as PaymentMethod)}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'border-rose-500 bg-rose-950/30 text-rose-300 shadow-md ring-1 ring-rose-500/50'
                          : 'border-[#222a3d] bg-[#161a26] text-slate-300 hover:bg-[#1c2232]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-center text-[11px] leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QRIS Display View */}
            {paymentMethod === 'QRIS' && (
              <div className="p-4 rounded-2xl bg-[#171c2b] border border-[#273248] text-center space-y-3">
                <span className="text-xs font-bold text-slate-200 block">
                  Scan QRIS untuk Pembayaran Otomatis
                </span>
                <div className="p-3 bg-white rounded-2xl inline-block shadow-md">
                  <img
                    src={storeSettings.qrisImageUrl}
                    alt="QRIS POS"
                    className="w-44 h-44 object-contain mx-auto"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Mendukung GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin, LinkAja & Seluruh Mobile Banking.
                </p>
              </div>
            )}

            {/* Card / Transfer Reference Input */}
            {(paymentMethod === 'Debit' ||
              paymentMethod === 'Kredit' ||
              paymentMethod.startsWith('Transfer')) && (
              <div className="p-4 rounded-2xl bg-[#171c2b] border border-[#273248] space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Nomor Referensi EDC / Bukti Transfer
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Cth: REF-884920482..."
                  className="w-full p-2.5 rounded-xl bg-[#121622] border border-[#273248] text-white font-mono text-xs outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            )}
          </div>

          {/* RIGHT: Keyboard Input, Fast Cash Chips, Virtual Numpad & Kembalian (6 cols) */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-300">Kolom DP (Uang Muka)</span>
                <span className="text-[10px] text-slate-400 text-right">Kosongkan jika bayar penuh</span>
              </div>
              <input
                type="number"
                min="0"
                value={dpInput}
                onChange={(e) => setDpInput(e.target.value)}
                placeholder="Isi nominal DP jika belum dilunasi"
                className="w-full p-2.5 rounded-xl bg-[#0c0e14] border border-[#273248] text-white font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex gap-1.5">
                {[30, 50, 70].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDpInput(String(Math.round((grandTotal * pct) / 100)))}
                    className="flex-1 py-1.5 rounded-lg bg-[#1f2638] hover:bg-[#283248] text-slate-200 text-[11px] font-bold cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
                {dpInput !== '' && (
                  <button
                    type="button"
                    onClick={() => setDpInput('')}
                    className="px-3 py-1.5 rounded-lg bg-[#281318] text-rose-300 text-[11px] font-bold cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
              </div>
              {dpInvalid && (
                <p className="text-[11px] text-rose-400 font-semibold">
                  DP harus kurang dari total tagihan. Kosongkan kolom DP untuk bayar penuh.
                </p>
              )}
            </div>

            {dpEnabled ? (
              <div className="p-4 rounded-2xl bg-[#161a26] border border-amber-500/30 space-y-3">
                <span className="text-xs font-bold text-amber-300 block">
                  Pesanan DP - uang muka diterima via {paymentMethod}
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#0c0e14] border border-[#222a3d]">
                    <span className="text-slate-400 block">Total</span>
                    <strong className="font-mono text-white">Rp {grandTotal.toLocaleString('id-ID')}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0c0e14] border border-emerald-500/30">
                    <span className="text-slate-400 block">DP</span>
                    <strong className="font-mono text-emerald-300">Rp {dpAmount.toLocaleString('id-ID')}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0c0e14] border border-amber-500/30">
                    <span className="text-slate-400 block">Sisa</span>
                    <strong className="font-mono text-amber-300">
                      Rp {Math.max(0, grandTotal - dpAmount).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Nota otomatis mencetak sisa pembayaran. Pelunasan dilakukan dari Riwayat Transaksi.</p>
              </div>
            ) : paymentMethod === 'Cash' ? (
              <>
                {/* Direct Physical Keyboard Input Card */}
                <div className="p-4 rounded-2xl bg-[#161a26] border border-[#222a3d] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Uang Diterima (kosongkan = uang pas)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCashInput(String(grandTotal));
                        cashInputRef.current?.focus();
                      }}
                      className="text-[11px] font-bold text-rose-400 hover:underline cursor-pointer"
                    >
                      Uang Pas (Rp {grandTotal.toLocaleString('id-ID')})
                    </button>
                  </div>

                  {/* Accessible native input so physical keyboard typing works 100% */}
                  <div className="relative">
                    <div className="absolute left-3.5 top-3 text-slate-400 font-mono font-bold text-sm">
                      Rp
                    </div>
                    <input
                      ref={cashInputRef}
                      type="number"
                      min="0"
                      value={cashInput}
                      onChange={(e) => setCashInput(e.target.value)}
                      placeholder={`Ketik nominal uang, cth: ${grandTotal}`}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0f121a] border border-[#263148] text-white font-mono font-black text-xl outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Change (Kembalian) Display */}
                  <div className="p-3 rounded-xl bg-[#111c19] border border-emerald-500/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                        Uang Kembalian:
                      </span>
                      <span className="text-xl font-black text-emerald-300 font-mono">
                        Rp {change.toLocaleString('id-ID')}
                      </span>
                    </div>
                    {isUnderpaid && numPaid > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800">
                        Uang Kurang Rp {(grandTotal - numPaid).toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Cash Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Pilihan Cepat Pecahan Uang (Quick Cash)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {quickCashOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => {
                          setCashInput(String(amount));
                          cashInputRef.current?.focus();
                        }}
                        className="py-2 px-2.5 rounded-xl bg-[#1a2030] hover:bg-[#232b40] border border-[#273248] text-xs font-bold text-slate-200 transition cursor-pointer font-mono text-center"
                      >
                        Rp {amount.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Virtual Touch Numpad */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {['7', '8', '9', 'BACK', '4', '5', '6', 'CLEAR', '1', '2', '3', '00', '0', '000'].map(
                    (key, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleNumpad(key)}
                        className={`py-2.5 rounded-xl text-sm font-bold transition cursor-pointer font-mono ${
                          key === 'CLEAR'
                            ? 'bg-rose-950/40 border border-rose-800 text-rose-300 hover:bg-rose-900/40'
                            : key === 'BACK'
                            ? 'bg-[#20273a] border border-[#2c3750] text-slate-300 hover:bg-[#2b354e]'
                            : 'bg-[#181d2a] border border-[#242c3e] text-white hover:bg-[#222a3d]'
                        }`}
                      >
                        {key === 'BACK' ? <Delete className="w-4 h-4 mx-auto" /> : key}
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              /* Non-Cash Confirmation Details */
              <div className="p-6 rounded-2xl bg-[#161a26] border border-[#222a3d] space-y-4 flex flex-col justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">
                    Pembayaran Non-Tunai ({paymentMethod})
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Pastikan dana sebesar{' '}
                    <strong className="text-white">Rp {grandTotal.toLocaleString('id-ID')}</strong> telah
                    diterima pada mesin EDC, mutasi bank, atau notifikasi QRIS sebelum menyelesaikan transaksi.
                  </p>
                </div>
              </div>
            )}

            {/* Complete Payment Button (menempel di bawah pada layar kecil) */}
            <div className="pt-2 sticky bottom-0 lg:static bg-[#121622] pb-1 -mx-1 px-1 shadow-[0_-10px_16px_-8px_rgba(0,0,0,0.6)] lg:shadow-none">
              <button
                type="button"
                onClick={handleCompletePayment}
                disabled={isProcessing || isUnderpaid || dpInvalid}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 transition transform active:scale-98 disabled:opacity-40 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memproses Transaksi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{dpEnabled ? 'TERIMA DP & CETAK STRUK' : 'SELESAIKAN & CETAK STRUK'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
