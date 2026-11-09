import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import {
  Printer,
  Download,
  Share2,
  CheckCircle2,
  X,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { downloadReceiptPdf } from '../utils/pdfExport';

interface ReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
  const { storeSettings, addNotification, runWithExportLoading } = useApp();

  if (!order) return null;

  const handlePrint = async () => {
    await runWithExportLoading(
      {
        title: 'Menyiapkan Cetak Thermal...',
        subtitle: `Memformat nota ${order.invoiceNumber} untuk printer thermal ${storeSettings.printerPaperSize}...`,
        type: 'print',
        minDurationMs: 400,
      },
      async () => {
        await downloadReceiptPdf(order, storeSettings, 'print');
      }
    );
    addNotification(`Struk #${order.invoiceNumber} siap dicetak.`, 'info');
  };

  const handleDownloadPdf = async () => {
    await runWithExportLoading(
      {
        title: 'Merender Struk Transaksi PDF...',
        subtitle: `Memformat nota thermal resolusi tinggi (${storeSettings.printerPaperSize}) untuk #${order.invoiceNumber}...`,
        type: 'pdf',
      },
      async () => {
        await downloadReceiptPdf(order, storeSettings);
      }
    );
    addNotification(`Struk #${order.invoiceNumber} berhasil diunduh sebagai PDF.`, 'success');
  };

  const handleSendWhatsApp = () => {
    let phone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '';
    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1);
    }

    const itemsText = order.items
      .map(
        (i) =>
          `  - ${i.qty}x ${i.name} = Rp ${(i.qty * i.price - (i.discountAmount || 0)).toLocaleString('id-ID')}`
      )
      .join('\n');

    const msg =
      `*${storeSettings.storeName.toUpperCase()}*\n` +
      `${storeSettings.tagline}\n` +
      `-----------------------------------------\n` +
      `*No. Struk :* ${order.invoiceNumber}\n` +
      `*Tanggal   :* ${order.date}\n` +
      `*Kasir     :* ${order.cashierName}\n` +
      `*Pelanggan :* ${order.customerName}\n` +
      `-----------------------------------------\n` +
      `${itemsText}\n` +
      `-----------------------------------------\n` +
      `*Subtotal :* Rp ${order.subtotal.toLocaleString('id-ID')}\n` +
      (order.discountTotal > 0
        ? `*Diskon   :* -Rp ${order.discountTotal.toLocaleString('id-ID')}\n`
        : '') +
      (order.taxAmount > 0
        ? `*PPN (${order.taxRate}%) :* Rp ${order.taxAmount.toLocaleString('id-ID')}\n`
        : '') +
      (order.serviceCharge > 0
        ? `*Layanan  :* Rp ${order.serviceCharge.toLocaleString('id-ID')}\n`
        : '') +
      `*TOTAL    :* Rp ${order.grandTotal.toLocaleString('id-ID')}\n` +
      (order.payments && order.payments.length > 0
        ? `*Sudah dibayar:* Rp ${order.amountPaid.toLocaleString('id-ID')}\n` +
          (order.status === 'dp'
            ? `*SISA TAGIHAN:* Rp ${(order.remainingBalance || 0).toLocaleString('id-ID')}\n`
            : `*Status:* LUNAS\n`)
        : `*Bayar (${order.paymentMethod}) :* Rp ${order.amountPaid.toLocaleString('id-ID')}\n` +
          `*Kembalian:* Rp ${order.change.toLocaleString('id-ID')}\n`) +
      `-----------------------------------------\n` +
      `_${storeSettings.receiptFooter}_\n` +
      `Alamat: ${storeSettings.address}\n` +
      `Telp: ${storeSettings.phone}`;

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#212738] flex items-center justify-between bg-[#151a28]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-sm text-white">Struk Transaksi Selesai</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex flex-col items-center justify-center bg-[#0c0e14]">
          {/* Authentic POS Thermal Paper Preview */}
          <div
            id="thermal-receipt-print"
            className="bg-white text-black font-mono p-5 rounded-lg shadow-2xl border border-slate-300 w-[290px] text-xs space-y-2 select-text"
          >
            {/* Store Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              {storeSettings.logoUrl && (
                <img
                  src={storeSettings.logoUrl}
                  alt="Logo"
                  className="max-h-12 max-w-[100px] object-contain mx-auto mb-1.5"
                />
              )}
              <h2 className="font-extrabold text-sm tracking-wider uppercase text-black">
                {storeSettings.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE'}
              </h2>
              <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{storeSettings.tagline}</p>
              <p className="text-[9px] text-slate-500 mt-1">{storeSettings.address}</p>
              <p className="text-[9px] text-slate-500">WA: {storeSettings.phone} | IG: {storeSettings.instagram || '@_sandikale'}</p>
            </div>

            {/* Receipt Meta */}
            <div className="text-[10px] space-y-0.5 pb-2 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>No. Nota :</span>
                <span className="font-bold">{order.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal  :</span>
                <span>{order.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir    :</span>
                <span>{order.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="truncate max-w-[140px] font-semibold">{order.customerName}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1.5 py-1 text-[11px] border-b border-dashed border-slate-400">
              {order.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="font-bold leading-tight">{item.name}</p>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>
                      {item.qty} x Rp {item.price.toLocaleString('id-ID')}
                    </span>
                    <span className="font-bold text-black">
                      Rp {(item.qty * item.price - (item.discountAmount || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                  {item.discountAmount > 0 && (
                    <p className="text-[9px] italic text-rose-600">
                      Diskon: -Rp {item.discountAmount.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="space-y-1 text-[10px] pt-1 border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rp {order.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Diskon Nota:</span>
                  <span>-Rp {order.discountTotal.toLocaleString('id-ID')}</span>
                </div>
              )}
              {order.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>PPN ({order.taxRate}%):</span>
                  <span>Rp {order.taxAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {order.serviceCharge > 0 && (
                <div className="flex justify-between">
                  <span>Layanan:</span>
                  <span>Rp {order.serviceCharge.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>Rp {order.grandTotal.toLocaleString('id-ID')}</span>
              </div>
              {order.payments && order.payments.length > 0 ? (
                <>
                  {order.payments.map((pay) => (
                    <div key={pay.id} className="flex justify-between text-[10px]">
                      <span>{pay.kind === 'dp' ? 'DP' : 'Pelunasan'} ({pay.method}):</span>
                      <span>Rp {pay.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[10px] font-black pt-1 border-t border-slate-300">
                    <span>{order.status === 'dp' ? 'SISA TAGIHAN:' : 'STATUS:'}</span>
                    <span>{order.status === 'dp' ? `Rp ${(order.remainingBalance || 0).toLocaleString('id-ID')}` : 'LUNAS'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-[10px] pt-1">
                    <span>Bayar ({order.paymentMethod}):</span>
                    <span>Rp {order.amountPaid.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Kembalian:</span>
                    <span>Rp {order.change.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[9px] text-slate-500 space-y-0.5">
              <p className="italic">{storeSettings.receiptFooter}</p>
              <p>*** LUNAS ***</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#151a28] border-t border-[#212738] flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="py-2.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-900/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Thermal</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="py-2.5 px-3.5 rounded-xl bg-[#20273a] hover:bg-[#2b354e] border border-[#2c3750] text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF</span>
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="py-2.5 px-3.5 rounded-xl bg-[#0f5132] hover:bg-[#146c43] text-emerald-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Kirim WA</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-[#1d2334] hover:bg-[#242b40] text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Transaksi Baru</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
