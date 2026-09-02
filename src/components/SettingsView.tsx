import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Building,
  Percent,
  FileText,
  Printer,
  Sliders,
  MessageSquare,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Palette,
  Sparkles,
  Check,
  Info,
  ExternalLink,
  Copy,
  QrCode,
  Smartphone,
  RefreshCw,
  LogOut,
  Zap,
  Globe,
  ShieldCheck,
  Megaphone,
  Truck,
  Tag,
  Plus,
  Trash2,
  Edit3,
  ChevronUp,
  ChevronDown,
  Calendar,
  Receipt,
  ShoppingBag,
  ArrowUpDown,
  X,
  Upload,
  Database,
  FileSpreadsheet,
  Download,
  HardDrive
} from 'lucide-react';
import {
  AppSettings,
  DeliverySettings,
  LocalWhatsAppInfo,
  MarketingFooterSettings,
  MarketingNote,
  MarketingNoteCategory,
  MarketingNotePriority,
  PaperSize,
  WhatsAppProvider
} from '../types';
import { capitalizeWords, sanitizePhoneNumber } from '../services/billing';
import { DEFAULT_APP_SETTINGS, saveAppSettings, exportAppDataBackup, importAppDataBackup, exportInvoicesToCSV, getAllInvoices } from '../services/db';
import { testWhatsAppApiConnection } from '../services/whatsappService';
import {
  fetchLocalWhatsAppStatus,
  startLocalWhatsApp,
  logoutLocalWhatsApp
} from '../services/localWhatsAppClient';
import {
  DEFAULT_MARKETING_NOTES,
  DEFAULT_MARKETING_SETTINGS
} from '../services/marketingService';
import { THEMES } from '../services/themeService';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsSaved: (newSettings: AppSettings) => void;
}

const CATEGORIES: MarketingNoteCategory[] = [
  'Delivery',
  'New Arrivals',
  'Customer Appreciation',
  'Loyalty',
  'Referral',
  'WhatsApp',
  'Social Media',
  'Festival',
  'Offers',
  'Feedback',
  'Services',
  'General'
];

