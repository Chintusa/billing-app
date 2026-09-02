import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  QrCode,
  Globe,
  Zap,
  ExternalLink
} from 'lucide-react';
import { Invoice, LocalWhatsAppInfo, StoreSettings } from '../types';
import {
  sendWhatsAppDocumentApi,
  generateWhatsAppMessage,
  openWhatsAppShare
} from '../services/whatsappService';
import { getAppSettings, saveInvoice } from '../services/db';
import { downloadInvoicePDF } from '../services/pdfService';
import { fetchLocalWhatsAppStatus } from '../services/localWhatsAppClient';
import { sanitizePhoneNumber } from '../services/billing';

interface WhatsAppModalProps {
  invoice: Invoice;
  store: StoreSettings;
  onClose: () => void;
  onInvoiceSuccess?: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  invoice,
  store,
  onClose,
  onInvoiceSuccess
}) => {
  const currentSettings = getAppSettings();
  const provider = currentSettings.whatsapp?.provider || 'local_qr';

  const [phone, setPhone] = useState<string>(invoice.customerPhone || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [localStatus, setLocalStatus] = useState<LocalWhatsAppInfo>({ status: 'DISCONNECTED' });

  useEffect(() => {
    fetchLocalWhatsAppStatus().then(setLocalStatus);
  }, []);

  const customerName = invoice.customerName || 'Customer';
  const formattedTotal = `Rs. ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const captionPreview = `Hello ${customerName},\n\nThank you for your business.\n\nPlease find your invoice attached.\n\nInvoice No: ${invoice.invoiceNumber}\nTotal Amount: ${formattedTotal}\n\nThank you!`;

  const handleSendDocument = async () => {
    const firstPhone = (phone || '').split(',')[0].trim();
    if (!firstPhone || firstPhone.replace(/[^0-9]/g, '').length < 10) {
      setErrorMsg('Please enter a valid customer phone number (at least 10 digits).');
      return;
    }

    if (provider === 'web_click') {
      handleFallbackWebShare();
      return;
    }

    setErrorMsg('');
    setIsSuccess(false);
    setLoading(true);
    setStatusMessage(
      provider === 'local_qr'
        ? 'Sending invoice PDF directly from your linked WhatsApp...'
        : 'Generating PDF & sending via WhatsApp Cloud API...'
    );

    const config = currentSettings.whatsapp;

    try {
      const result = await sendWhatsAppDocumentApi(invoice, store, firstPhone, config);

      if (result.success) {
        setIsSuccess(true);
        setStatusMessage(
          provider === 'local_qr'
            ? 'Invoice PDF sent successfully via your linked WhatsApp!'
            : 'Invoice PDF sent successfully to customer!'
        );
        saveInvoice({ ...invoice, customerPhone: phone.trim(), status: 'Completed' });
        if (onInvoiceSuccess) {
          onInvoiceSuccess();
        }
      } else {
        setErrorMsg(result.message || 'Failed to send WhatsApp message.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    await downloadInvoicePDF(invoice, store);
    setDownloading(false);
  };

  const handleFallbackWebShare = () => {
    const firstPhone = (phone || '').split(',')[0].trim();
    if (!firstPhone || firstPhone.replace(/[^0-9]/g, '').length < 10) {
      setErrorMsg('Please enter a valid customer phone number (at least 10 digits).');
      return;
    }
    const msg = generateWhatsAppMessage(invoice, store);
    openWhatsAppShare(firstPhone, msg);
    setIsSuccess(true);
    setStatusMessage('WhatsApp Web opened in new tab. Send the text message and attach your PDF.');
    saveInvoice({ ...invoice, status: 'Completed' });
    if (onInvoiceSuccess) {
      onInvoiceSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full border border-[#EDEBE9] overflow-hidden text-[#323130] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#25D366] text-white px-5 py-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <h3 className="font-bold text-sm">Send Invoice PDF via WhatsApp</h3>
          </div>
          <button onClick={onClose} className="hover:bg-green-700 p-1 rounded text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Mode Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
            <div className="flex items-center space-x-1.5 text-slate-700">
              <span className="font-semibold">Delivery Mode:</span>
              {provider === 'local_qr' ? (
                localStatus.status === 'CONNECTED' ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-300">
                    <Zap className="w-3 h-3 text-green-600" />
                    <span>Local WhatsApp Free ({localStatus.phoneNumber || 'Linked'})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <QrCode className="w-3 h-3 text-amber-600" />
                    <span>Local WhatsApp (Not Linked)</span>
                  </span>
                )
              ) : provider === 'web_click' ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  <Globe className="w-3 h-3 text-blue-600" />
                  <span>WhatsApp Web (Free Link)</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                  Meta Cloud API
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              {provider === 'local_qr'
                ? localStatus.status === 'CONNECTED'
                  ? 'Sends in background • ₹0 / Free'
                  : 'Link QR in Settings for auto-send'
                : provider === 'web_click'
                ? 'Opens WhatsApp Web • ₹0 / Free'
                : 'Meta Cloud API'}
            </span>
          </div>

          {/* Unlinked Notice if provider is local_qr but not connected */}
          {provider === 'local_qr' && localStatus.status !== 'CONNECTED' && (
            <div className="bg-amber-50 text-amber-900 border border-amber-300 p-3 rounded-lg flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start space-x-2">
                <QrCode className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Your WhatsApp is not linked yet</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    To send PDF bills automatically in the background for free, scan the QR code in Settings. You can also send right now via WhatsApp Web!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFallbackWebShare}
                className="shrink-0 bg-[#25D366] hover:bg-[#1EBE5A] text-white px-2.5 py-1.5 rounded text-[11px] font-bold cursor-pointer transition-colors"
              >
                Send via Web
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-amber-50 text-amber-900 border border-amber-300 p-3.5 rounded-md space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-900">{errorMsg}</p>
                </div>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFallbackWebShare}
                  className="inline-flex items-center space-x-1 bg-[#25D366] hover:bg-[#1EBE5A] text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>Send via WhatsApp Web Now</span>
                </button>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="bg-green-50 text-green-900 border border-green-300 p-3 rounded-md flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="font-bold">{statusMessage}</p>
            </div>
          )}

          {/* Customer Phone Input */}
          <div>
            <label className="block font-bold text-[#605E5C] mb-1">
              Customer Phone Number
            </label>
            <input
              type="text"
              placeholder="e.g. 9876543210, +91-8457816845"
              value={phone}
              disabled={loading}
              onChange={(e) => {
                const cleaned = sanitizePhoneNumber(e.target.value);
                setPhone(cleaned);
                if (errorMsg) setErrorMsg('');
              }}
              onKeyDown={(e) => {
                if (
                  ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key) ||
                  e.ctrlKey || e.metaKey
                ) {
                  return;
                }
                if (!/^[0-9,\-+\s\/()]$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
              className="w-full border border-[#C8C6C4] rounded px-3 py-2 text-[#323130] outline-[#0078D4] font-semibold text-sm bg-white"
            />
          </div>

          {/* Document Preview Info */}
          <div className="bg-[#FAF9F8] border border-[#EDEBE9] rounded p-3 space-y-2">
            <div className="flex items-center justify-between text-[#605E5C]">
              <span className="font-bold flex items-center space-x-1.5 text-xs text-[#0078D4]">
                <FileText className="w-4 h-4" />
                <span>Document Attachment:</span>
              </span>
              <span className="font-mono text-xs font-bold text-[#323130]">
                Invoice-{invoice.invoiceNumber}.pdf
              </span>
            </div>
            <div className="border-t border-[#EDEBE9] pt-2">
              <span className="font-bold block text-[#605E5C] mb-1">WhatsApp Content Preview:</span>
              <pre className="font-sans whitespace-pre-wrap text-[11px] text-[#323130] bg-white p-2 border border-[#C8C6C4] rounded leading-relaxed max-h-32 overflow-y-auto">
                {captionPreview}
              </pre>
            </div>
          </div>

          {/* Download & Fallback links */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center space-x-1 text-[#0078D4] hover:underline font-semibold cursor-pointer text-xs"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download Invoice PDF</span>
            </button>

            <button
              type="button"
              onClick={handleFallbackWebShare}
              className="text-[#25D366] hover:underline font-semibold cursor-pointer text-xs"
            >
              Open in WhatsApp Web / App
            </button>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 border-t border-[#EDEBE9] bg-[#FAF9F8] flex justify-end space-x-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#C8C6C4] rounded text-[#323130] font-semibold hover:bg-[#F3F2F1] cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={isSuccess ? onClose : (provider === 'web_click' || (provider === 'local_qr' && localStatus.status !== 'CONNECTED') ? handleFallbackWebShare : handleSendDocument)}
            disabled={loading}
            className="flex items-center space-x-2 bg-[#25D366] hover:bg-[#1EBE5A] disabled:opacity-50 text-white px-5 py-2 rounded font-bold shadow-xs cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Bill...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Done (Close)</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {provider === 'local_qr' && localStatus.status === 'CONNECTED'
                    ? 'Send Invoice PDF (Linked WhatsApp)'
                    : 'Open & Send via WhatsApp'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
