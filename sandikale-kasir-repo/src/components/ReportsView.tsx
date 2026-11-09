import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  Download,
  Calendar,
  Wallet,
  Clock,
  Printer,
  ShoppingBag,
  Percent,
  RotateCcw,
  Lock,
  X,
  AlertTriangle,
} from 'lucide-react';
import { downloadSalesAuditPdf, downloadShiftReportPdf, downloadShiftsRecapPdf } from '../utils/pdfExport';

export const ReportsView: React.FC = () => {
  const {
    orders: allOrders,
    currentShift,
    shifts,
    resetShiftHistory,
    storeSettings,
    currentUser,
    addNotification,
    runWithExportLoading,
  } = useApp();

  const [reportTab, setReportTab] = useState<'sales' | 'shifts'>('sales');

  // Reset shift state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [resetError, setResetError] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  // Cakupan laporan: default shift aktif (dimulai otomatis saat login)
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const effectiveShiftId = shiftFilter || currentShift?.id || 'all';
  const orders =
    effectiveShiftId === 'all' ? allOrders : allOrders.filter((o) => o.shiftId === effectiveShiftId);
  const scopeShift = shifts.find((sh) => sh.id === effectiveShiftId);
  const scopeLabel =
    effectiveShiftId === 'all'
      ? 'Semua Shift'
      : `Shift ${scopeShift?.shiftNumber || '-'} (${scopeShift?.cashierName || '-'}, mulai ${scopeShift?.startTime || '-'})`;
  const dpOrders = orders.filter((o) => o.status === 'dp');
  const dpReceived = dpOrders.reduce((sum, o) => sum + o.amountPaid, 0);
  const dpRemaining = dpOrders.reduce((sum, o) => sum + (o.remainingBalance || 0), 0);
  const completedOrders = orders.filter((o) => o.status === 'completed');

  // Metrics
  const totalOmzet = completedOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalHpp = completedOrders.reduce(
    (sum, o) =>
      sum +
      o.items.reduce((itemSum, item) => itemSum + (item.costPrice || 0) * item.qty, 0),
    0
  );
  const labaKotor = totalOmzet - totalHpp;
  const marginPercent = totalOmzet > 0 ? Math.round((labaKotor / totalOmzet) * 100) : 0;
  const avgBasketSize =
    completedOrders.length > 0 ? Math.round(totalOmzet / completedOrders.length) : 0;

  // Payment Breakdown
  const paymentTotals = completedOrders.reduce((acc, o) => {
    acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + o.grandTotal;
    return acc;
  }, {} as Record<string, number>);

  const handleConfirmResetShifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPinInput.trim()) {
      setResetError('PIN Administrator wajib diisi!');
      return;
    }

    const res = await resetShiftHistory(adminPinInput.trim());
    if (res.success) {
      setResetModalOpen(false);
      setAdminPinInput('');
      setResetError('');
    } else {
      setResetError(res.message || 'PIN salah!');
    }
  };

  const handleDownloadSalesAuditPdf = async () => {
    await runWithExportLoading(
      {
        title: 'Merender Laporan Audit Penjualan PDF...',
        subtitle: 'Memformat tabel transaksi komprehensif, kop toko, dan kalkulasi omzet...',
        type: 'pdf',
      },
      async () => {
        await downloadSalesAuditPdf(orders, storeSettings, scopeLabel);
      }
    );
    addNotification('Laporan audit penjualan berhasil diunduh sebagai PDF.', 'success');
  };

  const handleExportShiftsPdf = async () => {
    await runWithExportLoading(
      {
        title: 'Membuat Rekap Shift Kasir (PDF)...',
        subtitle: 'Merekapitulasi seluruh buku kas shift dan selisih kas ke dokumen PDF...',
        type: 'pdf',
      },
      async () => {
        await downloadShiftsRecapPdf(shifts, storeSettings);
      }
    );
  };

  const handleDownloadShiftPdf = async (s: any) => {
    await runWithExportLoading(
      {
        title: `Merender Z-Report #${s.shiftNumber} PDF...`,
        subtitle: `Memformat neraca kas laci, omzet tunai & non-tunai kasir ${s.cashierName}...`,
        type: 'pdf',
      },
      async () => {
        await downloadShiftReportPdf(s, storeSettings);
      }
    );
    addNotification(`Laporan Z-Report #${s.shiftNumber} berhasil diunduh sebagai PDF.`, 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0d1017] p-3 sm:p-5 space-y-4">
      {/* Top Banner */}
      <div className="bg-[#121622] p-4 rounded-2xl border border-[#212738] flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div>
          <h2 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-400" />
            <span>Laporan Penjualan & Analisis Finansial</span>
          </h2>
          <p className="text-xs text-slate-400">
            Audit omzet, estimasi laba kotor, performa shift kasir, dan ekspor laporan berkala.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={effectiveShiftId}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#161a26] border border-[#222a3d] text-white text-xs font-bold outline-none max-w-[260px]"
            title="Cakupan laporan per shift"
          >
            <option value="all">Semua Shift</option>
            {shifts.map((sh) => (
              <option key={sh.id} value={sh.id}>
                {sh.shiftNumber} - {sh.cashierName}
                {currentShift?.id === sh.id ? ' (aktif)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleDownloadSalesAuditPdf}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan PDF</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5 rounded-2xl bg-[#121622] border border-[#212738] text-[11px] text-slate-300 flex flex-wrap gap-x-5 gap-y-1">
        <span>
          <strong className="text-white">Cakupan:</strong> {scopeLabel}
        </span>
        <span>
          <strong className="text-amber-300">Pesanan DP berjalan:</strong> {dpOrders.length}
        </span>
        <span>
          <strong className="text-amber-300">DP diterima:</strong> Rp {dpReceived.toLocaleString('id-ID')}
        </span>
        <span>
          <strong className="text-amber-300">Sisa tagihan:</strong> Rp {dpRemaining.toLocaleString('id-ID')}
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Omzet */}
        <div className="p-4 rounded-2xl bg-[#121622] border border-[#212738] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Total Omzet Penjualan</span>
            <DollarSign className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white font-mono">
            Rp {totalOmzet.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-slate-400">{completedOrders.length} transaksi selesai</p>
        </div>

        {/* Laba Kotor */}
        <div className="p-4 rounded-2xl bg-[#121622] border border-[#212738] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Estimasi Laba Kotor (Gross)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            Rp {labaKotor.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-emerald-500/80 font-bold">Margin Profit: {marginPercent}%</p>
        </div>

        {/* Total HPP Modal */}
        <div className="p-4 rounded-2xl bg-[#121622] border border-[#212738] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Total Biaya Modal (HPP)</span>
            <ShoppingBag className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-200 font-mono">
            Rp {totalHpp.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-slate-400">Bahan baku & modal produk</p>
        </div>

        {/* Average Basket Size */}
        <div className="p-4 rounded-2xl bg-[#121622] border border-[#212738] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Rata-Rata Nilai Belanja</span>
            <Percent className="w-4 h-4 text-sky-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-sky-400 font-mono">
            Rp {avgBasketSize.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-slate-400">Basket size per struk</p>
        </div>
      </div>

      {/* Tabs: Sales Analysis vs Shift Reports */}
      <div className="flex items-center justify-between border-b border-[#212738] pb-2">
        <div className="flex gap-2 text-xs font-bold">
          <button
            onClick={() => setReportTab('sales')}
            className={`py-2 px-3.5 rounded-xl transition cursor-pointer ${
              reportTab === 'sales'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-[#141824] text-slate-400 hover:text-white'
            }`}
          >
            Distribusi Pembayaran & Tren
          </button>
          <button
            onClick={() => setReportTab('shifts')}
            className={`py-2 px-3.5 rounded-xl transition cursor-pointer ${
              reportTab === 'shifts'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-[#141824] text-slate-400 hover:text-white'
            }`}
          >
            Riwayat Shift Kasir (Z-Reports) ({shifts.length})
          </button>
        </div>

        {/* Tombol Riset / Reset Laporan Shift Kasir (Khusus Admin) */}
        {reportTab === 'shifts' && isAdmin && (
          <button
            onClick={() => {
              setAdminPinInput('');
              setResetError('');
              setResetModalOpen(true);
            }}
            className="py-1.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Reset riwayat seluruh shift kasir (Khusus Admin)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Reset Riwayat Shift</span>
          </button>
        )}
      </div>

      {reportTab === 'sales' ? (
        /* Breakdown Section */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payment Method Breakdown Card */}
          <div className="p-5 rounded-2xl bg-[#121622] border border-[#212738] space-y-3">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-rose-400" />
              <span>Komposisi Metode Pembayaran</span>
            </h4>
            <div className="space-y-2.5 pt-2">
              {['Cash', 'QRIS', 'Debit', 'Kredit', 'Transfer_BCA', 'Transfer_Mandiri'].map((m) => {
                const total = paymentTotals[m] || 0;
                const pct = totalOmzet > 0 ? Math.round((total / totalOmzet) * 100) : 0;
                return (
                  <div key={m} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-300">{m}</span>
                      <span className="font-mono text-white font-bold">
                        Rp {total.toLocaleString('id-ID')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#1b2232] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-amber-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Summary Highlights */}
          <div className="p-5 rounded-2xl bg-[#121622] border border-[#212738] space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Statistik Operasional Kasir</span>
              </h4>
              <div className="space-y-3 pt-3 text-xs text-slate-300">
                <div className="flex justify-between p-2.5 rounded-xl bg-[#161a26]">
                  <span>Total Produk Terjual:</span>
                  <span className="font-bold text-white font-mono">
                    {completedOrders.reduce(
                      (sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0),
                      0
                    )}{' '}
                    pcs
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#161a26]">
                  <span>Total Potongan Diskon Diberikan:</span>
                  <span className="font-bold text-rose-400 font-mono">
                    Rp{' '}
                    {completedOrders
                      .reduce((sum, o) => sum + o.discountTotal, 0)
                      .toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-[#161a26]">
                  <span>Total PPN Terkumpul:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    Rp{' '}
                    {completedOrders
                      .reduce((sum, o) => sum + o.taxAmount, 0)
                      .toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-2 border-t border-[#1f2638]">
              Laporan data sinkron secara real-time dari seluruh sesi kasir.
            </p>
          </div>
        </div>
      ) : (
        /* Shift History (Z-Reports) */
        <div className="bg-[#121622] rounded-2xl border border-[#212738] overflow-hidden shadow-md">
          <div className="p-3 border-b border-[#212738] flex justify-between items-center bg-[#151a28]">
            <span className="font-bold text-xs text-white">Riwayat Tutup Shift Kasir</span>
            <button
              onClick={handleExportShiftsPdf}
              className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
            >
              Unduh PDF Riwayat Shift
            </button>
          </div>

          {shifts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Belum ada riwayat shift yang tersimpan atau riwayat baru saja direset.
            </div>
          ) : (
            <div className="divide-y divide-[#1e2436] text-xs">
              {shifts.map((s) => (
                <div
                  key={s.id}
                  className="p-4 hover:bg-[#161a28] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white bg-[#191f2e] px-2 py-0.5 rounded border border-[#273248]">
                        {s.shiftNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.status === 'open'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                        }`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-white">
                      {s.cashierName}{' '}
                      <span className="text-slate-400 font-normal">
                        ({s.startTime} - {s.endTime || 'Sedang Berjalan'})
                      </span>
                    </h4>
                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-3 font-mono">
                      <span>Modal: Rp {s.startingCash.toLocaleString('id-ID')}</span>
                      <span>Kas Tunai: Rp {s.totalSalesCash.toLocaleString('id-ID')}</span>
                      <span>Non-Tunai: Rp {s.totalSalesNonCash.toLocaleString('id-ID')}</span>
                      {s.cashDifference !== undefined && (
                        <span
                          className={
                            s.cashDifference === 0
                              ? 'text-emerald-400 font-bold'
                              : s.cashDifference > 0
                              ? 'text-sky-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          Selisih: {s.cashDifference >= 0 ? '+' : ''}Rp{' '}
                          {s.cashDifference.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadShiftPdf(s)}
                    className="py-2 px-3 rounded-xl bg-[#1c2232] hover:bg-[#252e42] border border-[#29354d] text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center"
                  >
                    <Printer className="w-3.5 h-3.5 text-rose-400" />
                    <span>Cetak Z-Report</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset Shift Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#141824] rounded-3xl p-6 border border-rose-900/60 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 flex items-center justify-center border border-rose-800">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Reset Riwayat Shift Kasir</h3>
                <span className="text-xs text-rose-300">Tindakan Khusus Administrator / Owner</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin mengosongkan riwayat seluruh shift kasir? Data yang direset tidak dapat dikembalikan.
            </p>

            {resetError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 font-semibold">
                {resetError}
              </div>
            )}

            <form onSubmit={handleConfirmResetShifts} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Masukkan PIN Administrator *</span>
                </label>
                <input
                  type="password"
                  required
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="PIN Admin..."
                  className="w-full p-2.5 rounded-xl bg-[#191f2e] border border-[#273248] text-white font-mono outline-none focus:ring-1 focus:ring-rose-500 tracking-widest"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#20273a] text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold shadow-md shadow-rose-950/40"
                >
                  Ya, Reset Riwayat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
