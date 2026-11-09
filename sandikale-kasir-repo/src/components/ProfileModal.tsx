import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, User as UserIcon, Camera, KeyRound, Phone, Store, Save, Loader2 } from 'lucide-react';
import { compressUploadedImage } from '../utils/imageCompressor';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { currentUser, updateProfile, changeOwnPin, storeSettings, currentShift, addNotification } = useApp();

  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!currentUser) return null;

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBusy(true);
      const res = await compressUploadedImage(file, { maxWidth: 256, maxHeight: 256, quality: 0.85, preserveTransparency: false });
      setAvatar(res.dataUrl);
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses foto.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama tidak boleh kosong.');
      return;
    }
    setError('');
    await updateProfile({ name: name.trim(), phone: phone.trim(), avatar });
  };

  const handlePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setPinMsg({ ok: false, text: 'Konfirmasi PIN baru tidak sama.' });
      return;
    }
    const res = await changeOwnPin(oldPin, newPin);
    if (res.success) {
      setPinMsg({ ok: true, text: 'PIN berhasil diganti.' });
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      setPinMsg({ ok: false, text: res.message || 'Gagal mengganti PIN.' });
    }
  };

  const input =
    'w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 overflow-y-auto">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-md my-auto max-h-[95vh] overflow-y-auto">
        <div className="p-4 border-b border-[#212738] flex items-center justify-between bg-[#151a28] sticky top-0">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-rose-400" />
            <h3 className="font-extrabold text-base text-white">Profil Akun</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-700 to-amber-600 flex items-center justify-center text-white font-extrabold text-2xl overflow-hidden shrink-0">
                {avatar ? <img src={avatar} alt="Foto profil" className="w-full h-full object-cover" /> : name.charAt(0) || 'K'}
              </div>
              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f2638] hover:bg-[#283248] text-slate-200 font-bold cursor-pointer">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-rose-400" />}
                  <span>Ganti Foto</span>
                  <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
                </label>
                {avatar && (
                  <button type="button" onClick={() => setAvatar('')} className="block text-[10px] text-rose-400 hover:underline cursor-pointer">
                    Hapus foto
                  </button>
                )}
                <span className="block text-[10px] uppercase tracking-wider font-bold text-rose-400">{currentUser.role}</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Nama Lengkap *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Username</label>
                <input type="text" value={currentUser.username} readOnly className={input + ' opacity-60'} />
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>No. WhatsApp</span>
                </label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className={input} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#161a26] border border-[#222a3d] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">{storeSettings.storeName}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                {currentShift ? `Shift aktif: ${currentShift.shiftNumber}` : 'Belum ada shift aktif'}
              </p>
            </div>

            {error && <p className="text-rose-400 font-semibold">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Profil</span>
            </button>
          </form>

          <form onSubmit={handlePin} className="space-y-3 pt-4 border-t border-[#1f2638]">
            <h4 className="font-extrabold text-white flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Ganti PIN</span>
            </h4>
            <input type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} placeholder="PIN lama" className={input + ' font-mono'} />
            <div className="grid grid-cols-2 gap-3">
              <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="PIN baru (min. 4)" className={input + ' font-mono'} />
              <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Ulangi PIN baru" className={input + ' font-mono'} />
            </div>
            {pinMsg && <p className={pinMsg.ok ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>{pinMsg.text}</p>}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#1c2232] hover:bg-[#252e42] border border-[#29354d] text-slate-200 font-bold cursor-pointer">
              Simpan PIN Baru
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
