import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Calendar,
  Printer,
  Download,
  Share2,
  Trash2,
  Eye,
  RefreshCw,
  X,
  Upload,
  FileSpreadsheet,
  Database,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ReceiptText
} from 'lucide-react';
import { AppSettings, Invoice, PaperSize } from '../types';
import {
  deleteInvoice,
  getAllInvoices,
  exportAppDataBackup,
  importAppDataBackup,
  exportInvoicesToCSV
} from '../services/db';
import { formatCurrency } from '../services/billing';

interface HistoryViewProps {
  settings: AppSettings;
  onPrint: (invoice: Invoice, overridePaperSize?: PaperSize | string) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onWhatsApp: (invoice: Invoice) => void;
}

type SortField = 'date' | 'number' | 'customer' | 'total';
type SortOrder = 'asc' | 'desc';

export const HistoryView: React.FC<HistoryViewProps> = ({
  settings,
  onPrint,
  onDownloadPdf,
  onWhatsApp
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sorting & Pagination States
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadInvoices = () => {
    setInvoices(getAllInvoices());
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteInvoice(deleteConfirmId);
      loadInvoices();
      if (selectedInvoice?.id === deleteConfirmId) {
        setSelectedInvoice(null);
      }
      setDeleteConfirmId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = importAppDataBackup(content, 'merge');
        if (result.success) {
          loadInvoices();
          setImportStatus(result.message);
          setTimeout(() => setImportStatus(null), 5000);
        } else {
          alert(result.message);
        }
      } catch (err: any) {
        alert('Failed to read file: ' + err.message);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Filtered and Sorted Invoices
  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.includes(q) ||
        (inv.items && inv.items.some((it) => it.itemName.toLowerCase().includes(q)));

      const matchesDate = !dateFilter || inv.invoiceDate === dateFilter;

      return matchesSearch && matchesDate;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        const timeA = new Date(a.invoiceDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.invoiceDate || b.createdAt || 0).getTime();
        comparison = timeA - timeB;
      } else if (sortField === 'number') {
        comparison = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '', undefined, {
          numeric: true
        });
      } else if (sortField === 'customer') {
        comparison = (a.customerName || '').localeCompare(b.customerName || '');
      } else if (sortField === 'total') {
        comparison = (a.grandTotal || 0) - (b.grandTotal || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [invoices, searchQuery, dateFilter, sortField, sortOrder]);

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [searchQuery, dateFilter, pageSize, sortField, sortOrder]);

  // Summary Metrics for filtered view
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  }, [filteredInvoices]);

  // Pagination calculations
  const totalItems = filteredInvoices.length;
  const isAll = pageSize === 'all';
  const effectivePageSize = isAll ? Math.max(totalItems, 1) : pageSize;
  const totalPages = isAll ? 1 : Math.ceil(totalItems / effectivePageSize) || 1;
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const displayedInvoices = useMemo(() => {
    if (isAll) return filteredInvoices;
    const startIndex = (validCurrentPage - 1) * effectivePageSize;
    return filteredInvoices.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredInvoices, isAll, validCurrentPage, effectivePageSize]);

  const startIndex = totalItems === 0 ? 0 : isAll ? 1 : (validCurrentPage - 1) * effectivePageSize + 1;
  const endIndex = isAll ? totalItems : Math.min(validCurrentPage * effectivePageSize, totalItems);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 ml-1 inline text-slate-400" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 ml-1 inline" />
    );
  };

  // Quick Today Filter
  const setTodayFilter = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDateFilter(today);
  };

  return (
    <div className="flex-1 h-full min-h-0 w-full p-3.5 sm:p-5 bg-[#F3F2F1] text-[#323130] font-sans flex flex-col gap-3 overflow-hidden">
      {/* Top Filter Header Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 shrink-0 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left Section: Search & Date Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search invoice #, customer, phone, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-lg text-xs outline-blue-600 text-slate-800 focus:ring-1 focus:ring-blue-500 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Filter with Today Chip */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-blue-600 text-slate-800 bg-white"
              />
            </div>
            {dateFilter ? (
              <button
                onClick={() => setDateFilter('')}
                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            ) : (
              <button
                onClick={setTodayFilter}
                className="px-2 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded font-medium transition-colors cursor-pointer"
                title="Filter bills created today"
              >
                Today
              </button>
            )}
          </div>

          {/* Quick Metrics Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50/80 border border-blue-200/80 rounded-lg text-xs text-blue-900 font-medium">
            <ReceiptText className="w-3.5 h-3.5 text-blue-600" />
            <span>
              <strong>{totalItems}</strong> bills
            </span>
            <span className="text-blue-300">•</span>
            <span>
              Total: <strong>{formatCurrency(totalRevenue, settings.currency)}</strong>
            </span>
          </div>
        </div>

        {/* Right Section: Action Buttons (Backup, Import, CSV, Refresh) */}
        <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => exportAppDataBackup()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition-colors cursor-pointer text-xs"
            title="Download full backup file (.json) with all bills and settings"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup (JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold transition-colors cursor-pointer text-xs"
            title="Import bills and settings from a backup file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={() => exportInvoicesToCSV()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold transition-colors cursor-pointer text-xs"
            title="Export all bills to CSV spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={loadInvoices}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-xs shrink-0 animate-pop-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{importStatus}</span>
          </div>
          <button
            onClick={() => setImportStatus(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Invoices List Card with Smooth Internal Scrolling & Sticky Header */}
      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
        {/* Scrollable Table Area */}
        <div
          ref={tableContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar relative"
        >
          <table className="w-full text-xs text-left border-collapse min-w-[780px]">
            <thead className="sticky top-0 z-20 shadow-xs bg-slate-100 border-b border-slate-200 text-slate-700">
              <tr className="bg-slate-100 text-slate-700">
                <th
                  onClick={() => handleSort('number')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:bg-slate-200/70 transition-colors select-none text-slate-700"
                >
                  <div className="flex items-center">
                    <span>Invoice #</span>
                    {getSortIcon('number')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:bg-slate-200/70 transition-colors select-none text-slate-700"
                >
                  <div className="flex items-center">
                    <span>Date</span>
                    {getSortIcon('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('customer')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:bg-slate-200/70 transition-colors select-none text-slate-700"
                >
                  <div className="flex items-center">
                    <span>Customer</span>
                    {getSortIcon('customer')}
                  </div>
                </th>
                <th className="py-3 px-4 text-center font-semibold text-slate-700">Items</th>
                <th
                  onClick={() => handleSort('total')}
                  className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-slate-200/70 transition-colors select-none text-slate-700"
                >
                  <div className="flex items-center justify-end">
                    <span>Grand Total</span>
                    {getSortIcon('total')}
                  </div>
                </th>
                <th className="py-3 px-4 text-center font-semibold text-slate-700">Payment</th>
                <th className="py-3 px-4 text-center font-semibold text-slate-700">Status</th>
                <th className="py-3 px-4 text-center font-semibold sticky right-0 bg-slate-100 text-slate-700 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 font-medium">
                    <ReceiptText className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
                    <p className="text-sm font-semibold text-slate-600">No invoices found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery || dateFilter
                        ? 'Try clearing the search or date filter.'
                        : 'Generate a new bill to see it listed here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedInvoices.map((inv, index) => (
                  <tr
                    key={inv.id || inv.invoiceNumber || index}
                    className="hover:bg-blue-50/50 transition-colors group"
                  >
                    <td className="py-2.5 px-4 font-bold text-[#1A56BE] whitespace-nowrap">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {inv.invoiceDate}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-800 leading-tight">
                        {inv.customerName || 'Walk-in Customer'}
                      </div>
                      {inv.customerPhone && (
                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          {inv.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center font-semibold text-slate-700 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                        {inv.items?.length || 0} {inv.items?.length === 1 ? 'item' : 'items'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      {formatCurrency(inv.grandTotal, settings.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold text-[11px]">
                        {inv.paymentMethod || 'Cash'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-semibold text-[11px]">
                        {inv.status || 'Completed'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-blue-50/50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                          title="View Invoice Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onPrint(inv)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                          title="Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDownloadPdf(inv)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-teal-600 transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onWhatsApp(inv)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors cursor-pointer"
                          title="Share via WhatsApp"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Responsive Pagination & Row Count Controls */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600 select-none">
          {/* Left: Summary and Rows per Page */}
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-800">{startIndex}</strong> to{' '}
              <strong className="text-slate-800">{endIndex}</strong> of{' '}
              <strong className="text-slate-800">{totalItems}</strong> bills
            </span>

            <div className="flex items-center gap-1.5">
              <label htmlFor="pageSizeSelect" className="text-slate-500 hidden md:inline">
                Rows:
              </label>
              <select
                id="pageSizeSelect"
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : Number(val));
                }}
                className="px-2 py-1 border border-slate-300 rounded-md text-xs font-semibold bg-white text-slate-700 outline-blue-600 cursor-pointer"
              >
                <option value={15}>15 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value="all">All (Scrollable)</option>
              </select>
            </div>
          </div>

          {/* Right: Pagination Navigation Buttons */}
          {!isAll && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setCurrentPage(1);
                  if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
                }}
                disabled={validCurrentPage === 1}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(p - 1, 1));
                  if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
                }}
                disabled={validCurrentPage === 1}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-1 font-bold text-slate-800 bg-white border border-slate-300 rounded text-xs">
                Page {validCurrentPage} of {totalPages}
              </span>

              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(p + 1, totalPages));
                  if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
                }}
                disabled={validCurrentPage === totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setCurrentPage(totalPages);
                  if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
                }}
                disabled={validCurrentPage === totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-backdrop">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col animate-pop-in">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-[#1A56BE] text-white">
              <div>
                <h3 className="font-bold text-sm">Invoice Details</h3>
                <p className="text-xs text-blue-100">{selectedInvoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-white hover:bg-blue-700 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto custom-scrollbar flex-1">
              {/* Top Meta */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-500">Invoice Date:</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.invoiceDate}</p>
                  <p className="font-semibold text-slate-500 mt-2">Customer:</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.customerName || 'Walk-in Customer'}</p>
                  {selectedInvoice.customerPhone && (
                    <p className="text-slate-600">{selectedInvoice.customerPhone}</p>
                  )}
                  {selectedInvoice.customerAddress && (
                    <p className="text-slate-500 text-[11px] mt-0.5">{selectedInvoice.customerAddress}</p>
                  )}
                </div>

                <div className="text-right">
                  {selectedInvoice.deliveryCharges && selectedInvoice.deliveryCharges > 0 ? (
                    <p className="text-xs text-blue-600 font-semibold mb-1">
                      Delivery Fees: +{formatCurrency(selectedInvoice.deliveryCharges, settings.currency)}
                    </p>
                  ) : null}
                  <p className="font-semibold text-slate-500">Grand Total:</p>
                  <p className="text-xl font-extrabold text-[#1A56BE]">
                    {formatCurrency(selectedInvoice.grandTotal, settings.currency)}
                  </p>
                  <p className="font-semibold text-slate-500 mt-2">Payment Mode:</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.paymentMethod || 'Cash'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3 text-left">Item</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">Disc</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((item, idx) => {
                      const discDisplay =
                        item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '0%');
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-800">{item.itemName}</td>
                          <td className="py-2 px-3 text-center text-slate-700">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {formatCurrency(item.price, settings.currency)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">{discDisplay}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(item.total, settings.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Note if any */}
              {selectedInvoice.note && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                  <span className="font-semibold">Note:</span> {selectedInvoice.note}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-3.5 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => onDownloadPdf(selectedInvoice)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => onPrint(selectedInvoice)}
                className="bg-[#0078D4] hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => onWhatsApp(selectedInvoice)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE INVOICE POPUP MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-backdrop"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-pop-in z-10 text-slate-800 dark:text-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl shrink-0 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Delete Invoice
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete this invoice record from history? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-bold rounded-lg text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
