import { Invoice, StoreSettings, WhatsAppApiSettings } from '../types';
import { formatCurrency } from './billing';
import { getAppSettings } from './db';
import { resolveInvoiceMarketingNotes } from './marketingService';
import { createInvoicePDF, downloadInvoicePDF } from './pdfService';
import {
  testWhatsAppConnection,
  uploadPdfToWhatsApp,
  sendWhatsAppDocumentMessage,
  sendWhatsAppTemplateDocumentMessage,
  normalizePhoneNumber
} from './whatsappCloudApi';
import { sendLocalWhatsAppInvoicePdf } from './localWhatsAppClient';

export function generateWhatsAppMessage(invoice: Invoice, store: StoreSettings): string {
  const currencySymbol = '₹';
  
  let text = `🧾 *INVOICE FROM ${store.storeName.toUpperCase()}*\n`;
  if (store.tagline) {
    text += `_${store.tagline}_\n`;
  }
  if (store.address) {
    text += `Address: ${store.address}\n`;
  }
  if (store.cityStatePin) {
    text += `${store.cityStatePin}\n`;
  }
  if (store.phone) {
    text += `Ph: ${store.phone}\n`;
  }
  if (store.gstin) {
    text += `GSTIN: ${store.gstin}\n`;
  }
  text += `--------------------------------\n`;
  text += `*Invoice No:* ${invoice.invoiceNumber}\n`;
  text += `*Date:* ${invoice.invoiceDate}\n`;
  if (invoice.customerName) {
    text += `*Customer:* ${invoice.customerName}\n`;
  }
  if (invoice.customerPhone) {
    text += `*Phone:* ${invoice.customerPhone}\n`;
  }
  if (invoice.customerAddress) {
    text += `*Address:* ${invoice.customerAddress}\n`;
  }
  text += `--------------------------------\n`;
  text += `*Items:*\n`;

  invoice.items.forEach((item, idx) => {
    const discExpr = item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '');
    const discLabel = discExpr && discExpr !== '0%' ? ` (${discExpr} off)` : '';
    const itemPriceFormatted = `${currencySymbol}${item.price}`;
    const totalFormatted = formatCurrency(item.total, currencySymbol);
    text += `${idx + 1}. *${item.itemName}* - ${item.quantity} x ${itemPriceFormatted} = ${totalFormatted}${discLabel}\n`;
  });

  text += `--------------------------------\n`;
  text += `*Sub Total:* ${formatCurrency(invoice.subtotal, currencySymbol)}\n`;
  if (invoice.billDiscountAmount > 0) {
    text += `*Extra Discount:* -${formatCurrency(invoice.billDiscountAmount, currencySymbol)}\n`;
  }
  if (invoice.taxAmount > 0) {
    text += `*Tax (GST):* ${formatCurrency(invoice.taxAmount, currencySymbol)}\n`;
  }
  if (invoice.deliveryCharges && invoice.deliveryCharges > 0) {
    text += `*Delivery Fees:* +${formatCurrency(invoice.deliveryCharges, currencySymbol)}\n`;
  }
  text += `*Grand Total:* *${formatCurrency(invoice.grandTotal, currencySymbol)}*\n`;
  text += `*Payment Mode:* ${invoice.paymentMethod}\n`;

  // Marketing Footer Notes
  const currentSettings = getAppSettings();
  const marketingNotes = (invoice.marketingNotes && invoice.marketingNotes.length > 0)
    ? invoice.marketingNotes
    : resolveInvoiceMarketingNotes(currentSettings, invoice.invoiceNumber, invoice.invoiceDate, invoice.grandTotal);

  if (marketingNotes.length > 0) {
    text += `--------------------------------\n`;
    marketingNotes.forEach((mNote) => {
      text += `📢 ${mNote}\n`;
    });
  }

  text += `--------------------------------\n`;
  const footerText = currentSettings.marketingFooter?.customFooterText || 'Thank you for your business! Please visit again.';
  text += `${footerText}`;

  return text;
}

