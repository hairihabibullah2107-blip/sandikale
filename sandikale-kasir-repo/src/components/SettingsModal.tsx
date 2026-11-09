import { CLOUD_MODE } from '../lib/env';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StoreSettings, UserRole, User } from '../types';
import {
  Settings,
  Store,
  Printer,
  Users,
  Database,
  Upload,
  Download,
  Plus,
  Trash2,
  X,
  Save,
  Check,
  ShieldAlert,
  Camera,
  QrCode,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { compressUploadedImage, CompressedImageResult } from '../utils/imageCompressor';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    storeSettings,
    updateStoreSettings,
    users,
    addUser,
    updateUser,
    deleteUser,
    currentUser,
    downloadSystemBackup,
    restoreSystemBackup,
    addNotification,
    runWithExportLoading,
  } = useApp();

  const [form, setForm] = useState<StoreSettings>({ ...storeSettings });
  const [activeTab, setActiveTab] = useState<'store' | 'receipt' | 'users' | 'backup'>('store');

  // Image compression states
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [isCompressingQris, setIsCompressingQris] = useState(false);
  const [logoStats, setLogoStats] = useState<CompressedImageResult | null>(null);
  const [qrisStats, setQrisStats] = useState<CompressedImageResult | null>(null);

  // User Management State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('kasir');
  const [newUserPin, setNewUserPin] = useState(CLOUD_MODE ? '' : '1234');
  const [newUserAvatar, setNewUserAvatar] = useState<string>('');

  // Delete user confirmation modal state
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);

  const confirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    const res = await deleteUser(deleteTargetUser.id);
    if (!res.success) alert(res.message || 'Gagal menghapus user.');
    setDeleteTargetUser(null);
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!isOpen) return null;

  // Handle Logo Upload with smart compression
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File gambar logo maksimal 20MB');
      return;
    }

    try {
      setIsCompressingLogo(true);
      const result = await compressUploadedImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.90,
        preserveTransparency: true,
      });

      setForm((prev) => ({ ...prev, logoUrl: result.dataUrl }));
      setLogoStats(result);
      addNotification(
        `Logo toko dioptimasi: ${result.formattedOriginalSize} ➔ ${result.formattedCompressedSize} (Hemat ${result.compressionPercent}%, tetap tajam)`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Gagal memproses file logo.');
    } finally {
      setIsCompressingLogo(false);
      e.target.value = '';
    }
  };

  // Handle QRIS Image Upload with smart compression
  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File gambar QRIS maksimal 20MB');
      return;
    }

    try {
      setIsCompressingQris(true);
      const result = await compressUploadedImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.92,
        preserveTransparency: false,
      });

      setForm((prev) => ({ ...prev, qrisImageUrl: result.dataUrl }));
      setQrisStats(result);
      addNotification(
        `Gambar QRIS dioptimasi: ${result.formattedOriginalSize} ➔ ${result.formattedCompressedSize} (Hemat ${result.compressionPercent}%, tajam dipindai)`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Gagal memproses file QRIS.');
    } finally {
      setIsCompressingQris(false);
      e.target.value = '';
    }
  };

  // Handle User Avatar Upload from device
  const handleNewUserAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await compressUploadedImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
        preserveTransparency: true,
      });
      setNewUserAvatar(result.dataUrl);
    } catch {
      // Fallback
    } finally {
      e.target.value = '';
    }
  };

  // Backup file restore upload
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const res = restoreSystemBackup(content);
        if (res.success) {
          onClose();
        } else {
          alert(res.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Hanya Admin/Owner yang berhak mengubah pengaturan toko!');
      return;
    }
    updateStoreSettings(form);
    onClose();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPin.trim()) return;

    const res = await addUser({
      name: newUserName.trim(),
      username: newUserUsername.trim(),
      role: newUserRole,
      pin: newUserPin.trim(),
      avatar: newUserAvatar || undefined,
    });

    if (res.success) {
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPin(CLOUD_MODE ? '' : '1234');
      setNewUserAvatar('');
      setShowAddUser(false);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-[#121622] rounded-3xl shadow-2xl border border-[#212738] w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#212738] flex items-center justify-between bg-[#151a28]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Pengaturan POS & Toko</h3>
              <p className="text-xs text-slate-400">
                Manajemen akun kasir & produksi, profil outlet, struk, dan backup sistem.
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

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-[#212738] flex gap-3 text-xs font-bold text-slate-400 overflow-x-auto">
          <button
            onClick={() => setActiveTab('store')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'store'
                ? 'border-rose-500 text-rose-400 font-extrabold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Profil Toko & Instagram</span>
          </button>
          <button
            onClick={() => setActiveTab('receipt')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'receipt'
                ? 'border-rose-500 text-rose-400 font-extrabold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Kustomisasi Struk</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-rose-500 text-rose-400 font-extrabold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Manajemen User (Kasir & Produksi)</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-rose-500 text-rose-400 font-extrabold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Unduh & Pulihkan Backup</span>
          </button>
        </div>

        {/* Tab 1: Store Profile & Instagram */}
        {activeTab === 'store' && (
          <form onSubmit={handleSaveStoreSettings} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {!isAdmin && (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Pengaturan toko hanya dapat diedit oleh akun Admin / Owner (Hairi Habibullah).</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-300 mb-1">Nama Toko / Usaha *</label>
              <input
                type="text"
                disabled={!isAdmin}
                required
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 font-bold disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Slogan / Tagline</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Alamat Workshop / Toko</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nomor WhatsApp / Telp</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                />
              </div>

              {/* Instagram Replaced Email */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Akun Instagram Toko (Dicetak di Struk) *
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  placeholder="@_sandikale"
                  className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-rose-400 font-bold outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Upload File Gambar Logo & QRIS dari Device */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1f2638]">
              {/* Logo Toko Upload */}
              <div className="p-3.5 rounded-2xl bg-[#151926] border border-[#222a3d] space-y-2">
                <span className="font-bold text-slate-200 block">Logo Toko (Upload File)</span>
                {isCompressingLogo ? (
                  <div className="py-4 px-3 rounded-xl border border-[#273248] bg-[#121622] text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                    <span>Mengompres & Menjaga Resolusi Logo...</span>
                  </div>
                ) : form.logoUrl ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={form.logoUrl}
                        alt="Logo"
                        className="w-14 h-14 object-contain rounded-xl bg-white/5 border border-[#2e3448] p-1"
                      />
                      <div className="flex-1">
                        <label className="inline-block py-1 px-2.5 rounded-lg bg-[#20273a] hover:bg-[#2b354e] text-white font-bold text-[11px] cursor-pointer transition">
                          Ganti Logo dari Device
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                    {logoStats && (
                      <div className="p-1 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-center justify-between font-mono">
                        <span className="flex items-center gap-1 font-sans font-bold">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>HD 300 DPI</span>
                        </span>
                        <span>{logoStats.formattedOriginalSize} ➔ {logoStats.formattedCompressedSize}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="w-full py-4 px-3 rounded-xl border border-dashed border-[#2f364a] hover:border-rose-500 bg-[#121622] text-xs font-semibold text-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span>Upload Logo Toko dari Device</span>
                    <span className="text-[10px] text-slate-400">Otomatis dioptimasi tanpa lag (PNG/JPG)</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* QRIS Kasir Upload */}
              <div className="p-3.5 rounded-2xl bg-[#151926] border border-[#222a3d] space-y-2">
                <span className="font-bold text-slate-200 block">Barcode QRIS Kasir (Upload File)</span>
                {isCompressingQris ? (
                  <div className="py-4 px-3 rounded-xl border border-[#273248] bg-[#121622] text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                    <span>Mengompres & Menjaga Ketajaman Barcode...</span>
                  </div>
                ) : form.qrisImageUrl ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={form.qrisImageUrl}
                        alt="QRIS"
                        className="w-14 h-14 object-contain rounded-xl bg-white p-1"
                      />
                      <div className="flex-1">
                        <label className="inline-block py-1 px-2.5 rounded-lg bg-[#20273a] hover:bg-[#2b354e] text-white font-bold text-[11px] cursor-pointer transition">
                          Ganti QRIS dari Device
                          <input type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                    {qrisStats && (
                      <div className="p-1 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-center justify-between font-mono">
                        <span className="flex items-center gap-1 font-sans font-bold">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Pindai Tajam</span>
                        </span>
                        <span>{qrisStats.formattedOriginalSize} ➔ {qrisStats.formattedCompressedSize}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="w-full py-4 px-3 rounded-xl border border-dashed border-[#2f364a] hover:border-rose-500 bg-[#121622] text-xs font-semibold text-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition">
                    <QrCode className="w-4 h-4 text-slate-400" />
                    <span>Upload Gambar QRIS dari Device</span>
                    <span className="text-[10px] text-slate-400">Otomatis dioptimasi tajam untuk kamera HP</span>
                    <input type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold shadow-lg shadow-rose-950/40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Toko</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Receipt Customization */}
        {activeTab === 'receipt' && (
          <form onSubmit={handleSaveStoreSettings} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Format Lebar Kertas Printer Thermal
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, printerPaperSize: '58mm' })}
                  className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    form.printerPaperSize === '58mm'
                      ? 'border-rose-500 bg-rose-950/40 text-rose-300 shadow-sm'
                      : 'border-[#222a3d] bg-[#161a26] text-slate-400'
                  }`}
                >
                  58mm (Printer Thermal Portabel)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, printerPaperSize: '80mm' })}
                  className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    form.printerPaperSize === '80mm'
                      ? 'border-rose-500 bg-rose-950/40 text-rose-300 shadow-sm'
                      : 'border-[#222a3d] bg-[#161a26] text-slate-400'
                  }`}
                >
                  80mm (Desktop POS Thermal)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Pesan Catatan Kaki Struk (Thermal Footer)
              </label>
              <textarea
                rows={3}
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-[#171d2b] border border-[#232b3e] text-white outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-[#161a26] border border-[#222a3d] space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-bold text-white">Efek Suara Audio (Sound Effects)</span>
                <input
                  type="checkbox"
                  checked={form.soundEffectsEnabled}
                  onChange={(e) => setForm({ ...form, soundEffectsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-rose-500 rounded"
                />
              </label>
              <p className="text-[11px] text-slate-400">
                Memainkan suara beep barcode dan nada laci kas kaching saat transaksi lunas.
              </p>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold shadow-lg shadow-rose-950/40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Kustomisasi Struk</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab 3: User Management (Kasir & Produksi) */}
        {activeTab === 'users' && (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">Manajemen Staf Kasir & Produksi</h4>
                <p className="text-slate-400 text-[11px]">
                  Kelola akun, hak akses role, PIN keamanan, dan avatar staf.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddUser(true)}
                  className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Akun Staf</span>
                </button>
              )}
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <form onSubmit={handleCreateUser} className="p-4 rounded-2xl bg-[#161a28] border border-[#273248] space-y-3">
                <h5 className="font-extrabold text-white text-xs">Pendaftaran Staf Baru</h5>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Nama Lengkap Staf *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Cth: Rian Santoso"
                      className="w-full p-2 rounded-xl bg-[#121622] border border-[#273248] text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Username Login *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      placeholder="Cth: rian"
                      className="w-full p-2 rounded-xl bg-[#121622] border border-[#273248] text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Role / Hak Akses *
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="w-full p-2 rounded-xl bg-[#121622] border border-[#273248] text-white font-bold"
                    >
                      <option value="kasir">Kasir (POS & Transaksi)</option>
                      <option value="produksi">Produksi (SPK & Sablon)</option>
                      <option value="admin">Administrator / Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      PIN Keamanan *
                    </label>
                    <input
                      type="password"
                      required
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value)}
                      placeholder={CLOUD_MODE ? 'Minimal 6 karakter' : '1234'}
                      className="w-full p-2 rounded-xl bg-[#121622] border border-[#273248] text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="flex-1 py-2 rounded-xl bg-[#1e2538] text-slate-300 font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                  >
                    Simpan Akun
                  </button>
                </div>
              </form>
            )}

            {/* Users List */}
            <div className="divide-y divide-[#1e2436] rounded-2xl border border-[#212738] bg-[#151926] overflow-hidden">
              {users.map((u) => {
                const isMainAdmin = u.username.toLowerCase().includes('hairi') || u.id === 'usr-admin';
                return (
                  <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-[#181d2c] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-700 to-amber-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isMainAdmin && (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.2 rounded font-bold">
                              Owner
                            </span>
                          )}
                        </h5>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Username: <strong className="text-slate-300">@{u.username}</strong> | Role:{' '}
                          <span className="uppercase text-amber-400 font-bold">{u.role}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-1 rounded bg-[#1c2232] text-slate-400">
                        PIN: ••••
                      </span>
                      {isAdmin && !isMainAdmin && (
                        <button
                          onClick={() => setDeleteTargetUser(u)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                          title="Hapus Akun Pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-white text-sm">Cadangan & Pemulihan Sistem (Backup & Restore)</h4>
              <p className="text-slate-400 text-[11px]">
                Unduh snapshot lengkap data kasir, produk, pesanan, dan pengaturan toko ke format file .JSON yang aman.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Download Backup */}
              <div className="p-4 rounded-2xl bg-[#161a26] border border-[#222a3d] space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <Download className="w-4 h-4" />
                  <span>Unduh File Cadangan Sistem</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Menyimpan file JSON arsip lokal yang mencakup seluruh master produk, riwayat shift, pesanan, dan konfigurasi toko.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await runWithExportLoading(
                      {
                        title: 'Menyiapkan Cadangan Sistem (.JSON)...',
                        subtitle: 'Mengemas seluruh katalog produk, riwayat shift kasir, dan konfigurasi toko...',
                        type: 'backup',
                      },
                      () => {
                        downloadSystemBackup();
                      }
                    );
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Backup (.JSON)</span>
                </button>
              </div>

              {/* Restore Backup */}
              <div className="p-4 rounded-2xl bg-[#161a26] border border-[#222a3d] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Upload className="w-4 h-4" />
                  <span>Muat / Pulihkan Backup</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Pulihkan kembali seluruh data dari file .JSON cadangan sistem sebelumnya.
                </p>
                <label className="w-full py-2.5 px-4 rounded-xl bg-[#1f2638] hover:bg-[#283248] text-slate-200 font-bold flex items-center justify-center gap-2 cursor-pointer transition border border-[#2c3750]">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Pilih File Backup (.JSON)</span>
                  <input type="file" accept=".json" onChange={handleBackupFileSelect} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete User In-App Modal */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#141824] rounded-3xl p-6 border border-rose-900/60 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 flex items-center justify-center border border-rose-800">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-white">Hapus Akun Staf</h4>
                <span className="text-xs text-rose-300 font-mono font-bold">
                  @{deleteTargetUser.username}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun pengguna <strong className="text-white">"{deleteTargetUser.name}"</strong> ({deleteTargetUser.role.toUpperCase()})?
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e2538] text-slate-300 font-bold text-xs hover:bg-[#283248] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
