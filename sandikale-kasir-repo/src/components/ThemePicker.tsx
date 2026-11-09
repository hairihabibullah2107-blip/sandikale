import React from 'react';
import { useApp, ThemeId } from '../context/AppContext';
import { Check } from 'lucide-react';

// Warna contoh sengaja ditulis langsung agar tidak ikut berubah saat tema diganti.
const OPTIONS: { id: ThemeId; label: string; bg: string; accent: string }[] = [
  { id: 'dark', label: 'Gelap (Utama)', bg: '#0c0e14', accent: '#e11d48' },
  { id: 'terang', label: 'Terang Lembut', bg: '#eef2f7', accent: '#2a7ab0' },
  { id: 'krem', label: 'Krem Hangat', bg: '#f6efe0', accent: '#1f7a70' },
];

export const ThemePicker: React.FC = () => {
  const { theme, setTheme } = useApp();
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema tampilan">
      {OPTIONS.map((o) => {
        const active = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.id)}
            className={`relative p-2 rounded-xl border text-center cursor-pointer transition ${
              active ? 'border-rose-500 bg-[#1f2638]' : 'border-[#273248] bg-[#171d2b] hover:bg-[#1f2638]'
            }`}
          >
            <span
              className="block h-9 rounded-lg mb-1.5 border border-black/20 relative overflow-hidden"
              style={{ background: o.bg }}
            >
              <span
                className="absolute right-1.5 bottom-1.5 w-4 h-4 rounded-full"
                style={{ background: o.accent }}
              />
              <span className="absolute left-1.5 top-1.5 w-6 h-1.5 rounded-full opacity-40" style={{ background: o.accent }} />
            </span>
            <span className="block text-[10px] font-bold text-slate-200 leading-tight">{o.label}</span>
            {active && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
