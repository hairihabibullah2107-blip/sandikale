import React from 'react';
import { useApp } from '../context/AppContext';
import { Cloud, CloudOff, RefreshCw, TriangleAlert, HardDrive } from 'lucide-react';

/** Indikator status sinkronisasi data (Online / Menyinkronkan / Offline / Lokal). */
export const SyncBadge: React.FC = () => {
  const { syncStatus, syncReady } = useApp();
  const { mode, state, message, lastSyncAt } = syncStatus;

  let label = 'Online';
  let cls = 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  let icon = <Cloud className="w-3.5 h-3.5" />;
  if (mode === 'lokal') {
    label = 'Lokal';
    cls = 'text-slate-300 border-[#273248] bg-[#161a26]';
    icon = <HardDrive className="w-3.5 h-3.5" />;
  } else if (!syncReady || state === 'connecting' || state === 'syncing') {
    label = 'Sinkron...';
    cls = 'text-amber-300 border-amber-500/30 bg-amber-500/10';
    icon = <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
  } else if (state === 'offline') {
    label = 'Offline';
    cls = 'text-rose-300 border-rose-500/30 bg-rose-500/10';
    icon = <CloudOff className="w-3.5 h-3.5" />;
  } else if (state === 'error') {
    label = 'Gagal sinkron';
    cls = 'text-rose-300 border-rose-500/30 bg-rose-500/10';
    icon = <TriangleAlert className="w-3.5 h-3.5" />;
  }

  const title =
    mode === 'lokal'
      ? 'Mode lokal: data tersimpan di perangkat ini dan tersinkron antar-tab.'
      : `${label}${message ? ' - ' + message : ''}${lastSyncAt ? ' | terakhir ' + new Date(lastSyncAt).toLocaleTimeString('id-ID') : ''}`;

  return (
    <div
      title={title}
      className={`h-10 px-2.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-bold shrink-0 ${cls}`}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
};
