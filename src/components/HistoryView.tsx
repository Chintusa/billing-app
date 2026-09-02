import React, { useState, useEffect } from 'react';
import { Search, Calendar, Printer, Download, Share2, Trash2, Eye, RefreshCw, X } from 'lucide-react';
import { AppSettings, Invoice, PaperSize } from '../types';
import { deleteInvoice, getAllInvoices } from '../services/db';
import { formatCurrency } from '../services/billing';

interface HistoryViewProps {
  settings: AppSettings;
  onPrint: (invoice: Invoice, overridePaperSize?: PaperSize | string) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onWhatsApp: (invoice: Invoice) => void;
}

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
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(settings.printing.paperSize || 'A6');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerPhone.includes(searchQuery);

    const matchesDate = !dateFilter || inv.invoiceDate === dateFilter;

    return matchesSearch && matchesDate;
  });

  return (
    <div className="flex-1 p-4 lg:p-6 bg-[#F3F2F1] text-[#323130] overflow-y-auto flex flex-col gap-4 font-sans">
      {/* Top Filter Header */}
      <div className="bg-white rounded-lg shadow-sm border border-[#EDEBE9] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#A19F9D] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search invoice # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[#C8C6C4] rounded text-xs outline-[#0078D4] text-[#323130]"
            />
          </div>

          {/* Date Filter */}
          <div className="relative w-full sm:w-44">
            <Calendar className="w-4 h-4 text-[#A19F9D] absolute left-3 top-2.5" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[#C8C6C4] rounded text-xs outline-[#0078D4] text-[#323130]"
            />
          </div>

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-[#0078D4] hover:underline"
            >
              Clear Date
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs font-semibold text-[#605E5C] w-full sm:w-auto justify-end">
          <span>Total Invoices: {filteredInvoices.length}</span>
          <button
            onClick={loadInvoices}
            className="p-1.5 rounded hover:bg-[#F3F2F1] text-[#605E5C] transition-colors cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#0F172A] text-white font-semibold">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#1A56BE]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {inv.invoiceDate}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {inv.customerName || 'Walk-in Customer'}
                      </div>
                      {inv.customerPhone && (
                        <div className="text-[11px] text-slate-500">{inv.customerPhone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {inv.items.length}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      {formatCurrency(inv.grandTotal, settings.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onPrint(inv)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors"
                          title="Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDownloadPdf(inv)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-teal-600 transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onWhatsApp(inv)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-colors"
                          title="Share via WhatsApp"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-red-600 transition-colors"
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
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-[#1A56BE] text-white rounded-t-xl">
              <div>
                <h3 className="font-bold text-sm">Invoice Details</h3>
                <p className="text-xs text-blue-100">{selectedInvoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-white hover:bg-blue-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Top Meta */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-500">Invoice Date:</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.invoiceDate}</p>
                  <p className="font-semibold text-slate-500 mt-2">Customer:</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.customerName || 'N/A'}</p>
                  <p>{selectedInvoice.customerPhone}</p>
                </div>

                <div className="text-right">
                  {selectedInvoice.deliveryCharges && selectedInvoice.deliveryCharges > 0 ? (
                    <p className="text-xs text-blue-600 font-semibold mb-1">
                      Delivery Fees: +{formatCurrency(selectedInvoice.deliveryCharges, settings.currency)}
                    </p>
                  ) : null}
                  <p className="font-semibold text-slate-500">Grand Total:</p>
                  <p className="text-lg font-extrabold text-[#1A56BE]">
                    {formatCurrency(selectedInvoice.grandTotal, settings.currency)}
                  </p>
                  <p className="font-semibold text-slate-500 mt-2">Payment Mode:</p>
                  <p className="font-bold text-slate-800">{selectedInvoice.paymentMethod}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2 px-2 text-left">Item</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Price</th>
                    <th className="py-2 px-2 text-right">Disc</th>
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedInvoice.items.map((item, idx) => {
                    const discDisplay = item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '0%');
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-2 font-medium">{item.itemName}</td>
                        <td className="py-2 px-2 text-center">{item.quantity}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(item.price, settings.currency)}</td>
                        <td className="py-2 px-2 text-right">{discDisplay}</td>
                        <td className="py-2 px-2 text-right font-bold">{formatCurrency(item.total, settings.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  onClick={() => onDownloadPdf(selectedInvoice)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded font-semibold flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => onPrint(selectedInvoice)}
                  className="bg-[#0078D4] hover:bg-blue-700 text-white px-3 py-1.5 rounded font-semibold flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => onWhatsApp(selectedInvoice)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-semibold flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
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
