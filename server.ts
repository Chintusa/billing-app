import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Invoice, StoreSettings } from './src/types';
import { generateInvoicePDFBuffer } from './src/services/pdfGenerator';
import {
  normalizePhoneNumber,
  uploadPdfToWhatsApp,
  sendWhatsAppDocumentMessage,
  sendWhatsAppTemplateDocumentMessage,
  testWhatsAppConnection
} from './src/services/whatsappCloudApi';
import {
  getLocalWhatsAppStatus,
  initLocalWhatsAppGateway,
  disconnectLocalWhatsAppGateway,
  sendLocalWhatsAppPdf
} from './src/services/whatsappLocalGateway';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Prevent browser caching during local development & POS use
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // --- DEFAULT STORE FALLBACK ---
  const defaultStore: StoreSettings = {
    storeName: 'A-One Retail Solutions',
    tagline: 'Quality Products & Services',
    address: '123 Commercial Market',
    cityStatePin: 'New Delhi - 110001',
    phone: '9876543210',
    gstin: '07AAAAA0000A1Z5'
  };

  // --- HEALTH CHECK ---
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // --- TEST WHATSAPP API CONNECTION ---
  app.post('/api/whatsapp/test-connection', async (req, res) => {
    try {
      const { accessToken, phoneNumberId, apiVersion } = req.body || {};
      const token = (accessToken && accessToken.trim()) || process.env.WHATSAPP_ACCESS_TOKEN || '';
      const phoneId = (phoneNumberId && phoneNumberId.trim()) || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
      const version = (apiVersion && apiVersion.trim()) || process.env.WHATSAPP_API_VERSION || 'v21.0';

      if (!token || !phoneId) {
        return res.status(400).json({
          success: false,
          message: 'Access Token and Phone Number ID are required to test WhatsApp connection.'
        });
      }

      const result = await testWhatsAppConnection(token, phoneId, version);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Failed to test WhatsApp connection' });
    }
  });

  // --- GENERATE & DOWNLOAD PDF ENDPOINT ---
  app.post('/api/invoices/pdf', async (req, res) => {
    try {
      const { invoice, store } = req.body as { invoice: Invoice; store?: StoreSettings };
      if (!invoice || !invoice.items) {
        return res.status(400).json({ success: false, message: 'Invalid or missing invoice data' });
      }

      const storeInfo = store || defaultStore;
      const pdfBuffer = await generateInvoicePDFBuffer(invoice, storeInfo);

      const filename = `Invoice-${invoice.invoiceNumber || '1001'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to generate PDF' });
    }
  });

  // --- SEND WHATSAPP DOCUMENT API ENDPOINT ---
  app.post('/api/invoices/send-whatsapp', async (req, res) => {
    try {
      const { invoice, store, recipientPhone, whatsappConfig } = req.body as {
        invoice: Invoice;
        store?: StoreSettings;
        recipientPhone?: string;
        whatsappConfig?: {
          accessToken?: string;
          phoneNumberId?: string;
          apiVersion?: string;
          useTemplate?: boolean;
          templateName?: string;
          templateLanguage?: string;
        };
      };

      if (!invoice) {
        return res.status(400).json({ success: false, message: 'Missing invoice data' });
      }

      const rawPhone = recipientPhone || invoice.customerPhone || '';
      const phone = normalizePhoneNumber(rawPhone);

      if (!phone || phone.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer phone number. Please provide a valid 10-digit or international phone number.'
        });
      }

      const storeInfo = store || defaultStore;
      const pdfBuffer = await generateInvoicePDFBuffer(invoice, storeInfo);
      const filename = `Invoice-${invoice.invoiceNumber || '1001'}.pdf`;

      const accessToken = (whatsappConfig?.accessToken && whatsappConfig.accessToken.trim()) || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = (whatsappConfig?.phoneNumberId && whatsappConfig.phoneNumberId.trim()) || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const apiVersion = (whatsappConfig?.apiVersion && whatsappConfig.apiVersion.trim()) || process.env.WHATSAPP_API_VERSION || 'v21.0';
      const useTemplate = whatsappConfig?.useTemplate !== undefined ? whatsappConfig.useTemplate : process.env.WHATSAPP_USE_TEMPLATE === 'true';
      const templateName = (whatsappConfig?.templateName && whatsappConfig.templateName.trim()) || process.env.WHATSAPP_TEMPLATE_NAME || 'invoice_document';
      const templateLanguage = (whatsappConfig?.templateLanguage && whatsappConfig.templateLanguage.trim()) || process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

      if (!accessToken || !phoneNumberId) {
        console.warn('WhatsApp credentials not set in request or environment.');
        return res.status(400).json({
          success: false,
          missingCredentials: true,
          message: 'WhatsApp Cloud API credentials (Access Token or Phone Number ID) are not configured. Please set them in Settings or provide them in the WhatsApp configuration.',
          phone,
          invoiceNumber: invoice.invoiceNumber,
          pdfGenerated: true
        });
      }

      // Step 1: Upload PDF to WhatsApp Media endpoint
      const uploadResult = await uploadPdfToWhatsApp(pdfBuffer, filename, accessToken, phoneNumberId, apiVersion);
      if (!uploadResult.success || !uploadResult.mediaId) {
        return res.status(400).json({
          success: false,
          message: uploadResult.error || 'Failed to upload PDF media to WhatsApp Cloud API'
        });
      }

      // Prepare common data
      const customerName = invoice.customerName || 'Valued Customer';
      const formattedTotal = `Rs. ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Step 2: If Template Mode is configured, send using WhatsApp Message Template
      if (useTemplate && templateName) {
        const bodyParameters = [customerName, storeInfo.storeName || 'Store', invoice.invoiceNumber, formattedTotal];
        const templateResult = await sendWhatsAppTemplateDocumentMessage(
          phone,
          uploadResult.mediaId,
          filename,
          templateName,
          templateLanguage,
          bodyParameters,
          accessToken,
          phoneNumberId,
          apiVersion
        );

        if (!templateResult.success) {
          return res.status(400).json({
            success: false,
            message: templateResult.message,
            details: templateResult.details
          });
        }

        return res.json({
          success: true,
          message: `Invoice PDF sent successfully via template "${templateName}"!`,
          invoiceId: invoice.invoiceNumber,
          whatsappMessageId: templateResult.whatsappMessageId
        });
      }

      // Step 3: Send document message via WhatsApp Cloud API
      const caption = `Hello ${customerName},\n\nThank you for your business.\n\nPlease find your invoice attached.\n\nInvoice No: ${invoice.invoiceNumber}\nTotal Amount: ${formattedTotal}\n\nThank you!`;
      const sendResult = await sendWhatsAppDocumentMessage(
        phone,
        uploadResult.mediaId,
        filename,
        caption,
        accessToken,
        phoneNumberId,
        apiVersion
      );

      if (!sendResult.success) {
        // Check if failed due to 24h window and template is defined
        if (templateName && (sendResult.message.includes('24-Hour') || sendResult.message.includes('131047'))) {
          const bodyParameters = [customerName, storeInfo.storeName || 'Store', invoice.invoiceNumber, formattedTotal];
          const templateFallback = await sendWhatsAppTemplateDocumentMessage(
            phone,
            uploadResult.mediaId,
            filename,
            templateName,
            templateLanguage,
            bodyParameters,
            accessToken,
            phoneNumberId,
            apiVersion
          );

          if (templateFallback.success) {
            return res.json({
              success: true,
              message: `Customer outside 24h window. Sent successfully via template "${templateName}"!`,
              invoiceId: invoice.invoiceNumber,
              whatsappMessageId: templateFallback.whatsappMessageId
            });
          }
        }

        return res.status(400).json({
          success: false,
          message: sendResult.message,
          details: sendResult.details
        });
      }

      return res.json({
        success: true,
        message: 'Invoice PDF sent successfully on WhatsApp as a document attachment',
        invoiceId: invoice.invoiceNumber,
        whatsappMessageId: sendResult.whatsappMessageId
      });
    } catch (err: any) {
      console.error('Error in send-whatsapp handler:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to send WhatsApp invoice document'
      });
    }
  });

  // --- LOCAL WHATSAPP GATEWAY (FREE QR SCANNER) ENDPOINTS ---
  app.get('/api/whatsapp-local/status', (_req, res) => {
    res.json(getLocalWhatsAppStatus());
  });

  app.post('/api/whatsapp-local/start', async (req, res) => {
    try {
      const { forceNew } = req.body || {};
      const info = await initLocalWhatsAppGateway(forceNew === true);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ status: 'DISCONNECTED', error: err.message || 'Failed to start local WhatsApp' });
    }
  });

  app.post('/api/whatsapp-local/logout', async (_req, res) => {
    try {
      const result = await disconnectLocalWhatsAppGateway();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to logout' });
    }
  });

  app.post('/api/whatsapp-local/send-pdf', async (req, res) => {
    try {
      const { invoice, store, recipientPhone } = req.body as {
        invoice: Invoice;
        store?: StoreSettings;
        recipientPhone?: string;
      };

      if (!invoice) {
        return res.status(400).json({ success: false, message: 'Missing invoice data' });
      }

      const rawPhone = recipientPhone || invoice.customerPhone || '';
      const phone = normalizePhoneNumber(rawPhone);

      if (!phone || phone.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customer phone number. Please provide a valid 10-digit phone number.'
        });
      }

      const storeInfo = store || defaultStore;
      const pdfBuffer = await generateInvoicePDFBuffer(invoice, storeInfo);
      const filename = `Invoice-${invoice.invoiceNumber || '1001'}.pdf`;

      const customerName = invoice.customerName || 'Valued Customer';
      const formattedTotal = `Rs. ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const caption = `Hello ${customerName},\n\nThank you for your purchase at ${storeInfo.storeName}!\n\nPlease find your Invoice ${invoice.invoiceNumber} attached.\nTotal Amount: ${formattedTotal}\n\nThank you for your business!`;

      const result = await sendLocalWhatsAppPdf(phone, pdfBuffer, filename, caption);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json({
        success: true,
        message: 'Invoice PDF sent successfully via linked WhatsApp!',
        invoiceId: invoice.invoiceNumber,
        messageId: result.messageId
      });
    } catch (err: any) {
      console.error('Error in send-local-pdf handler:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to send WhatsApp document through linked WhatsApp'
      });
    }
  });

  // Attempt auto-reconnect if session exists
  try {
    const credsPath = path.resolve(process.cwd(), '.whatsapp_auth/creds.json');
    if (fs.existsSync(credsPath)) {
      console.log('[Local WhatsApp] Existing session found, initializing background connection...');
      initLocalWhatsAppGateway(false).catch((e) => console.log('[Local WhatsApp] Auto-init note:', e.message));
    }
  } catch (e) {
    // ignore
  }

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 200,
          ignored: ['**/.whatsapp_auth/**', '**/dist/**', '**/.git/**']
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
