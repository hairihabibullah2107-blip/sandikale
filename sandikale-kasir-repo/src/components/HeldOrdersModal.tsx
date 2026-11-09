import React from 'react';
import { useApp } from '../context/AppContext';
import {
  PauseCircle,
  Play,
  Trash2,
  X,
  Clock,
  User,
  ShoppingBag,
} from 'lucide-react';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({ isOpen, onClose }) => {
  const { heldOrders, recallHeldOrder, deleteHeldOrder } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#212738] flex items-center justify-between bg-[#151a28]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Daftar Pesanan Ditahan (Hold / Pending Bills)
              </h3>
              <p className="text-xs text-slate-400">
                Pilih pesanan untuk dimuat kembali ke kasir dan lanjutkan proses pembayaran.
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

        {/* Body List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3">
          {heldOrders.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-center">
              <PauseCircle className="w-12 h-12 mb-2 opacity-30 text-slate-400" />
              <p className="font-bold text-sm text-slate-300">Tidak Ada Pesanan yang Ditahan</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Saat kasir melayani antrean pelanggan lain, gunakan tombol Hold (F2) untuk menyimpan pesanan sementara.
              </p>
            </div>
          ) : (
            heldOrders.map((h) => (
              <div
                key={h.id}
                className="p-4 rounded-2xl bg-[#161a26] border border-[#222a3d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {h.holdCode}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {h.heldAt}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">oleh {h.cashierName}</span>
                  </div>

                  <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{h.customerName}</span>
                    <span className="text-xs font-normal text-slate-400">({h.tableOrNotes})</span>
                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-1">
                    {h.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#222a3d]">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Total Tagihan</span>
                    <span className="font-black text-sm text-rose-400 font-mono">
                      Rp {h.grandTotal.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        recallHeldOrder(h.id);
                        onClose();
                      }}
                      className="py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Lanjut Bayar</span>
                    </button>
                    <button
                      onClick={() => deleteHeldOrder(h.id)}
                      className="p-2 rounded-xl bg-[#20273a] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-[#273248] transition cursor-pointer"
                      title="Batalkan pesanan ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
