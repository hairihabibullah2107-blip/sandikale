import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  X,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  FileText,
  DollarSign,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { downloadShiftReportPdf } from '../utils/pdfExport';

interface ShiftManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftManagementModal: React.FC<ShiftManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentShift,
    openShift,
    closeShift,
    addDrawerTransaction,
    storeSettings,
    currentUser,
    addNotification,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'summary' | 'drawer' | 'close'>('summary');

  // Open Shift Form States
  const [startingCashInput, setStartingCashInput] = useState<number>(250000);
  const [shiftOpenNotes, setShiftOpenNotes] = useState('');

  // Close Shift Form States
  const [actualCashInput, setActualCashInput] = useState<number>(
    currentShift ? currentShift.expectedCashEnding : 0
  );
  const [shiftCloseNotes, setShiftCloseNotes] = useState('');

  // Drawer Transaction States
  const [drawerType, setDrawerType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [drawerAmount, setDrawerAmount] = useState<number>(50000);
  const [drawerNote, setDrawerNote] = useState('');

  if (!isOpen) return null;

  // Handle Open Shift
  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openShift(startingCashInput, shiftOpenNotes);
    onClose();
  };

  // Handle Close Shift (Z-Report)
  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    const closed = closeShift(actualCashInput, shiftCloseNotes);
    if (closed) {
      downloadShiftReportPdf(closed, storeSettings);
    }
    onClose();
  };

  // Handle Drawer Transaction
  const handleDrawerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerAmount || drawerAmount <= 0) {
      addNotification('Nominal kas laci harus lebih dari Rp 0', 'warning');
      return;
    }
    if (!drawerNote.trim()) {
      addNotification('Keterangan kas laci wajib diisi!', 'warning');
      return;
    }

    addDrawerTransaction(drawerType, drawerAmount, drawerNote.trim());
    setDrawerNote('');
    setDrawerAmount(20000);
    setActiveTab('summary');
  };

  const cashDifference = currentShift
    ? actualCashInput - currentShift.expectedCashEnding
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#212738] flex items-center justify-between bg-[#151a28]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Manajemen Shift & Laci Kas</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    currentShift
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {currentShift ? 'Shift Aktif' : 'Shift Belum Dibuka'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kasir: <strong className="text-white">{currentUser?.name}</strong> | Outlet: {storeSettings.storeName}
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

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {!currentShift ? (
            /* Open Shift Screen */
            <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#171d2b] border border-[#232b3e] space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Buka Shift Baru Kasir</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Masukkan jumlah modal kas kecil (starting cash float) yang disediakan di laci kasir saat pergantian shift.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Modal Awal Kas di Laci (Rp) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={startingCashInput}
                    onChange={(e) => setStartingCashInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full p-3 rounded-xl bg-[#161a26] border border-[#273248] text-white font-bold text-base font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="absolute right-3 top-3 text-xs text-slate-400 font-bold">
                    IDR
                  </div>
                </div>
                {/* Fast chip amounts */}
                <div className="flex gap-2 mt-2">
                  {[100000, 200000, 250000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStartingCashInput(amt)}
                      className="px-2.5 py-1 rounded-lg bg-[#1c2232] hover:bg-[#252e42] border border-[#29354d] text-xs font-mono text-slate-300 transition"
                    >
                      {amt.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Catatan Pembukaan Shift
                </label>
                <input
                  type="text"
                  value={shiftOpenNotes}
                  onChange={(e) => setShiftOpenNotes(e.target.value)}
                  placeholder="Cth: Shift Pagi (08:00 - 16:00)"
                  className="w-full p-2.5 rounded-xl bg-[#161a26] border border-[#273248] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer"
              >
                BUKA SHIFT KASIR SEKARANG
              </button>
            </form>
          ) : (
            /* Active Shift Management Tabs */
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="flex gap-2 border-b border-[#212738] pb-3 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`py-1.5 px-3 rounded-xl transition cursor-pointer ${
                    activeTab === 'summary'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-[#171d2b] text-slate-400 hover:text-white'
                  }`}
                >
                  Ringkasan Kas Laci (X-Report)
                </button>
                <button
                  onClick={() => setActiveTab('drawer')}
                  className={`py-1.5 px-3 rounded-xl transition cursor-pointer ${
                    activeTab === 'drawer'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-[#171d2b] text-slate-400 hover:text-white'
                  }`}
                >
                  Kas Masuk / Keluar (Petty Cash)
                </button>
                <button
                  onClick={() => {
                    setActualCashInput(currentShift.expectedCashEnding);
                    setActiveTab('close');
                  }}
                  className={`py-1.5 px-3 rounded-xl transition cursor-pointer ${
                    activeTab === 'close'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-[#171d2b] text-slate-400 hover:text-white'
                  }`}
                >
                  Tutup Shift (Z-Report)
                </button>
              </div>

              {/* TAB 1: SUMMARY (X-REPORT) */}
              {activeTab === 'summary' && (
                <div className="space-y-4 text-xs">
                  {/* Big Expected Cash Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#13281f] via-[#161a26] to-[#121622] border border-emerald-500/40">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      Saldo Kas Sistem di Laci Saat Ini:
                    </span>
                    <span className="font-black text-2xl sm:text-3xl text-emerald-400 font-mono tracking-tight block mt-1">
                      Rp {currentShift.expectedCashEnding.toLocaleString('id-ID')}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      (Modal Awal + Penjualan Tunai + Kas Masuk - Kas Keluar)
                    </p>
                  </div>

                  {/* Grid details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#161a26] border border-[#222a3d]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Modal Awal</span>
                      <span className="font-bold text-slate-200 font-mono">
                        Rp {currentShift.startingCash.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#161a26] border border-[#222a3d]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Penjualan Tunai</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        Rp {currentShift.totalSalesCash.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#161a26] border border-[#222a3d]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Non-Tunai (QRIS/Card)</span>
                      <span className="font-bold text-sky-400 font-mono">
                        Rp {currentShift.totalSalesNonCash.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#161a26] border border-[#222a3d]">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Transaksi</span>
                      <span className="font-bold text-white font-mono">
                        {currentShift.totalTransactions} Nota
                      </span>
                    </div>
                  </div>

                  {/* Drawer Transactions History */}
                  <div>
                    <h5 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-2">
                      Riwayat Keluar Masuk Kas Laci ({currentShift.drawerTransactions.length})
                    </h5>
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {currentShift.drawerTransactions.map((dt) => (
                        <div
                          key={dt.id}
                          className="p-2.5 rounded-xl bg-[#161a26] border border-[#222a3d] flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            {dt.type === 'cash_in' || dt.type === 'sale' ? (
                              <ArrowDownRight className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <p className="font-semibold text-white">{dt.note}</p>
                              <span className="text-[10px] text-slate-400 font-sans">
                                {dt.time} oleh {dt.cashierName}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`font-bold ${
                              dt.type === 'cash_in' || dt.type === 'sale'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {dt.type === 'cash_in' || dt.type === 'sale' ? '+' : '-'}Rp{' '}
                            {dt.amount.toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={() => downloadShiftReportPdf(currentShift, storeSettings)}
                      className="py-2.5 px-3 rounded-xl bg-[#1c2232] hover:bg-[#252e42] border border-[#28354e] text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Cetak Ringkasan Shift (X-Report)</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('close')}
                      className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                    >
                      Tutup Shift Kasir...
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PETTY CASH (KAS MASUK / KELUAR) */}
              {activeTab === 'drawer' && (
                <form onSubmit={handleDrawerSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawerType('cash_out')}
                      className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer ${
                        drawerType === 'cash_out'
                          ? 'bg-rose-950/40 border-rose-600 text-rose-300'
                          : 'bg-[#161a26] border-[#222a3d] text-slate-400'
                      }`}
                    >
                      <MinusCircle className="w-4 h-4" />
                      <span>Kas Keluar (Petty Cash)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerType('cash_in')}
                      className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 cursor-pointer ${
                        drawerType === 'cash_in'
                          ? 'bg-emerald-950/40 border-emerald-600 text-emerald-300'
                          : 'bg-[#161a26] border-[#222a3d] text-slate-400'
                      }`}
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Kas Masuk Tambahan</span>
                    </button>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Nominal Uang (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1000"
                      value={drawerAmount}
                      onChange={(e) => setDrawerAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full p-2.5 rounded-xl bg-[#161a26] border border-[#273248] text-white font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Keterangan / Keperluan *
                    </label>
                    <input
                      type="text"
                      required
                      value={drawerNote}
                      onChange={(e) => setDrawerNote(e.target.value)}
                      placeholder="Cth: Beli es batu, isi pulsa listrik, uang kembalian..."
                      className="w-full p-2.5 rounded-xl bg-[#161a26] border border-[#273248] text-white text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className="flex-1 py-2.5 rounded-xl bg-[#1f2638] text-slate-300 font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      Catat Kas Laci
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: CLOSE SHIFT (Z-REPORT) */}
              {activeTab === 'close' && (
                <form onSubmit={handleCloseShiftSubmit} className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800 text-slate-300 space-y-2">
                    <h5 className="font-extrabold text-sm text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Proses Penutupan Kasir (Z-Report)</span>
                    </h5>
                    <p className="text-[11px] leading-relaxed">
                      Hitung seluruh uang tunai fisik yang ada di dalam laci kas sekarang. Sistem akan menghitung selisih kas secara transparan dan menghasilkan laporan Z-Report.
                    </p>
                  </div>

                  {/* Comparison Box */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#161a26] border border-[#222a3d]">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Kas Sistem Seharusnya
                      </span>
                      <span className="font-mono font-bold text-sm text-white">
                        Rp {currentShift.expectedCashEnding.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Selisih Fisik vs Sistem
                      </span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          cashDifference === 0
                            ? 'text-emerald-400'
                            : cashDifference > 0
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {cashDifference === 0
                          ? 'PAS / SEIMBANG'
                          : `${cashDifference > 0 ? '+' : ''}Rp ${cashDifference.toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Hitungan Uang Tunai Fisik Aktual di Laci (Rp) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full p-3 rounded-xl bg-[#161a26] border border-[#273248] text-white font-mono font-black text-lg outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Catatan Penutupan Shift
                    </label>
                    <input
                      type="text"
                      value={shiftCloseNotes}
                      onChange={(e) => setShiftCloseNotes(e.target.value)}
                      placeholder="Cth: Shift selesai, uang diserahkan ke SPV"
                      className="w-full p-2.5 rounded-xl bg-[#161a26] border border-[#273248] text-white text-xs outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className="flex-1 py-3 rounded-xl bg-[#1f2638] text-slate-300 font-bold cursor-pointer"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold shadow-lg shadow-rose-950/40 cursor-pointer"
                    >
                      TUTUP SHIFT & CETAK Z-REPORT
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
