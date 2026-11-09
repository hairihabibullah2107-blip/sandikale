import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { PosView } from './components/PosView';
import { TransactionsHistoryView } from './components/TransactionsHistoryView';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ShiftManagementModal } from './components/ShiftManagementModal';
import { CustomerDisplayModal } from './components/CustomerDisplayModal';
import { HeldOrdersModal } from './components/HeldOrdersModal';
import { CustomItemModal } from './components/CustomItemModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';
import { TransactionSuccessModal } from './components/TransactionSuccessModal';
import { ExportLoadingModal } from './components/ExportLoadingModal';
import { Order } from './types';

type ActiveView = 'pos' | 'history' | 'inventory' | 'reports';

function AppContent() {
  const { currentUser, currentShift, storeSettings, exportLoading, authReady, syncReady, cloudMode } = useApp();

  const [activeView, setActiveView] = useState<ActiveView>('pos');

  // Modals state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Payment & Receipt States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentCheckoutData, setPaymentCheckoutData] = useState<{
    customerName: string;
    customerPhone: string;
    discountTotal: number;
  }>({
    customerName: '',
    customerPhone: '',
    discountTotal: 0,
  });
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  const splash = (text: string) => (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#0c0e14] text-slate-300 text-sm">
      <div className="w-10 h-10 rounded-full border-2 border-[#273248] border-t-rose-500 animate-spin" />
      <span>{text}</span>
    </div>
  );

  // Memulihkan sesi (mode cloud), lalu login bila belum masuk, lalu tunggu data pertama dari server.
  if (!authReady) return splash('Memuat sesi...');
  if (!currentUser) {
    return <LoginModal />;
  }
  if (cloudMode && !syncReady) return splash('Menyinkronkan data...');

  const handleOpenPayment = (data: {
    customerName: string;
    customerPhone: string;
    discountTotal: number;
  }) => {
    setPaymentCheckoutData(data);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (order: Order) => {
    setSuccessOrder(order);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0d14] text-slate-100 font-sans antialiased selection:bg-rose-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        onOpenShiftModal={() => setShiftModalOpen(true)}
        onOpenHeldModal={() => setHeldModalOpen(true)}
        onOpenCustomerDisplay={() => setCustomerDisplayOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 overflow-hidden flex flex-col relative bg-[#0d1017]">
        {activeView === 'pos' && (
          <PosView
            onOpenPayment={handleOpenPayment}
            onOpenCustomItem={() => setCustomItemModalOpen(true)}
            onOpenHeldModal={() => setHeldModalOpen(true)}
          />
        )}

        {activeView === 'history' && (
          <TransactionsHistoryView
            onOpenReceipt={(order) => setActiveReceiptOrder(order)}
          />
        )}

        {activeView === 'inventory' && <InventoryView />}

        {activeView === 'reports' && <ReportsView />}
      </main>

      {/* Interactive Modals */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        checkoutData={paymentCheckoutData}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <ReceiptModal
        order={activeReceiptOrder}
        onClose={() => setActiveReceiptOrder(null)}
      />

      <TransactionSuccessModal
        order={successOrder}
        storeSettings={storeSettings}
        onClose={() => setSuccessOrder(null)}
        onOpenReceipt={(order) => {
          setSuccessOrder(null);
          setActiveReceiptOrder(order);
        }}
      />

      <ShiftManagementModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
      />

      <CustomerDisplayModal
        isOpen={customerDisplayOpen}
        onClose={() => setCustomerDisplayOpen(false)}
      />

      <HeldOrdersModal
        isOpen={heldModalOpen}
        onClose={() => setHeldModalOpen(false)}
      />

      <CustomItemModal
        isOpen={customItemModalOpen}
        onClose={() => setCustomItemModalOpen(false)}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* Export & Render High-Resolution Loading Overlay */}
      <ExportLoadingModal state={exportLoading} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