export function openWhatsAppShare(phone: string, text: string): boolean {
  const firstPhone = (phone || '').split(',')[0].trim();
  let formattedPhone = firstPhone ? firstPhone.replace(/[^0-9]/g, '') : '';
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // default to India country code if 10 digits
  }

  const encodedText = encodeURIComponent(text);
  
  let url = '';
  if (formattedPhone) {
    url = `https://wa.me/${formattedPhone}?text=${encodedText}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank');
  return true;
}

export interface SendWhatsAppApiResponse {
  success: boolean;
  message: string;
  invoiceId?: string;
  whatsappMessageId?: string;
  missingCredentials?: boolean;
  details?: any;
}

/**
 * Tests connection to WhatsApp Cloud API.
 * Supports both backend server endpoint and direct client-side Meta Graph API call
 * (essential for static deployments like Netlify where no Express server is running).
 */
export async function testWhatsAppApiConnection(
  config?: Partial<WhatsAppApiSettings>
): Promise<{ success: boolean; message: string; data?: any }> {
  const currentSettings = getAppSettings();
  const token = (config?.accessToken || currentSettings.whatsapp?.accessToken || '').trim();
  const phoneId = (config?.phoneNumberId || currentSettings.whatsapp?.phoneNumberId || '').trim();
  const version = (config?.apiVersion || currentSettings.whatsapp?.apiVersion || 'v21.0').trim() || 'v21.0';

  if (!token || !phoneId) {
    return {
      success: false,
      message: 'Access Token and Phone Number ID are required to test WhatsApp connection.'
    };
  }

  // 1. First attempt via backend endpoint (if Express / Netlify Serverless function exists)
  try {
    const response = await fetch('/api/whatsapp/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        accessToken: token,
        phoneNumberId: phoneId,
        apiVersion: version
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }
  } catch (_backendErr) {
    // If backend is unavailable or offline, fall back directly to client-side Meta API call
  }

  // 2. Direct Client-Side Fallback to Meta Graph API (works on static hosting like Netlify)
  try {
    return await testWhatsAppConnection(token, phoneId, version);
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to WhatsApp Cloud API'
    };
  }
}

/**
 * Sends invoice PDF document via WhatsApp Cloud API.
 * Handles both backend server dispatch and direct client-side dispatch.
 */
export async function sendWhatsAppDocumentApi(
  invoice: Invoice,
  store: StoreSettings,
  recipientPhone: string,
  whatsappConfig?: Partial<WhatsAppApiSettings>
): Promise<SendWhatsAppApiResponse> {
  const currentSettings = getAppSettings();
  const provider = whatsappConfig?.provider || currentSettings.whatsapp?.provider || 'local_qr';
  const token = (whatsappConfig?.accessToken || currentSettings.whatsapp?.accessToken || '').trim();
  const phoneId = (whatsappConfig?.phoneNumberId || currentSettings.whatsapp?.phoneNumberId || '').trim();
  const version = (whatsappConfig?.apiVersion || currentSettings.whatsapp?.apiVersion || 'v21.0').trim() || 'v21.0';
  const useTemplate = whatsappConfig?.useTemplate !== undefined ? whatsappConfig.useTemplate : (currentSettings.whatsapp?.useTemplate ?? false);
  const templateName = (whatsappConfig?.templateName || currentSettings.whatsapp?.templateName || 'invoice_document').trim();
  const templateLanguage = (whatsappConfig?.templateLanguage || currentSettings.whatsapp?.templateLanguage || 'en_US').trim();

  const rawPhone = recipientPhone || invoice.customerPhone || '';
  const phone = normalizePhoneNumber(rawPhone);

  if (!phone || phone.length < 10) {
    return {
      success: false,
      message: 'Invalid customer phone number. Please provide a valid 10-digit phone number.'
    };
  }

  // 1. If provider is Local QR WhatsApp (Free & Background Automated), send via Local Gateway
  if (provider === 'local_qr') {
    const localResult = await sendLocalWhatsAppInvoicePdf(invoice, store, phone);
    if (localResult.success) {
      return {
        success: true,
        message: 'Invoice PDF sent automatically via your Linked WhatsApp!',
        invoiceId: invoice.invoiceNumber,
        whatsappMessageId: localResult.messageId
      };
    }
    return {
      success: false,
      message: localResult.message || 'Failed to send via Linked WhatsApp. Please ensure your device is linked in Settings.',
      details: localResult
    };
  }

  // 2. Attempt dispatch via backend server / Netlify function (Meta Cloud API)
  try {
    const response = await fetch('/api/invoices/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        invoice,
        store,
        recipientPhone: phone,
        whatsappConfig: {
          provider,
          accessToken: token,
          phoneNumberId: phoneId,
          apiVersion: version,
          useTemplate,
          templateName,
          templateLanguage
        }
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (response.ok || data.missingCredentials || data.success !== undefined) {
        return data;
      }
    }
  } catch (_backendErr) {
    // Backend unavailable, fallback to client-side execution
  }

  // 2. Direct Client-Side Dispatch (works 100% on static Netlify deploy)
  if (!token || !phoneId) {
    return {
      success: false,
      missingCredentials: true,
      message: 'WhatsApp Cloud API credentials (Access Token or Phone Number ID) are not configured. Please configure them in Settings.'
    };
  }

  try {
    // Step A: Generate PDF bytes client-side (Vector PDF 1.4)
    const pdfBytes = createInvoicePDF(invoice, store);
    const filename = `Invoice-${invoice.invoiceNumber || '1001'}.pdf`;

    // Step B: Upload PDF to WhatsApp Cloud API Media endpoint
    const uploadResult = await uploadPdfToWhatsApp(pdfBytes, filename, token, phoneId, version);
    if (!uploadResult.success || !uploadResult.mediaId) {
      return {
        success: false,
        message: uploadResult.error || 'Failed to upload PDF media to WhatsApp Cloud API'
      };
    }

    const customerName = invoice.customerName || 'Valued Customer';
    const storeName = store.storeName || 'Store';
    const formattedTotal = `Rs. ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Step C: If Template Mode is enabled, dispatch via Meta WhatsApp Template API
    if (useTemplate && templateName) {
      const bodyParameters = [customerName, storeName, invoice.invoiceNumber, formattedTotal];
      const templateResult = await sendWhatsAppTemplateDocumentMessage(
        phone,
        uploadResult.mediaId,
        filename,
        templateName,
        templateLanguage,
        bodyParameters,
        token,
        phoneId,
        version
      );

      if (templateResult.success) {
        return {
          success: true,
          message: `Invoice PDF sent to WhatsApp using template "${templateName}"!`,
          invoiceId: invoice.invoiceNumber,
          whatsappMessageId: templateResult.whatsappMessageId
        };
      }

      return {
        success: false,
        message: templateResult.message,
        details: templateResult.details
      };
    }

    // Step D: Send standard session document message
    const caption = `Hello ${customerName},\n\nThank you for your business.\n\nPlease find your invoice attached.\n\nInvoice No: ${invoice.invoiceNumber}\nTotal Amount: ${formattedTotal}\n\nThank you!`;
    const sendResult = await sendWhatsAppDocumentMessage(
      phone,
      uploadResult.mediaId,
      filename,
      caption,
      token,
      phoneId,
      version
    );

    if (!sendResult.success) {
      // If failed due to 24h window and template is configured, try template fallback
      if (
        templateName &&
        (sendResult.message.includes('24-Hour') || sendResult.message.includes('131047'))
      ) {
        const bodyParameters = [customerName, storeName, invoice.invoiceNumber, formattedTotal];
        const templateFallbackResult = await sendWhatsAppTemplateDocumentMessage(
          phone,
          uploadResult.mediaId,
          filename,
          templateName,
          templateLanguage,
          bodyParameters,
          token,
          phoneId,
          version
        );

        if (templateFallbackResult.success) {
          return {
            success: true,
            message: `Customer outside 24h window. Successfully sent via template "${templateName}"!`,
            invoiceId: invoice.invoiceNumber,
            whatsappMessageId: templateFallbackResult.whatsappMessageId
          };
        }
      }

      return {
        success: false,
        message: sendResult.message,
        details: sendResult.details
      };
    }

    return {
      success: true,
      message: 'Invoice PDF document sent successfully on WhatsApp',
      invoiceId: invoice.invoiceNumber,
      whatsappMessageId: sendResult.whatsappMessageId
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to dispatch WhatsApp invoice document'
    };
  }
}

/**
 * Downloads invoice PDF with automatic client-side fallback if server is offline.
 */
export async function downloadInvoicePdfApi(invoice: Invoice, store: StoreSettings): Promise<boolean> {
  try {
    const response = await fetch('/api/invoices/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ invoice, store })
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/pdf')) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.invoiceNumber || '1001'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return true;
    }
  } catch (_err) {
    // Backend offline, fallback to client PDF generator
  }

  // Fallback to client-side pure PDF generator
  return downloadInvoicePDF(invoice, store);
}
