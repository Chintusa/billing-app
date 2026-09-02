import { AppSettings, Invoice, StoreSettings } from '../types';
import { capitalizeWords, sanitizePhoneNumber } from './billing';
import { DEFAULT_MARKETING_SETTINGS } from './marketingService';

const SETTINGS_KEY = 'smart_bill_settings_v1';
const INVOICES_KEY = 'smart_bill_invoices_v1';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'TRENDY FASHION STORE',
  tagline: 'Quality Clothing for Everyone',
  address: '123 Market Street, Main Bazaar',
  cityStatePin: 'City, State - PIN Code',
  phone: '9876543210',
  gstin: '29AAAAA0000A1Z5'
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  store: DEFAULT_STORE_SETTINGS,
  tax: {
    gstEnabled: false,
    gstPercentage: 0
  },
  invoice: {
    invoicePrefix: 'INV-2026-',
    nextInvoiceNumber: 1
  },
  printing: {
    defaultPrinter: 'Default Windows Printer',
    paperSize: 'A4'
  },
  marketingFooter: DEFAULT_MARKETING_SETTINGS,
  whatsapp: {
    provider: 'local_qr',
    accessToken: '',
    phoneNumberId: '',
    apiVersion: 'v21.0',
    useTemplate: false,
    templateName: 'invoice_document',
    templateLanguage: 'en_US'
  },
  theme: 'Light',
  currency: '₹'
};

const REMOVED_DEFAULT_NOTE_IDS = new Set([
  'note-thank-you',
  'note-referral',
  'note-whatsapp',
  'note-social',
  'note-feedback',
  'note-festival',
  'note-alteration',
  'note-loyalty'
]);

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawNotes = Array.isArray(parsed.marketingFooter?.notes) ? parsed.marketingFooter.notes : [];
      const sanitizedNotes = rawNotes.filter((n: any) => !REMOVED_DEFAULT_NOTE_IDS.has(n?.id));
      const finalNotes = sanitizedNotes.length > 0 ? sanitizedNotes : DEFAULT_MARKETING_SETTINGS.notes;

      return {
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        marketingFooter: parsed.marketingFooter
          ? {
              ...DEFAULT_MARKETING_SETTINGS,
              ...parsed.marketingFooter,
              delivery: {
                ...DEFAULT_MARKETING_SETTINGS.delivery,
                ...(parsed.marketingFooter.delivery || {})
              },
              notes: finalNotes
            }
          : DEFAULT_MARKETING_SETTINGS
      };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_APP_SETTINGS;
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function getAllInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(INVOICES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load invoices:', e);
  }
  
  // Seed sample invoice if empty so history is not blank on first start
  const sampleInvoices = getInitialSampleInvoices();
  saveAllInvoices(sampleInvoices);
  return sampleInvoices;
}

export function saveAllInvoices(invoices: Invoice[]): void {
  try {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  } catch (e) {
    console.error('Failed to save invoices:', e);
  }
}

export function saveInvoice(invoice: Invoice): Invoice {
  const invoices = getAllInvoices();
  const existingIndex = invoices.findIndex((i) => i.id === invoice.id || i.invoiceNumber === invoice.invoiceNumber);

  let updatedInvoice: Invoice = {
    ...invoice,
    customerName: capitalizeWords(invoice.customerName || ''),
    customerPhone: sanitizePhoneNumber(invoice.customerPhone || ''),
    customerAddress: capitalizeWords(invoice.customerAddress || ''),
    items: (invoice.items || []).map((it) => ({
      ...it,
      itemName: capitalizeWords(it.itemName || '')
    }))
  };

  if (existingIndex >= 0) {
    invoices[existingIndex] = updatedInvoice;
  } else {
    invoices.unshift(updatedInvoice);

    // Update next invoice number counter in settings
    const settings = getAppSettings();
    const currentNumStr = invoice.invoiceNumber.replace(settings.invoice.invoicePrefix, '');
    const currentNum = parseInt(currentNumStr, 10);
    if (!isNaN(currentNum) && currentNum >= settings.invoice.nextInvoiceNumber) {
      settings.invoice.nextInvoiceNumber = currentNum + 1;
      saveAppSettings(settings);
    }
  }

  saveAllInvoices(invoices);
  return updatedInvoice;
}

export function deleteInvoice(id: string): void {
  const invoices = getAllInvoices().filter((i) => i.id !== id);
  saveAllInvoices(invoices);
}

export function generateNextInvoiceNumber(): string {
  const settings = getAppSettings();
  const prefix = settings.invoice?.invoicePrefix || 'INV-2026-';
  const invoices = getAllInvoices();

  let maxNum = 0;
  for (const inv of invoices) {
    if (inv.invoiceNumber) {
      let numStr = '';
      if (inv.invoiceNumber.startsWith(prefix)) {
        numStr = inv.invoiceNumber.substring(prefix.length);
      } else {
        // extract trailing digits if prefix doesn't match exactly
        const match = inv.invoiceNumber.match(/\d+$/);
        if (match) numStr = match[0];
      }
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = Math.max(maxNum + 1, settings.invoice?.nextInvoiceNumber || 1);
  const padded = nextNum.toString().padStart(3, '0');
  return `${prefix}${padded}`;
}

function getInitialSampleInvoices(): Invoice[] {
  return [
    {
      id: 'inv-sample-1',
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '2026-08-10',
      customerName: 'JHASKETAN SA',
      customerPhone: '6371307078',
      customerAddress: 'BRAJAJNAGAR JHARSUGUDA OR',
      items: [
        { id: '1', itemName: 'Regular Item 1', quantity: 1, price: 10, discountPercent: 0, discountAmount: 0, total: 10 },
        { id: '2', itemName: 'Regular Item 2', quantity: 2, price: 20, discountPercent: 0, discountAmount: 0, total: 40 },
        { id: '3', itemName: 'Regular Item 3', quantity: 1, price: 30, discountPercent: 0, discountAmount: 0, total: 30 },
        { id: '4', itemName: 'Regular Item 4', quantity: 1, price: 40, discountPercent: 0, discountAmount: 0, total: 40 }
      ],
      subtotal: 120,
      billDiscountType: 'Flat',
      billDiscountInput: 0,
      billDiscountAmount: 0,
      taxableAmount: 120,
      taxPercent: 0,
      taxAmount: 0,
      grandTotal: 120,
      paymentMethod: 'Cash',
      receivedAmount: 120,
      changeAmount: 0,
      note: '',
      status: 'Completed',
      createdAt: new Date().toISOString()
    }
  ];
}
