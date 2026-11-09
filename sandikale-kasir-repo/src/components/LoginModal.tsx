import React, { useState } from 'react';
import { ThemePicker } from './ThemePicker';
import { useApp } from '../context/AppContext';
import { Store, Lock, User as UserIcon, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login, storeSettings, loginNotice, cloudMode } = useApp();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setErrorMsg('Mohon masukkan Username dan PIN keamanan Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    login(username, pin)
      .then((res) => {
        if (!res.success) {
          setErrorMsg(res.message || 'Kredensial tidak valid. Silakan periksa kembali.');
        }
      })
      .catch((err) => setErrorMsg(err?.message || 'Terjadi kendala saat masuk. Coba lagi.'))
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-md overflow-hidden p-6 sm:p-8">
        {/* Branding with Panchang Extrabold */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center text-white mx-auto mb-3 shadow-xl shadow-rose-950/40 overflow-hidden border border-white/20">
            {storeSettings.logoUrl ? (
              <img
                src={storeSettings.logoUrl}
                alt="Logo Toko"
                className="w-full h-full object-contain p-2 bg-[#0d1017]"
              />
            ) : (
              <Store className="w-8 h-8" />
            )}
          </div>
          <h2 className="font-panchang font-extrabold text-xl text-white tracking-wide uppercase">
            {storeSettings.storeName.replace(/\bPRO\s+POS\b/gi, '').replace(/\bPRO\b/gi, '').trim() || 'SANDIKALE'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sistem Kasir Pintar & Manajemen Retail Profesional
          </p>
        </div>

        {loginNotice && !errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            {loginNotice}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs text-center font-bold animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Username Pengguna
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda..."
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-[#161a26] border border-[#273248] text-white text-xs outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              PIN Keamanan
            </label>
            <div className="relative">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan PIN keamanan..."
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-[#161a26] border border-[#273248] text-white text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500 tracking-widest"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/50 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memverifikasi Akses...</span>
              </>
            ) : (
              <>
                <span>MASUK KE TERMINAL KASIR</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 text-center">Tema Tampilan</p>
          <ThemePicker />
        </div>

        <div className="mt-6 pt-4 border-t border-[#1f2638] text-center text-slate-500 text-[11px] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{cloudMode ? 'Data tersinkron otomatis antar perangkat' : 'Mode lokal: data tersimpan di perangkat ini'}. Login berlaku selama aplikasi terbuka.</span>
        </div>
      </div>
    </div>
  );
};
