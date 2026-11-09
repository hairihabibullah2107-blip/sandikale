import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ProfileModal } from './ProfileModal';
import { ThemePicker } from './ThemePicker';
import { SyncBadge } from './SyncBadge';
import {
  Store,
  Clock,
  Wallet,
  PauseCircle,
  Monitor,
  Volume2,
  VolumeX,
  User,
  LogOut,
  ChevronDown,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Settings,
} from 'lucide-react';

interface NavbarProps {
  onOpenShiftModal: () => void;
  onOpenHeldModal: () => void;
  onOpenCustomerDisplay: () => void;
  onOpenSettings: () => void;
  activeView: string;
  setActiveView: (view: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenShiftModal,
  onOpenHeldModal,
  onOpenCustomerDisplay,
  onOpenSettings,
  activeView,
  setActiveView,
}) => {
  const {
    currentUser,
    logout,
    currentShift,
    heldOrders,
    storeSettings,
    soundMuted,
    toggleSound,
    notifications,
    dismissNotification,
  } = useApp();

  const [timeStr, setTimeStr] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
    <header className="min-h-16 py-2 lg:py-0 lg:h-16 bg-[#121620] border-b border-[#212738] flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-2 px-3 sm:px-6 select-none z-30 shadow-md">
      {/* Brand & Store Info */}
      <div className="flex items-center gap-3 order-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-900/30 font-black text-sm shrink-0 border border-white/20 overflow-hidden">
          {storeSettings.logoUrl ? (
            <img
              src={storeSettings.logoUrl}
              alt="Logo Toko"
              className="w-full h-full object-contain p-1 bg-[#10131d]"
            />
          ) : (
            <Store className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="hidden sm:block leading-tight">
          <h1 className="font-panchang font-extrabold text-sm tracking-wide text-white">
            {storeSettings.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE'}
          </h1>
          <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
            {storeSettings.tagline}
          </p>
        </div>
      </div>

      {/* Center Nav Views */}
      <nav className="order-3 lg:order-none w-full lg:w-auto overflow-x-auto flex items-center gap-1.5 sm:gap-2 pb-0.5 lg:pb-0">
        <button
          onClick={() => setActiveView('pos')}
          className={`px-3.5 py-2.5 lg:py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeView === 'pos'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
              : 'text-slate-300 hover:bg-[#1a2030] hover:text-white'
          }`}
        >
          <span>Kasir (POS)</span>
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`px-3.5 py-2.5 lg:py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeView === 'history'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
              : 'text-slate-300 hover:bg-[#1a2030] hover:text-white'
          }`}
        >
          <span>Riwayat Transaksi</span>
        </button>
        <button
          onClick={() => setActiveView('inventory')}
          className={`px-3.5 py-2.5 lg:py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeView === 'inventory'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
              : 'text-slate-300 hover:bg-[#1a2030] hover:text-white'
          }`}
        >
          <span>Katalog & Stok</span>
        </button>
        <button
          onClick={() => setActiveView('reports')}
          className={`px-3.5 py-2.5 lg:py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeView === 'reports'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
              : 'text-slate-300 hover:bg-[#1a2030] hover:text-white'
          }`}
        >
          <span>Laporan Shift</span>
        </button>
      </nav>

      {/* Right Controls: Shift Status, Held Bills, Dual Display, Clock, User */}
      <div className="order-2 lg:order-none ml-auto lg:ml-0 flex items-center gap-1.5 sm:gap-2.5">
        <SyncBadge />
        {/* Real-time Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#171d2b] border border-[#232b3e] text-xs font-mono text-slate-300 font-medium">
          <Clock className="w-3.5 h-3.5 text-rose-400" />
          <span>{timeStr}</span>
        </div>

        {/* Shift Cash Drawer Status */}
        {currentShift ? (
          <button
            onClick={onOpenShiftModal}
            title="Shift Kasir Aktif - Klik untuk Kelola Kas / Tutup Shift"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#13281f] border border-emerald-500/40 text-emerald-300 hover:bg-[#1a382b] transition cursor-pointer text-xs font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="hidden lg:inline">{currentShift.cashierName}:</span>
            <span className="font-mono">Rp {currentShift.expectedCashEnding.toLocaleString('id-ID')}</span>
          </button>
        ) : (
          <button
            onClick={onOpenShiftModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer text-xs font-bold animate-pulse"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Buka Shift Kasir</span>
          </button>
        )}

        {/* Held Bills (Pending Orders) */}
        <button
          onClick={onOpenHeldModal}
          title="Daftar Pesanan yang Ditahan (Pending Bills)"
          className="relative p-2 rounded-xl bg-[#171d2b] hover:bg-[#20283b] border border-[#232b3e] text-slate-300 transition cursor-pointer"
        >
          <PauseCircle className="w-4 h-4 text-amber-400" />
          {heldOrders.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md">
              {heldOrders.length}
            </span>
          )}
        </button>

        {/* Customer Facing Display Modal Trigger */}
        <button
          onClick={onOpenCustomerDisplay}
          title="Buka Layar Tampilan Pelanggan (Dual Display)"
          className="p-2 rounded-xl bg-[#171d2b] hover:bg-[#20283b] border border-[#232b3e] text-slate-300 transition cursor-pointer hidden md:flex items-center gap-1"
        >
          <Monitor className="w-4 h-4 text-sky-400" />
        </button>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          title={soundMuted ? 'Suara Dinonaktifkan (Klik untuk aktifkan)' : 'Suara Aktif (Klik untuk bisukan)'}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            soundMuted
              ? 'bg-rose-950/40 border-rose-800 text-rose-400'
              : 'bg-[#171d2b] border-[#232b3e] text-emerald-400 hover:bg-[#20283b]'
          }`}
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            aria-label="Notifikasi"
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 rounded-xl bg-[#171d2b] hover:bg-[#20283b] border border-[#232b3e] text-slate-300 transition cursor-pointer"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#161a26] border border-[#262f44] rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-[#232b3e] mb-2">
                <span className="text-xs font-bold text-white">Notifikasi Aktivitas</span>
                <span className="text-[10px] text-slate-400">{notifications.length} tercatat</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Tidak ada notifikasi baru</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded-xl bg-[#1a2030] border border-[#262f44] text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="text-slate-200 leading-snug">{n.message}</p>
                        <span className="text-[9px] text-slate-400">{n.timestamp}</span>
                      </div>
                      <button
                        onClick={() => dismissNotification(n.id)}
                        className="text-slate-500 hover:text-white text-xs font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account / Cashier Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 border-l border-[#242c3e] cursor-pointer"
          >
            <div className="w-8 h-8 overflow-hidden rounded-xl bg-gradient-to-tr from-rose-700 to-amber-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUser?.name.charAt(0) || 'K'
              )}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                {currentUser?.name}
              </p>
              <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                {currentUser?.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#161a26] border border-[#262f44] rounded-2xl py-2 shadow-2xl z-50">
              <div className="px-3 py-1.5 border-b border-[#232b3e] mb-1">
                <p className="text-xs font-bold text-white">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">Role: {currentUser?.role}</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  setShowProfile(true);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#1f2638] flex items-center gap-2 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-rose-400" />
                <span>Profil Saya</span>
              </button>
              <div className="px-3 py-2.5 border-t border-[#1f2638]">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Tema Tampilan</p>
                <ThemePicker />
              </div>
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[#1f2638] flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pengaturan Toko & POS</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Ganti Kasir / Keluar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
};
