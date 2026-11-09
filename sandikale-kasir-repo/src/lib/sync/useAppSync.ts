import { useEffect, useRef, useState } from 'react';
import { CollectionSync, SyncPhase } from './CollectionSync';
import { getBackend } from '../backend';
import { CLOUD_MODE } from '../env';
import { logAppError } from '../../components/ErrorBoundary';
import type { Order, Product, ShiftRecord, StoreSettings, User } from '../../types';

export type SyncState = 'connecting' | 'online' | 'syncing' | 'offline' | 'error';
export interface SyncStatus {
  mode: 'lokal' | 'cloud';
  state: SyncState;
  lastSyncAt: number | null;
  message?: string;
}

type SettingsItem = StoreSettings & { id: string };

interface Params {
  enabled: boolean; // pengguna sudah masuk
  role?: string;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  shifts: ShiftRecord[];
  setShifts: React.Dispatch<React.SetStateAction<ShiftRecord[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  storeSettings: StoreSettings;
  setStoreSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  onRemoteSettings?: () => void;
}

/**
 * Menghubungkan state aplikasi ke backend (Supabase atau penyimpanan lokal antar-tab):
 * - ambil data awal, lalu terima perubahan dari perangkat/pengguna lain secara realtime;
 * - kirim perubahan lokal ke server (stok lewat delta atomik).
 */
export function useAppSync(p: Params) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({
    mode: CLOUD_MODE ? 'cloud' : 'lokal',
    state: 'connecting',
    lastSyncAt: null,
  });

  // Nilai terbaru untuk dibaca mesin sinkron (tanpa membuat ulang mesin).
  const latest = useRef(p);
  latest.current = p;
  const engines = useRef<Record<string, CollectionSync<any>>>({});

  useEffect(() => {
    if (!p.enabled) return;
    let cancelled = false;
    let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
    const phases: Record<string, SyncPhase> = {};
    let lastError: string | undefined;
    let online = true;
    let hiddenAt = 0;

    const recompute = () => {
      if (cancelled) return;
      const all = Object.values(phases);
      const state: SyncState = !online
        ? 'offline'
        : all.includes('error')
        ? 'error'
        : all.includes('syncing')
        ? 'syncing'
        : 'online';
      setStatus((prev) => ({
        ...prev,
        state,
        message: state === 'error' ? lastError : undefined,
        lastSyncAt: state === 'online' ? Date.now() : prev.lastSyncAt,
      }));
    };
    const onPhase = (name: string) => (ph: SyncPhase, err?: Error) => {
      phases[name] = ph;
      if (err) {
        lastError = err.message;
        logAppError('sync:' + name, err.message);
      }
      recompute();
    };

    const make = async () => {
      const backend = await getBackend();
      const L = () => latest.current;
      const common = { backend, onPhase: undefined as any };

      engines.current = {
        products: new CollectionSync<Product>({
          ...common, table: 'products', stockField: true, insertAt: 'end',
          getState: () => L().products, setState: (u) => L().setProducts(u),
          seedWhenEmpty: () => !CLOUD_MODE, onPhase: onPhase('products'),
        }),
        orders: new CollectionSync<Order>({
          ...common, table: 'orders', insertAt: 'start',
          getState: () => L().orders, setState: (u) => L().setOrders(u),
          seedWhenEmpty: () => !CLOUD_MODE, onPhase: onPhase('orders'),
        }),
        shifts: new CollectionSync<ShiftRecord>({
          ...common, table: 'shifts', insertAt: 'start',
          getState: () => L().shifts, setState: (u) => L().setShifts(u),
          seedWhenEmpty: () => !CLOUD_MODE, onPhase: onPhase('shifts'),
        }),
        users: new CollectionSync<User>({
          ...common, table: 'users', insertAt: 'end',
          getState: () => L().users, setState: (u) => L().setUsers(u),
          seedWhenEmpty: () => !CLOUD_MODE, onPhase: onPhase('users'),
          canPush: () => !CLOUD_MODE || L().role === 'admin',
        }),
        settings: new CollectionSync<SettingsItem>({
          ...common, table: 'settings', insertAt: 'end',
          getState: () => [{ id: '1', ...L().storeSettings }],
          setState: (u) => {
            const next = u([{ id: '1', ...L().storeSettings }]);
            if (next[0]) {
              const { id: _id, ...rest } = next[0];
              L().setStoreSettings(rest as StoreSettings);
            }
          },
          // Mode cloud: admin mengisi pengaturan awal bila server masih kosong.
          seedWhenEmpty: () => !CLOUD_MODE || L().role === 'admin',
          seedOnEmptyRows: true,
          onRemote: (e) => {
            if (e.type === 'upsert') L().onRemoteSettings?.();
          },
          onPhase: onPhase('settings'),
        }),
      };

      const hydrateAll = async () => {
        try {
          await Promise.all(Object.values(engines.current).map((e) => e.hydrate()));
          if (cancelled) return;
          Object.values(engines.current).forEach((e) => e.start());
          setReady(true);
        } catch (err) {
          if (cancelled) return;
          lastError = (err as Error).message;
          logAppError('hydrate', lastError);
          phases.hydrate = 'error';
          recompute();
          hydrateTimer = setTimeout(hydrateAll, 5000);
        }
      };
      await hydrateAll();

      backend.onConnection((isOnline) => {
        const was = online;
        online = isOnline;
        recompute();
        if (isOnline && !was) Object.values(engines.current).forEach((e) => void e.resync());
      });
    };
    void make();

    const onVisible = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30000) {
        hiddenAt = 0;
        Object.values(engines.current).forEach((e) => void e.resync());
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (hydrateTimer) clearTimeout(hydrateTimer);
      document.removeEventListener('visibilitychange', onVisible);
      Object.values(engines.current).forEach((e) => e.stop());
      engines.current = {};
      setReady(false);
      setStatus((s) => ({ ...s, state: 'connecting' }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.enabled]);

  // Kirim perubahan lokal ke server.
  useEffect(() => void engines.current.products?.schedulePush(), [p.products]);
  useEffect(() => void engines.current.orders?.schedulePush(), [p.orders]);
  useEffect(() => void engines.current.shifts?.schedulePush(), [p.shifts]);
  useEffect(() => void engines.current.users?.schedulePush(), [p.users]);
  useEffect(() => void engines.current.settings?.schedulePush(), [p.storeSettings]);

  return { ready, status };
}