const CATEGORY_COLORS: Record<MarketingNoteCategory, { bg: string; text: string; border: string }> = {
  'Delivery': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'New Arrivals': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Customer Appreciation': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'Loyalty': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Referral': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'WhatsApp': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Social Media': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'Festival': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Offers': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Feedback': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'Services': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  'General': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsSaved
}) => {
  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
    marketingFooter: {
      ...DEFAULT_MARKETING_SETTINGS,
      ...(settings.marketingFooter || {}),
      delivery: {
        ...DEFAULT_MARKETING_SETTINGS.delivery,
        ...(settings.marketingFooter?.delivery || {})
      },
      notes: Array.isArray(settings.marketingFooter?.notes) && settings.marketingFooter.notes.length > 0
        ? settings.marketingFooter.notes
        : DEFAULT_MARKETING_NOTES
    },
    whatsapp: {
      provider: 'local_qr',
      accessToken: '',
      phoneNumberId: '',
      apiVersion: 'v21.0',
      useTemplate: false,
      templateName: 'invoice_document',
      templateLanguage: 'en_US',
      ...(settings.whatsapp || {})
    }
  });

  // Floating Toast Notification System
  const [toast, setToast] = useState<{
    id: number;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  } | null>(null);

  const showToast = (
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    setToast({ id: Date.now(), title, message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((prev) => (prev?.id === toast.id ? null : prev));
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // In-app Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    highlightText?: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  const [showToken, setShowToken] = useState<boolean>(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);
  const [showTemplateGuide, setShowTemplateGuide] = useState<boolean>(false);

  // Backup & Restore State
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);
  const [backupModalData, setBackupModalData] = useState<{
    rawJson: string;
    invoiceCount: number;
    storeName: string;
    exportedAt?: string;
  } | null>(null);

  const handleExportBackupClick = () => {
    exportAppDataBackup();
    showToast('Backup Created', 'Full application backup file (.json) downloaded successfully!', 'success');
  };

  const handleExportCsvClick = () => {
    exportInvoicesToCSV();
    showToast('CSV Exported', 'All invoices exported to CSV spreadsheet successfully!', 'success');
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const invCount = Array.isArray(parsed.invoices) ? parsed.invoices.length : (Array.isArray(parsed) ? parsed.length : 0);
        const store = parsed.settings?.store?.storeName || parsed.storeName || 'Smart Bill Store';

        setBackupModalData({
          rawJson: text,
          invoiceCount: invCount,
          storeName: store,
          exportedAt: parsed.exportedAt
        });
      } catch (err: any) {
        showToast('Invalid File', 'The selected file is not a valid Smart Bill JSON backup file.', 'error');
      }
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const executeRestore = (mode: 'merge' | 'replace') => {
    if (!backupModalData) return;
    const result = importAppDataBackup(backupModalData.rawJson, mode);
    if (result.success) {
      showToast('Restore Complete', result.message, 'success');
      const updatedSettings = JSON.parse(localStorage.getItem('smart_bill_settings_v1') || '{}');
      setFormData(updatedSettings);
      onSettingsSaved(updatedSettings);
    } else {
      showToast('Restore Failed', result.message, 'error');
    }
    setBackupModalData(null);
  };

  // Marketing Note Management State
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [noteModalOpen, setNoteModalOpen] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<{
    title: string;
    content: string;
    category: MarketingNoteCategory;
    priority: MarketingNotePriority;
    active: boolean;
    order: number;
    startDate: string;
    endDate: string;
  }>({
    title: '',
    content: '',
    category: 'General',
    priority: 'Medium',
    active: true,
    order: 1,
    startDate: '',
    endDate: ''
  });

  // Local WhatsApp QR Gateway State
  const [localStatus, setLocalStatus] = useState<LocalWhatsAppInfo>({
    status: 'DISCONNECTED'
  });
  const [loadingQr, setLoadingQr] = useState<boolean>(false);

  // Poll Local WhatsApp status
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      const info = await fetchLocalWhatsAppStatus();
      if (isMounted) {
        setLocalStatus(info);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleStartLocalQr = async (forceNew: boolean = false) => {
    setLoadingQr(true);
    const info = await startLocalWhatsApp(forceNew);
    setLocalStatus(info);
    setLoadingQr(false);
  };

  const handleLogoutLocalQr = async () => {
    setLoadingQr(true);
    await logoutLocalWhatsApp();
    const info = await fetchLocalWhatsAppStatus();
    setLocalStatus(info);
    setLoadingQr(false);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveAppSettings(formData);
    onSettingsSaved(formData);
    showToast(
      'Settings Updated Successfully',
      'All store details, billing rules, and marketing templates are now live.',
      'success'
    );
  };

  // Keyboard Shortcut: Ctrl+S / Cmd+S saves settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  const handleThemeChange = (newThemeId: string) => {
    const updated = { ...formData, theme: newThemeId };
    setFormData(updated);
    saveAppSettings(updated);
    onSettingsSaved(updated);
  };

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true);
    setTestResult(null);
    try {
      const res = await testWhatsAppApiConnection(formData.whatsapp);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleReset = () => {
    setConfirmModal({
      title: 'Reset All Settings',
      description: 'Are you sure you want to reset all application settings, store details, and printer preferences back to factory defaults?',
      confirmLabel: 'Reset Everything',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        setFormData(DEFAULT_APP_SETTINGS);
        saveAppSettings(DEFAULT_APP_SETTINGS);
        onSettingsSaved(DEFAULT_APP_SETTINGS);
        setConfirmModal(null);
        showToast('Settings Reset', 'All settings have been restored to default values.', 'info');
      }
    });
  };

  // --- Marketing Note Handlers ---
  const currentNotes = formData.marketingFooter?.notes || DEFAULT_MARKETING_NOTES;

  const handleToggleNote = (id: string) => {
    const updated = currentNotes.map((n) => (n.id === id ? { ...n, active: !n.active } : n));
    setFormData({
      ...formData,
      marketingFooter: {
        ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
        notes: updated
      }
    });
  };

  const handleDeleteNote = (id: string) => {
    const target = currentNotes.find((n) => n.id === id);
    setConfirmModal({
      title: 'Delete Marketing Note',
      description: 'Are you sure you want to delete this marketing note? It will no longer appear on printed or PDF receipts.',
      highlightText: target?.title,
      confirmLabel: 'Delete Note',
      cancelLabel: 'Keep Note',
      variant: 'danger',
      onConfirm: () => {
        const updated = currentNotes.filter((n) => n.id !== id);
        const newSettings = {
          ...formData,
          marketingFooter: {
            ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
            notes: updated
          }
        };
        setFormData(newSettings);
        saveAppSettings(newSettings);
        onSettingsSaved(newSettings);
        setConfirmModal(null);
        showToast('Marketing Note Deleted', `"${target?.title || 'Note'}" has been removed.`, 'info');
      }
    });
  };

  const handleMoveNote = (id: string, direction: 'up' | 'down') => {
    const notes = [...currentNotes];
    const index = notes.findIndex((n) => n.id === id);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= notes.length) return;

    const temp = notes[index];
    notes[index] = notes[targetIndex];
    notes[targetIndex] = temp;
    notes.forEach((n, idx) => {
      n.order = idx + 1;
    });

    setFormData({
      ...formData,
      marketingFooter: {
        ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
        notes
      }
    });
  };

  const handleOpenAddNote = () => {
    setEditingNoteId(null);
    setNoteForm({
      title: '',
      content: '',
      category: 'General',
      priority: 'Medium',
      active: true,
      order: currentNotes.length + 1,
      startDate: '',
      endDate: ''
    });
    setNoteModalOpen(true);
  };

  const handleOpenEditNote = (note: MarketingNote) => {
    setEditingNoteId(note.id);
    setNoteForm({
      title: note.title,
      content: note.content,
      category: note.category,
      priority: note.priority,
      active: note.active,
      order: note.order,
      startDate: note.startDate || '',
      endDate: note.endDate || ''
    });
    setNoteModalOpen(true);
  };

  const handleSaveNoteModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.title.trim() || !noteForm.content.trim()) {
      showToast('Missing Details', 'Please provide both note title and content message.', 'warning');
      return;
    }

    const notes = [...currentNotes];
    if (editingNoteId) {
      const updated = notes.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              title: capitalizeWords(noteForm.title.trim()),
              content: noteForm.content.trim(),
              category: noteForm.category,
              priority: noteForm.priority,
              active: noteForm.active,
              order: Number(noteForm.order) || 1,
              startDate: noteForm.startDate || undefined,
              endDate: noteForm.endDate || undefined
            }
          : n
      );
      const newSettings = {
        ...formData,
        marketingFooter: {
          ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
          notes: updated
        }
      };
      setFormData(newSettings);
      saveAppSettings(newSettings);
      onSettingsSaved(newSettings);
      showToast('Note Updated', `"${capitalizeWords(noteForm.title.trim())}" has been saved.`, 'success');
    } else {
      const newNote: MarketingNote = {
        id: `note-${Date.now()}`,
        title: capitalizeWords(noteForm.title.trim()),
        content: noteForm.content.trim(),
        category: noteForm.category,
        priority: noteForm.priority,
        active: noteForm.active,
        order: Number(noteForm.order) || notes.length + 1,
        startDate: noteForm.startDate || undefined,
        endDate: noteForm.endDate || undefined
      };
      const newSettings = {
        ...formData,
        marketingFooter: {
          ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
          notes: [...notes, newNote]
        }
      };
      setFormData(newSettings);
      saveAppSettings(newSettings);
      onSettingsSaved(newSettings);
      showToast('Note Added', `"${capitalizeWords(noteForm.title.trim())}" has been added.`, 'success');
    }
    setNoteModalOpen(false);
  };

  const handleResetNotesToDefault = () => {
    setConfirmModal({
      title: 'Reset Curated Templates',
      description: 'This will reset marketing footer notes back to the default 2 notes (Home Delivery & New Arrivals). Any custom marketing notes will be replaced.',
      confirmLabel: 'Reset Templates',
      cancelLabel: 'Cancel',
      variant: 'warning',
      onConfirm: () => {
        const newSettings = {
          ...formData,
          marketingFooter: {
            ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
            notes: DEFAULT_MARKETING_NOTES
          }
        };
        setFormData(newSettings);
        saveAppSettings(newSettings);
        onSettingsSaved(newSettings);
        setConfirmModal(null);
        showToast('Templates Restored', 'Marketing notes restored to default templates.', 'success');
      }
    });
  };

  // Filter notes for table display
  const filteredNotes = currentNotes.filter((n) => {
    if (categoryFilter === 'All') return true;
    return n.category === categoryFilter;
  });

  return (
    <div className="flex-1 p-4 lg:p-6 bg-[#F3F2F1] text-[#323130] overflow-y-auto font-sans relative">
      <div className="max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION 1: STORE INFORMATION */}
          <div className="bg-white rounded-lg shadow-sm border border-[#EDEBE9] p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#EDEBE9] pb-3 text-[#0078D4]">
              <Building className="w-5 h-5" />
              <h2 className="font-bold text-sm tracking-wide uppercase">Store Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={formData.store.storeName}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, storeName: capitalizeWords(e.target.value) }
                    })
                  }
                  onBlur={() =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, storeName: capitalizeWords(formData.store.storeName.trim()) }
                    })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.store.tagline}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, tagline: capitalizeWords(e.target.value) }
                    })
                  }
                  onBlur={() =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, tagline: capitalizeWords(formData.store.tagline.trim()) }
                    })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={formData.store.address}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, address: capitalizeWords(e.target.value) }
                    })
                  }
                  onBlur={() =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, address: capitalizeWords(formData.store.address.trim()) }
                    })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">City / State / PIN Code</label>
                <input
                  type="text"
                  value={formData.store.cityStatePin}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, cityStatePin: capitalizeWords(e.target.value) }
                    })
                  }
                  onBlur={() =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, cityStatePin: capitalizeWords(formData.store.cityStatePin.trim()) }
                    })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Store Phone Number(s)</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210, +91-8457816845"
                  value={formData.store.phone}
                  onChange={(e) => {
                    const cleaned = sanitizePhoneNumber(e.target.value);
                    setFormData({
                      ...formData,
                      store: { ...formData.store, phone: cleaned }
                    });
                  }}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">GSTIN</label>
                <input
                  type="text"
                  value={formData.store.gstin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      store: { ...formData.store, gstin: e.target.value.toUpperCase() }
                    })
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: INVOICE, TAX & DELIVERY SETTINGS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Invoice Configuration */}
            <div className="bg-white rounded-lg shadow-sm border border-[#EDEBE9] p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-[#EDEBE9] pb-3 text-[#0078D4]">
                <FileText className="w-5 h-5" />
                <h2 className="font-bold text-sm tracking-wide uppercase">Invoice Format</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.invoice.invoicePrefix}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoice: { ...formData.invoice, invoicePrefix: e.target.value }
                      })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Next Invoice Number Counter</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.invoice.nextInvoiceNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoice: {
                          ...formData.invoice,
                          nextInvoiceNumber: parseInt(e.target.value, 10) || 1
                        }
                      })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Preview: <span className="font-bold font-mono text-blue-600">{formData.invoice.invoicePrefix}{String(formData.invoice.nextInvoiceNumber).padStart(3, '0')}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tax Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-[#EDEBE9] p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-[#EDEBE9] pb-3 text-[#0078D4]">
                <Percent className="w-5 h-5" />
                <h2 className="font-bold text-sm tracking-wide uppercase">GST / Tax Configuration</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800">Enable GST Calculation</span>
                    <p className="text-[10px] text-slate-500">Automatically calculate tax on bill totals</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.tax.gstEnabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tax: { ...formData.tax, gstEnabled: e.target.checked }
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {formData.tax.gstEnabled && (
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Default GST Percentage (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.tax.gstPercentage}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tax: { ...formData.tax, gstPercentage: parseFloat(e.target.value) || 0 }
                        })
                      }
                      className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Billing Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-[#EDEBE9] p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-[#EDEBE9] pb-3 text-[#0078D4]">
                <Truck className="w-5 h-5" />
                <h2 className="font-bold text-sm tracking-wide uppercase">Delivery Billing</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Default Delivery Charge (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={formData.defaultDeliveryCharge !== undefined ? formData.defaultDeliveryCharge : 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultDeliveryCharge: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Auto-fills the delivery fee whenever "Home Delivery Order" is checked on a bill.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: PRINTING, APPEARANCE & THEMES */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Printing */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 text-[#1A56BE]">
                <Printer className="w-5 h-5" />
                <h2 className="font-bold text-sm tracking-wide uppercase">Printing</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Default Printer Name</label>
                  <input
                    type="text"
                    value={formData.printing.defaultPrinter}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        printing: { ...formData.printing, defaultPrinter: e.target.value }
                      })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Paper Size</label>
                  <select
                    value={formData.printing.paperSize}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        printing: {
                          ...formData.printing,
                          paperSize: e.target.value as PaperSize
                        }
                      })
                    }
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800 bg-slate-50/30 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    <option value="A4">A4 Standard Full Sheet (210 × 297 mm)</option>
                    <option value="A5">A5 Half Sheet Book (148 × 210 mm)</option>
                    <option value="A6">A6 Compact Quarter Sheet (105 × 148 mm)</option>
                    <option value="Thermal 80mm">Thermal POS Receipt (80mm Width)</option>
                    <option value="Thermal 58mm">Thermal POS Receipt (58mm Width)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Application Appearance & Themes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 sm:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-[#1A56BE]">
                <div className="flex items-center space-x-2">
                  <Palette className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-sm tracking-wide uppercase text-slate-800">
                    Application Appearance &amp; Themes
                  </h2>
                </div>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{THEMES.length} Themes</span>
                </span>
              </div>

              <div className="space-y-4 text-xs">
                {/* Theme Cards Grid */}
                <div>
                  <label className="block text-slate-700 font-bold mb-2">Select Visual Theme:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 max-h-48 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-200">
                    {THEMES.map((theme) => {
                      const isSelected = formData.theme === theme.id;
                      return (
                        <div
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 bg-white ${
                            isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-[11px] text-slate-800 truncate">{theme.name}</div>
                            <div className="text-[9px] text-slate-500 truncate">{theme.category}</div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div className="flex items-center space-x-1">
                              {theme.previewColors.map((col, idx) => (
                                <span
                                  key={idx}
                                  className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                                  style={{ backgroundColor: col }}
                                  title={col}
                                />
                              ))}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Currency Symbol */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Quick Select</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['₹', '$', '€', '£', 'AED', 'SAR'].map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => setFormData({ ...formData, currency: curr })}
                          className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                            formData.currency === curr
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: CUSTOMER MARKETING NOTES & SMART BILL FOOTER */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-[#0078D4]">
                <Megaphone className="w-5 h-5" />
                <div>
                  <h2 className="font-bold text-sm tracking-wide uppercase text-slate-800">
                    Customer Marketing Notes &amp; Smart Bill Footer
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Engage customers with delivery notices, new collections, social links &amp; seasonal offers on every printed bill.
                  </p>
                </div>
              </div>

              {/* Master Toggle */}
              <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Enable Bill Footer:</span>
                <input
                  type="checkbox"
                  checked={formData.marketingFooter?.enabled ?? true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      marketingFooter: {
                        ...(formData.marketingFooter || DEFAULT_MARKETING_SETTINGS),
                        enabled: e.target.checked
                      }
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {formData.marketingFooter?.enabled && (
              <div className="space-y-6">
                {/* 1. DELIVERY POLICY CARD (MANDATORY NOTE #1) */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 rounded-xl p-4 border border-emerald-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                    <div className="flex items-center space-x-2 text-emerald-800">
                      <Truck className="w-4 h-4" />
                      <span className="font-bold uppercase tracking-wide">1. Home Delivery Policy (Always Note #1)</span>
                    </div>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-emerald-900">
                      <input
                        type="checkbox"
                        checked={formData.marketingFooter.delivery.enabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            marketingFooter: {
                              ...formData.marketingFooter!,
                              delivery: {
                                ...formData.marketingFooter!.delivery,
                                enabled: e.target.checked
                              }
                            }
                          })
                        }
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>Display Delivery Info</span>
                    </label>
                  </div>

                  {formData.marketingFooter.delivery.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-emerald-900 font-semibold mb-1">Free Delivery Above (₹)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 2000"
                          value={formData.marketingFooter.delivery.freeDeliveryAbove ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              marketingFooter: {
                                ...formData.marketingFooter!,
                                delivery: {
                                  ...formData.marketingFooter!.delivery,
                                  freeDeliveryAbove: e.target.value ? Number(e.target.value) : undefined
                                }
                              }
                            })
                          }
                          className="w-full border border-emerald-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                        <p className="text-[10px] text-emerald-700 mt-0.5">Auto-shows "Free Delivery" if bill qualifies</p>
                      </div>

                      <div>
                        <label className="block text-emerald-900 font-semibold mb-1">Standard Charge (₹)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 50"
                          value={formData.marketingFooter.delivery.standardDeliveryCharge ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              marketingFooter: {
                                ...formData.marketingFooter!,
                                delivery: {
                                  ...formData.marketingFooter!.delivery,
                                  standardDeliveryCharge: e.target.value ? Number(e.target.value) : undefined
                                }
                              }
                            })
                          }
                          className="w-full border border-emerald-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                        <p className="text-[10px] text-emerald-700 mt-0.5">Reference standard delivery fee</p>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-emerald-900 font-semibold mb-1">Custom Delivery Note Message</label>
                        <textarea
                          rows={2}
                          value={formData.marketingFooter.delivery.customMessage}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              marketingFooter: {
                                ...formData.marketingFooter!,
                                delivery: {
                                  ...formData.marketingFooter!.delivery,
                                  customMessage: e.target.value
                                }
                              }
                            })
                          }
                          className="w-full border border-emerald-300 rounded p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. RECEIPT & ROTATION SETTINGS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Max Notes per Bill</label>
                    <select
                      value={formData.marketingFooter.maxNotesPerBill}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          marketingFooter: {
                            ...formData.marketingFooter!,
                            maxNotesPerBill: parseInt(e.target.value, 10) || 3
                          }
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value={1}>1 Note (Very Compact)</option>
                      <option value={2}>2 Notes (Recommended for 58mm)</option>
                      <option value={3}>3 Notes (Recommended for 80mm/A4)</option>
                      <option value={4}>4 Notes</option>
                      <option value={5}>5 Notes</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Prevents overcrowding thermal paper</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Note Rotation Strategy</label>
                    <select
                      value={formData.marketingFooter.rotationMode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          marketingFooter: {
                            ...formData.marketingFooter!,
                            rotationMode: e.target.value as any
                          }
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Rotate by Bill Number">Rotate by Bill Number (Fresh every receipt)</option>
                      <option value="All Active">Sequential (In Order of Priority)</option>
                      <option value="Random">Randomized Selection</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Consecutive bills show varied touchpoints</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Closing Footer Line</label>
                    <input
                      type="text"
                      value={formData.marketingFooter.customFooterText || ''}
                      placeholder="Thank you for shopping with us! Please visit again."
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          marketingFooter: {
                            ...formData.marketingFooter!,
                            customFooterText: e.target.value
                          }
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Final thank you message at receipt bottom</p>
                  </div>
                </div>

                {/* 3. MARKETING NOTES MANAGER */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                        Marketing Notes Directory ({currentNotes.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Manage promotions, loyalty notes, social links, and seasonal messages.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleResetNotesToDefault}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Restore 10 curated starter note templates"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset 10 Templates</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenAddNote}
                        className="px-3 py-1.5 bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-bold rounded shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add New Note</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('All')}
                      className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        categoryFilter === 'All'
                          ? 'bg-[#0078D4] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({currentNotes.length})
                    </button>
                    {CATEGORIES.map((cat) => {
                      const count = currentNotes.filter((n) => n.category === cat).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                            categoryFilter === cat
                              ? 'bg-[#0078D4] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Notes Card List */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredNotes.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-xs">
                        No marketing notes found in this category.
                      </div>
                    ) : (
                      filteredNotes.map((note, idx) => {
                        const col = CATEGORY_COLORS[note.category] || CATEGORY_COLORS['General'];
                        return (
                          <div
                            key={note.id}
                            className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              note.active
                                ? 'bg-white border-slate-200 shadow-2xs'
                                : 'bg-slate-50/70 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="font-mono font-bold text-[11px] text-slate-400">
                                  #{note.order || idx + 1}
                                </span>
                                <span className="font-bold text-xs text-slate-800 uppercase tracking-tight">
                                  {note.title}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.bg} ${col.text} ${col.border}`}
                                >
                                  {note.category}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    note.priority === 'High'
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : note.priority === 'Medium'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {note.priority}
                                </span>
                                {(note.startDate || note.endDate) && (
                                  <span className="text-[9.5px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                                    <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                    <span>
                                      {note.startDate || 'Any'} → {note.endDate || 'Any'}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{note.content}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-1.5 self-end sm:self-center shrink-0">
                              {/* Move Order Up/Down */}
                              <div className="flex items-center border border-slate-200 rounded bg-slate-50">
                                <button
                                  type="button"
                                  onClick={() => handleMoveNote(note.id, 'up')}
                                  className="p-1 hover:bg-slate-200 text-slate-600 rounded-l cursor-pointer"
                                  title="Move Up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveNote(note.id, 'down')}
                                  className="p-1 hover:bg-slate-200 text-slate-600 rounded-r cursor-pointer"
                                  title="Move Down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Active Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleNote(note.id)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                                  note.active
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {note.active ? 'Active' : 'Disabled'}
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditNote(note)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                                title="Edit Note"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                                title="Delete Note"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: WHATSAPP INTEGRATION CONFIGURATION */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-[#25D366]">
                <MessageSquare className="w-5 h-5" />
                <h2 className="font-bold text-sm tracking-wide uppercase text-slate-800">
                  WhatsApp Bill Dispatching
                </h2>
              </div>
              <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-emerald-600" />
                <span>100% Free &amp; Automated Options</span>
              </span>
            </div>

            {/* Delivery Method Card (Link Your WhatsApp) */}
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold text-xs">
                WhatsApp Delivery Method:
              </label>
              <div>
                {/* OPTION 1: Local QR Code (Recommended & Free) */}
                <div
                  className="p-3.5 rounded-xl border-2 border-[#25D366] bg-green-50/40 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                      <QrCode className="w-4 h-4 text-[#25D366]" />
                      <span>Link Your WhatsApp</span>
                    </span>
                    <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Scan QR code with your phone. Sends branded PDF invoices directly &amp; automatically from your number for <strong>100% Free</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Provider Configuration Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-800">Connection Status:</span>
                    {localStatus.status === 'CONNECTED' ? (
                      <span className="inline-flex items-center space-x-1 bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        <span>Connected ({localStatus.phoneNumber || 'Linked'})</span>
                      </span>
                    ) : localStatus.status === 'SCAN_QR' ? (
                      <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-300">
                        <QrCode className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span>Waiting for QR Scan</span>
                      </span>
                    ) : localStatus.status === 'CONNECTING' ? (
                      <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-bold border border-blue-300">
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        <span>Connecting...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                        <span>Not Linked</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Link your WhatsApp once, and bills will dispatch automatically in the background.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {localStatus.status === 'CONNECTED' ? (
                    <button
                      type="button"
                      onClick={handleLogoutLocalQr}
                      disabled={loadingQr}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartLocalQr(true)}
                      disabled={loadingQr}
                      className="px-4 py-1.5 bg-[#25D366] hover:bg-[#1EBE5A] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                    >
                      {loadingQr ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating QR...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{localStatus.status === 'SCAN_QR' ? 'Refresh QR Code' : 'Scan QR Code to Link'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* QR Code Display Card */}
              {localStatus.status === 'SCAN_QR' && localStatus.qrCode && (
                <div className="bg-white p-5 rounded-xl border border-amber-300 shadow-sm flex flex-col sm:flex-row items-center gap-6">
                  <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-inner shrink-0">
                    <img src={localStatus.qrCode} alt="WhatsApp Link QR" className="w-48 h-48" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-[#25D366]" />
                      <span>How to link your WhatsApp:</span>
                    </h4>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 text-xs">
                      <li>Open WhatsApp on your phone</li>
                      <li>Tap <strong>Settings / Menu (⋮)</strong> → <strong>Linked Devices</strong></li>
                      <li>Tap <strong>Link a Device</strong> and point your camera at this QR code</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6: DATA BACKUP, RESTORE & MIGRATION */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Data Backup, Restore & Migration</h3>
                  <p className="text-[11px] text-slate-500">Safely backup all your bills and settings, or migrate data from the hosted website into this app.</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <input
                type="file"
                ref={backupFileInputRef}
                onChange={handleBackupFileSelect}
                accept=".json"
                className="hidden"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Export Backup Card */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 text-blue-800 font-bold">
                      <Download className="w-4 h-4" />
                      <span>1. Export Full Backup (.json)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Download all store profile settings, tax rules, delivery options, and historical invoices into a portable backup file.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportBackupClick}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Backup JSON</span>
                  </button>
                </div>

                {/* 2. Import & Restore Card */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 text-emerald-800 font-bold">
                      <Upload className="w-4 h-4" />
                      <span>2. Import / Restore Backup</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Restore bills and settings from a previously saved backup file. You can choose to merge bills or do a full restore.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select Backup File to Restore</span>
                  </button>
                </div>

                {/* 3. Export CSV Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 text-slate-800 font-bold">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>3. Export to Excel (CSV)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Export all sales records, invoice amounts, tax, and customer names to a CSV spreadsheet for accounting or Excel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsvClick}
                    className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download CSV Spreadsheet</span>
                  </button>
                </div>
              </div>

              {/* Migration Helper Tip */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px]">
                  <strong className="font-semibold">Migrating from Hosted Web Version to Electron Desktop App?</strong>
                  <p className="text-amber-800 leading-relaxed">
                    1. Open your hosted web app in your browser, go to <strong>Settings</strong>, and click <strong>"Download Backup JSON"</strong>.<br/>
                    2. Open this Desktop Application, click <strong>"Select Backup File to Restore"</strong>, and choose <strong>"Merge &amp; Keep All Bills"</strong>. All your previous bills will appear instantly!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 7: SOFTWARE INFO & DEVELOPER SHOWCASE */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl shadow-sm p-5 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                  SB
                </div>
                <h3 className="font-bold text-sm tracking-tight text-white">Smart Bill - Billing Software</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Modern, offline-ready point of sale &amp; billing software tailored for retail businesses.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">Crafted with ❤️ by</span>
              <a
                href="https://codenpixels.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 border border-white/10 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Visit Code N Pixels (codenpixels.in)</span>
                <ExternalLink className="w-3 h-3 opacity-90" />
              </a>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              className="inline-flex items-center space-x-2 bg-[#1A56BE] hover:bg-blue-800 text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
              title="Save all changes (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings (Ctrl+S)</span>
            </button>
          </div>
        </form>
      </div>

      {/* ADD / EDIT MARKETING NOTE MODAL */}
      {noteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
            <div className="bg-[#0078D4] text-white px-5 py-3.5 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Megaphone className="w-4 h-4" />
                <h3 className="font-bold text-sm">
                  {editingNoteId ? 'Edit Marketing Note' : 'Add New Marketing Note'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="hover:bg-white/20 p-1 rounded text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNoteModal} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Note Title / Tagline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FESTIVE OFFER, STAY CONNECTED, LOVE OUR APPAREL?"
                  value={noteForm.title}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) => setNoteForm({ ...noteForm, title: capitalizeWords(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category</label>
                  <select
                    value={noteForm.category}
                    onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value as MarketingNoteCategory })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority</label>
                  <select
                    value={noteForm.priority}
                    onChange={(e) => setNoteForm({ ...noteForm, priority: e.target.value as MarketingNotePriority })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="High">High Priority (Appears First)</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Note Content Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the customer retention message or announcement..."
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 leading-relaxed font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Display Order Sequence</label>
                  <input
                    type="number"
                    min="1"
                    value={noteForm.order}
                    onChange={(e) => setNoteForm({ ...noteForm, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="modalActiveToggle"
                    checked={noteForm.active}
                    onChange={(e) => setNoteForm({ ...noteForm, active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="modalActiveToggle" className="text-slate-700 font-bold cursor-pointer">
                    Note is Active
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Optional Start Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={noteForm.startDate}
                    onChange={(e) => setNoteForm({ ...noteForm, startDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Optional End Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={noteForm.endDate}
                    onChange={(e) => setNoteForm({ ...noteForm, endDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0078D4] hover:bg-[#106EBE] text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING POP-UP TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-5 right-5 z-100 max-w-sm w-full shadow-2xl pointer-events-auto animate-toast">
          <div
            className={`relative flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-2xl overflow-hidden ${
              toast.type === 'success'
                ? 'bg-slate-900/95 text-white border-emerald-500/40 ring-1 ring-emerald-500/30'
                : toast.type === 'warning'
                ? 'bg-slate-900/95 text-white border-amber-500/40 ring-1 ring-amber-500/30'
                : toast.type === 'error'
                ? 'bg-slate-900/95 text-white border-red-500/40 ring-1 ring-red-500/30'
                : 'bg-slate-900/95 text-white border-blue-500/40 ring-1 ring-blue-500/30'
            }`}
          >
            {/* Icon */}
            <div
              className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                toast.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : toast.type === 'warning'
                  ? 'bg-amber-500/20 text-amber-400'
                  : toast.type === 'error'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : toast.type === 'warning' ? (
                <AlertCircle className="w-5 h-5" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>

            {/* Text content */}
            <div className="flex-1 pr-1">
              <h4 className="text-xs font-bold text-white tracking-tight">{toast.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Animated Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
              <div
                className={`h-full animate-toast-progress ${
                  toast.type === 'success'
                    ? 'bg-emerald-400'
                    : toast.type === 'warning'
                    ? 'bg-amber-400'
                    : toast.type === 'error'
                    ? 'bg-red-400'
                    : 'bg-blue-400'
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION POP-UP MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-backdrop"
            onClick={() => setConfirmModal(null)}
          />

          {/* Dialog Card */}
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-pop-in z-10 text-slate-800 dark:text-slate-100">
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50'
                    : confirmModal.variant === 'warning'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50'
                }`}
              >
                {confirmModal.variant === 'danger' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {confirmModal.description}
                </p>
                {confirmModal.highlightText && (
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    "{confirmModal.highlightText}"
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {confirmModal.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                    : confirmModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-[#0078D4] hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                {confirmModal.variant === 'danger' && <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmModal.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE / IMPORT MODAL */}
      {backupModalData && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-backdrop"
            onClick={() => setBackupModalData(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-pop-in z-10 text-slate-800 dark:text-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Restore Smart Bill Data
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Found <strong className="text-slate-800 dark:text-slate-200">{backupModalData.invoiceCount} invoices</strong> for store <strong className="text-slate-800 dark:text-slate-200">"{backupModalData.storeName}"</strong>.
                </p>
                {backupModalData.exportedAt && (
                  <p className="text-[11px] text-slate-400">
                    Backup Date: {new Date(backupModalData.exportedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <p className="text-slate-600 dark:text-slate-300 font-medium">How would you like to restore this data?</p>
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => executeRestore('merge')}
                  className="w-full text-left p-3 rounded-xl border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 transition-colors cursor-pointer"
                >
                  <div className="font-bold text-emerald-900 flex items-center justify-between">
                    <span>Merge with Existing Bills (Recommended)</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Safe</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Keeps all current bills on this machine and adds any new bills from the backup file without creating duplicates.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => executeRestore('replace')}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    Full Restore (Replace All)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Overwrites all settings and invoices to match the backup file exactly.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBackupModalData(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
