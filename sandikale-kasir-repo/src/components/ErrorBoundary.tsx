import React from 'react';

// Catatan galat ringan (disimpan di perangkat, maksimal 20 entri) untuk membantu penelusuran masalah.
export function logAppError(source: string, message: string) {
  try {
    const key = 'sandikale_error_log';
    const raw = localStorage.getItem(key);
    const list: { t: string; source: string; message: string }[] = raw ? JSON.parse(raw) : [];
    list.unshift({ t: new Date().toISOString(), source, message: String(message).slice(0, 300) });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => logAppError('window', e.message));
  window.addEventListener('unhandledrejection', (e) =>
    logAppError('promise', (e.reason && (e.reason.message || String(e.reason))) || 'unhandled rejection')
  );
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    logAppError('render', error.message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#0c0e14',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Tampilan mengalami kendala</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            Data transaksi tetap aman di perangkat ini. Muat ulang halaman untuk melanjutkan.
          </p>
          <code style={{ display: 'block', fontSize: 11, color: '#fca5a5', marginBottom: 16, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </code>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 0,
              background: '#e11d48',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }
}
