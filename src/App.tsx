import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';
import { Header } from './components/Header';
import { NewBillView } from './components/NewBillView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { WhatsAppModal } from './components/WhatsAppModal';
import { AppSettings, Invoice, PaperSize } from './types';
import { getAppSettings } from './services/db';
import { printInvoiceToPrinter } from './services/printService';
import { downloadInvoicePDF } from './services/pdfService';
import { getTheme, applyThemeToDocument } from './services/themeService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'new-bill' | 'history' | 'settings'>('new-bill');
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [newBillKey, setNewBillKey] = useState<number>(0);

  const currentTheme = getTheme(settings.theme);

  // Apply theme dynamically to entire document & CSS custom properties
  useEffect(() => {
    applyThemeToDocument(currentTheme);
  }, [settings.theme, currentTheme]);

  // Active Modals
  const [whatsappModalInvoice, setWhatsappModalInvoice] = useState<Invoice | null>(null);

  const handleTabSelect = (tab: 'new-bill' | 'history' | 'settings') => {
    if (tab === 'new-bill' && activeTab === 'new-bill') {
      setNewBillKey((prev) => prev + 1);
    }
    setActiveTab(tab);
  };

  // Global Keyboard Shortcuts (Ctrl+N for New Bill, Ctrl+H for History, Esc to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (whatsappModalInvoice) setWhatsappModalInvoice(null);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleTabSelect('new-bill');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setActiveTab('history');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [whatsappModalInvoice, activeTab]);

  const handlePrint = (invoice: Invoice, overridePaperSize?: PaperSize | string) => {
    printInvoiceToPrinter(invoice, settings.store, overridePaperSize || settings.printing.paperSize);
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    await downloadInvoicePDF(invoice, settings.store);
  };

  const handleWhatsApp = (invoice: Invoice) => {
    setWhatsappModalInvoice(invoice);
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden font-sans antialiased select-none transition-colors duration-300"
      style={{
        backgroundColor: currentTheme.appBg,
        color: currentTheme.textColor
      }}
    >
      {/* Top Header & Navigation Bar */}
      <Header activeTab={activeTab} setActiveTab={handleTabSelect} theme={settings.theme} />

      {/* Main Tab Content */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'new-bill' && (
          <NewBillView
            key={newBillKey}
            settings={settings}
            onPrint={handlePrint}
            onDownloadPdf={handleDownloadPdf}
            onWhatsApp={handleWhatsApp}
            onSaved={() => { }}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            settings={settings}
            onPrint={handlePrint}
            onDownloadPdf={handleDownloadPdf}
            onWhatsApp={handleWhatsApp}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSettingsSaved={(newSet) => setSettings(newSet)}
          />
        )}
      </main>

      {/* Bottom Status Bar & Developer Credit */}
      <footer
        className="h-6.5 px-3.5 shrink-0 flex items-center justify-between text-[11px] border-t select-none transition-colors duration-300 z-10"
        style={{
          backgroundColor: currentTheme.isDark ? '#0b1120' : '#ffffff',
          borderColor: currentTheme.cardBorder,
          color: currentTheme.mutedText
        }}
      >
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50" />
          <span className="font-medium text-[11px]">System Ready • Offline Billing Active</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span>Crafted with <span className="text-red-500">❤️</span> by</span>
          <a
            href="https://codenpixels.in"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#0078D4] dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Code N Pixels</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>
      </footer>

      {/* WhatsApp Sharing Modal */}
      {whatsappModalInvoice && (
        <WhatsAppModal
          invoice={whatsappModalInvoice}
          store={settings.store}
          onClose={() => setWhatsappModalInvoice(null)}
          onInvoiceSuccess={() => {
            // Refreshes the NewBill form with the new incremented invoice number
            setNewBillKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
