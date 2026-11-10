export type UserRole = 'admin' | 'kasir' | 'produksi';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  pin: string;
  phone?: string;
  avatar?: string;
  active?: boolean;
}

export type PaymentMethod =
  | 'Cash'
  | 'QRIS'
  | 'Debit'
  | 'Kredit'
  | 'Transfer_BCA'
  | 'Transfer_Mandiri';

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  costPrice: number; // HPP (Harga Pokok Penjualan)
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  img: string; // Base64 Data URL or safe local asset
}

export interface SablonPlacement {
  placement: string; // e.g. "Depan (Dada)", "Belakang (Punggung)", "Lengan Kiri", "Lengan Kanan"
  printSize: string; // e.g. "A3 (29x42cm)", "A4 (21x29cm)", "A5 (15x21cm)", "Logo Saku (10x10cm)"
  price: number;
}

export interface CustomSablonDetails {
  customerName: string;
  customerPhone?: string;
  garmentType: string; // e.g. "Cotton Combed 30s", "Cotton Combed 24s", "Oversize 16s"
  deadline?: string; // estimasi selesai (YYYY-MM-DD)
  garmentSleeve?: string; // "Lengan Pendek" | "Lengan Panjang"
  garmentUnitPrice?: number; // harga bahan kaos per pcs sesuai model lengan
  garmentColor: string; // e.g. "Hitam Jet Black"
  garmentSizes: { [size: string]: number }; // e.g. { S: 0, M: 2, L: 4, XL: 2, XXL: 0, '3XL': 0 }
  placements: SablonPlacement[];
  designMockupUrl?: string; // Upload file desain dari customer (Base64)
  totalPcs: number;
  unitPrice: number;
  totalPrice: number;
  productionNotes?: string;
}

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  costPrice: number;
  qty: number;
  discountAmount: number; // Diskon nominal per item
  discountPercent: number; // Diskon persen per item
  notes?: string;
  customDetails?: CustomSablonDetails;
}

export interface HeldOrder {
  id: string;
  holdCode: string;
  customerName: string;
  tableOrNotes: string;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  heldAt: string;
  heldTimestamp: number;
  cashierName: string;
}

export interface DrawerTransaction {
  id: string;
  time: string;
  type: 'cash_in' | 'cash_out' | 'sale' | 'refund';
  amount: number;
  note: string;
  cashierName: string;
}

export interface ShiftRecord {
  id: string;
  shiftNumber: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startingCash: number; // Modal Awal
  expectedCashEnding: number;
  actualCashEnding?: number; // Hitungan fisik kasir
  cashDifference?: number; // Selisih (+ lebih / - kurang)
  totalSalesCash: number;
  totalSalesNonCash: number;
  totalTransactions: number;
  status: 'open' | 'closed';
  notes?: string;
  drawerTransactions: DrawerTransaction[];
}

export interface OrderPayment {
  id: string;
  date: string;
  timestamp: number;
  amount: number;
  method: PaymentMethod;
  kind: 'dp' | 'pelunasan';
  cashierName: string;
  shiftId?: string;
  note?: string;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  date: string;
  timestamp: number;
  cashierId: string;
  cashierName: string;
  customerName: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  taxRate: number;
  taxAmount: number;
  serviceCharge: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  status: 'completed' | 'voided' | 'dp'; // dp = uang muka diterima, menunggu pelunasan
  remainingBalance?: number; // sisa tagihan pesanan DP
  payments?: OrderPayment[]; // riwayat DP / pelunasan
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  shiftId?: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  instagram: string; // Pengganti email di struk
  taxRatePercent: number;
  enableTax: boolean;
  serviceChargePercent: number;
  enableServiceCharge: boolean;
  receiptHeader: string;
  receiptFooter: string;
  qrisImageUrl: string;
  logoUrl: string;
  printerPaperSize: '58mm' | '80mm';
  soundEffectsEnabled: boolean;
  autoOpenCashDrawer: boolean;
  customerFacingDisplayEnabled: boolean;
}
