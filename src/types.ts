export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Wallet' | 'Other';

export interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  printHtml?: (html: string, options?: any) => Promise<{ success: boolean; failureReason?: string }>;
  getPrinters?: () => Promise<any[]>;
  getAppVersion?: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export type DiscountType = 'Flat' | 'Percentage';

export interface InvoiceItem {
  id: string;
  itemName: string;
  quantity: number;
  price: number;
  discountPercent: number; // Effective discount percentage (e.g., 52 for 50+4%)
  discount?: string; // Discount expression e.g. "50+4%" or "10%"
  discountAmount: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  billDiscountType: DiscountType;
  billDiscountInput: number | string;
  billDiscountExpression?: string;
  billDiscountAmount: number;
  taxableAmount: number;
  taxPercent: number;
  taxAmount: number;
  deliveryCharges?: number;
  isDelivery?: boolean;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  receivedAmount: number;
  changeAmount: number;
  note: string;
  marketingNotes?: string[];
  status: 'Completed' | 'Draft' | 'Cancelled';
  createdAt: string; // ISO string
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  address: string;
  cityStatePin: string;
  phone: string;
  gstin: string;
}

export interface TaxSettings {
  gstEnabled: boolean;
  gstPercentage: number;
}

export interface InvoiceSettings {
  invoicePrefix: string;
  nextInvoiceNumber: number;
}

export type PaperSize = 'A4' | 'A5' | 'A6' | 'Thermal 80mm' | 'Thermal 58mm';

export interface PrintingSettings {
  defaultPrinter: string;
  paperSize: PaperSize;
}

export type MarketingNoteCategory =
  | 'Delivery'
  | 'New Arrivals'
  | 'Customer Appreciation'
  | 'Loyalty'
  | 'Referral'
  | 'WhatsApp'
  | 'Social Media'
  | 'Festival'
  | 'Offers'
  | 'Feedback'
  | 'Services'
  | 'General';

export type MarketingNotePriority = 'High' | 'Medium' | 'Low';

export interface MarketingNote {
  id: string;
  title: string;
  content: string;
  category: MarketingNoteCategory;
  priority: MarketingNotePriority;
  active: boolean;
  order: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface DeliverySettings {
  enabled: boolean;
  freeDeliveryAbove?: number;
  standardDeliveryCharge?: number;
  customMessage: string;
}

export interface MarketingFooterSettings {
  enabled: boolean;
  delivery: DeliverySettings;
  maxNotesPerBill: number; // e.g. 1 to 5 (default: 3)
  rotationMode: 'Rotate by Bill Number' | 'All Active' | 'Random';
  showDivider: boolean;
  customFooterText?: string;
  notes: MarketingNote[];
}

export type WhatsAppProvider = 'local_qr' | 'web_click' | 'meta_cloud';

export type LocalWhatsAppStatus = 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';

export interface LocalWhatsAppInfo {
  status: LocalWhatsAppStatus;
  qrCode?: string; // Data URL for QR Image
  phoneNumber?: string;
  name?: string;
  error?: string;
  lastUpdated?: string;
}

export interface WhatsAppApiSettings {
  provider?: WhatsAppProvider; // default: 'local_qr'
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string; // e.g. 'v21.0' or 'v22.0'
  useTemplate?: boolean;
  templateName?: string; // e.g. 'invoice_document'
  templateLanguage?: string; // e.g. 'en_US' or 'en'
}

export interface AppSettings {
  store: StoreSettings;
  tax: TaxSettings;
  invoice: InvoiceSettings;
  printing: PrintingSettings;
  defaultDeliveryCharge?: number;
  marketingFooter?: MarketingFooterSettings;
  whatsapp?: WhatsAppApiSettings;
  theme: string;
  currency: string;
}
