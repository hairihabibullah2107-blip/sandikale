import React from 'react';
import { FileDown, Printer, Sparkles, CheckCircle2, Cpu } from 'lucide-react';

export interface ExportLoadingState {
  isOpen: boolean;
  title: string;
  subtitle: string;
  type?: 'pdf' | 'csv' | 'backup' | 'print';
}

interface ExportLoadingModalProps {
  state: ExportLoadingState;
}

export const ExportLoadingModal: React.FC<ExportLoadingModalProps> = ({ state }) => {
  if (!state.isOpen) return null;

  const isPdf = state.type === 'pdf' || state.title.toLowerCase().includes('pdf');
  const isCsv = state.type === 'csv' || state.title.toLowerCase().includes('csv');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121622] rounded-3xl p-6 sm:p-8 border border-[#262f44] max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Central High-Tech Animated Radar / Spinner */}
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          {/* Outer Pulsing Glow Ring */}
          <div className="absolute inset-0 rounded-full bg-rose-500/15 animate-ping opacity-60" />
          
          {/* Rotating Gradient Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-rose-500 border-r-amber-500 animate-spin" />
          
          {/* Inner Counter-Rotating Ring */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-rose-400 border-l-sky-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />

          {/* Central Icon Box */}
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/60">
            {isPdf ? (
              <Printer className="w-6 h-6 animate-pulse" />
            ) : isCsv ? (
              <FileDown className="w-6 h-6 animate-pulse" />
            ) : (
              <Sparkles className="w-6 h-6 animate-pulse" />
            )}
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-[11px] font-bold text-rose-300">
            <Cpu className="w-3.5 h-3.5 animate-pulse" />
            <span>Sistem Rendering Aktif</span>
          </div>

          <h3 className="font-extrabold text-base sm:text-lg text-white">
            {state.title || 'Sedang Merender Dokumen...'}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
            {state.subtitle ||
              'Menghitung tata letak halaman, mengoptimasi resolusi gambar, dan menyusun data ekspor...'}
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-2 bg-[#1b2234] rounded-full overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-500 rounded-full w-full animate-[progress_1.6s_ease-in-out_infinite]" />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>Resolusi Tinggi (300 DPI)</span>
            <span className="text-rose-400 font-bold">Harap tunggu sebentar...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
