import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Download,
  MessageSquare,
  Save,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  MoreHorizontal,
  Calendar,
  Lightbulb,
  RotateCcw,
  FilePlus,
  PlusCircle,
  Truck
} from 'lucide-react';
import { AppSettings, DiscountType, Invoice, InvoiceItem, PaymentMethod, PaperSize } from '../types';
import { calculateBillingSummary, calculateItemTotal, formatCurrency, capitalizeWords, sanitizePhoneNumber } from '../services/billing';
import { generateNextInvoiceNumber, saveInvoice } from '../services/db';
import { resolveInvoiceMarketingNotes } from '../services/marketingService';

interface NewBillViewProps {
  settings: AppSettings;
  onPrint: (invoice: Invoice, overridePaperSize?: PaperSize | string) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onWhatsApp: (invoice: Invoice) => void;
  onSaved: () => void;
}

export const NewBillView: React.FC<NewBillViewProps> = ({
  settings,
  onPrint,
  onDownloadPdf,
  onWhatsApp,
  onSaved
}) => {
  // 1. Bill Form State
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(settings.printing.paperSize || 'A6');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');

  // Input Refs for Enter key navigation
  const custNameRef = useRef<HTMLInputElement>(null);
  const custPhoneRef = useRef<HTMLInputElement>(null);
  const custAddrRef = useRef<HTMLInputElement>(null);

  const itemInputRefs = useRef<{
    [key: string]: {
      itemName: HTMLInputElement | null;
      quantity: HTMLInputElement | null;
      price: HTMLInputElement | null;
      discountPercent: HTMLInputElement | null;
    };
  }>({});

  const pendingFocusIndexRef = useRef<number | null>(null);

  // Items State (default single item with 0 price)
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', itemName: 'Regular Item 1', quantity: 1, price: 0, discountPercent: 0, discount: '0%', discountAmount: 0, total: 0 }
  ]);

  // Discount & Notes
  const [billDiscountType, setBillDiscountType] = useState<DiscountType>('Flat');
  const [billDiscountInput, setBillDiscountInput] = useState<number | string>(0);
  const [billDiscountApplied, setBillDiscountApplied] = useState<number | string>(0);
  const [note, setNote] = useState<string>('');

  // Delivery Billing State
  const [isDelivery, setIsDelivery] = useState<boolean>(false);
  const [deliveryChargesInput, setDeliveryChargesInput] = useState<number | string>(
    settings.defaultDeliveryCharge ?? settings.marketingFooter?.delivery?.standardDeliveryCharge ?? 0
  );

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('0.00');

  // Notification Banner
  const [notification, setNotification] = useState<string | null>(null);

  // Initialize Invoice Number & Date
  useEffect(() => {
    setInvoiceNumber(generateNextInvoiceNumber());
    const today = new Date().toISOString().split('T')[0];
    setInvoiceDate(today);
  }, [settings]);

  // Handle focusing newly added items
  useEffect(() => {
    if (pendingFocusIndexRef.current !== null) {
      const idx = pendingFocusIndexRef.current;
      const targetItem = items[idx];
      if (targetItem && itemInputRefs.current[targetItem.id]?.itemName) {
        const el = itemInputRefs.current[targetItem.id].itemName;
        el?.focus();
        el?.select();
        pendingFocusIndexRef.current = null;
      }
    }
  }, [items]);

  // Focus First Item Name helper
  const focusFirstItemName = () => {
    if (items.length === 0) {
      handleAddItem();
    } else {
      const firstId = items[0].id;
      const el = itemInputRefs.current[firstId]?.itemName;
      if (el) {
        el.focus();
        el.select();
      }
    }
  };

  // Calculations
  const receivedAmount = parseFloat(receivedAmountInput) || 0;
  const deliveryCharges = isDelivery ? (typeof deliveryChargesInput === 'number' ? deliveryChargesInput : parseFloat(deliveryChargesInput as string) || 0) : 0;
  const summary = calculateBillingSummary(
    items,
    billDiscountType,
    billDiscountApplied,
    settings.tax.gstEnabled,
    settings.tax.gstPercentage,
    receivedAmount,
    deliveryCharges
  );

  // Auto update received amount when Grand Total changes if cash payment matches total or default
  useEffect(() => {
    if (paymentMethod !== 'Cash') {
      setReceivedAmountInput(summary.grandTotal.toFixed(2));
    }
  }, [summary.grandTotal, paymentMethod]);

  // Item Handlers
  const handleItemChange = (id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const processedValue = field === 'itemName' ? capitalizeWords(value) : value;
        const updated = { ...item, [field]: processedValue };
        const qty = field === 'quantity' ? Math.max(1, parseInt(value) || 1) : updated.quantity;
        const prc = field === 'price' ? Math.max(0, parseFloat(value) || 0) : updated.price;
        const discInput = field === 'discount' || field === 'discountPercent'
          ? value
          : (item.discount !== undefined ? item.discount : item.discountPercent);

        const { discountAmount, total, discountExpression, effectiveDiscountPercentage } = calculateItemTotal(qty, prc, discInput);

        updated.quantity = qty;
        updated.price = prc;
        updated.discount = typeof discInput === 'string' ? discInput : (discountExpression || '0%');
        updated.discountPercent = effectiveDiscountPercentage;
        updated.discountAmount = discountAmount;
        updated.total = total;

        return updated;
      })
    );
  };

  const handleQtyChange = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(1, item.quantity + delta);
        const discInput = item.discount !== undefined ? item.discount : item.discountPercent;
        const { discountAmount, total, effectiveDiscountPercentage } = calculateItemTotal(newQty, item.price, discInput);
        return {
          ...item,
          quantity: newQty,
          discountAmount,
          discountPercent: effectiveDiscountPercentage,
          total
        };
      })
    );
  };

  const handleAddItem = () => {
    const newId = Date.now().toString();
    const newItem: InvoiceItem = {
      id: newId,
      itemName: `Regular Item ${items.length + 1}`,
      quantity: 1,
      price: 0,
      discountPercent: 0,
      discount: '0%',
      discountAmount: 0,
      total: 0
    };
    pendingFocusIndexRef.current = items.length;
    setItems((prev) => [...prev, newItem]);
  };

  const handleItemKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    itemId: string,
    itemIndex: number,
    field: 'itemName' | 'quantity' | 'price' | 'discountPercent'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (field === 'itemName') {
        // Move to Quantity
        const qtyEl = itemInputRefs.current[itemId]?.quantity;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        } else {
          const priceEl = itemInputRefs.current[itemId]?.price;
          priceEl?.focus();
          priceEl?.select();
        }
      } else if (field === 'quantity') {
        // Move to Price
        const priceEl = itemInputRefs.current[itemId]?.price;
        if (priceEl) {
          priceEl.focus();
          priceEl.select();
        }
      } else if (field === 'price') {
        // Move to Disc%
        const discEl = itemInputRefs.current[itemId]?.discountPercent;
        if (discEl) {
          discEl.focus();
          discEl.select();
        }
      } else if (field === 'discountPercent') {
        // All details of this item have been entered!
        // Only pressing Enter here will add a new item or go to next item
        if (itemIndex === items.length - 1) {
          handleAddItem();
        } else {
          const nextItem = items[itemIndex + 1];
          if (nextItem) {
            const el = itemInputRefs.current[nextItem.id]?.itemName;
            el?.focus();
            el?.select();
          }
        }
      }
    }
  };

  const handleDeleteItem = (id: string) => {
    if (items.length <= 1) {
      showToast('At least one item is required in the bill.');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleApplyDiscount = () => {
    setBillDiscountApplied(billDiscountInput);
    showToast(`Bill discount applied: ${billDiscountType === 'Flat' ? formatCurrency(Number(billDiscountInput) || 0, settings.currency) : billDiscountInput + '%'}`);
  };

  const constructInvoiceObject = (): Invoice => {
    const invNum = invoiceNumber || generateNextInvoiceNumber();
    const invDate = invoiceDate || new Date().toISOString().split('T')[0];
    const resolvedMarketing = resolveInvoiceMarketingNotes(settings, invNum, invDate, summary.grandTotal);

    return {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNum,
      invoiceDate: invDate,
      customerName: capitalizeWords(customerName.trim()),
      customerPhone: sanitizePhoneNumber(customerPhone.trim()),
      customerAddress: capitalizeWords(customerAddress.trim()),
      items: items.map((it) => ({
        ...it,
        itemName: capitalizeWords(it.itemName.trim())
      })),
      subtotal: summary.subtotal,
      billDiscountType,
      billDiscountInput: billDiscountApplied,
      billDiscountAmount: summary.billDiscountAmount,
      taxableAmount: summary.taxableAmount,
      taxPercent: settings.tax.gstPercentage,
      taxAmount: summary.taxAmount,
      deliveryCharges: summary.deliveryCharges,
      isDelivery,
      grandTotal: summary.grandTotal,
      paymentMethod,
      receivedAmount,
      changeAmount: summary.changeAmount,
      note: note.trim(),
      marketingNotes: resolvedMarketing,
      status: 'Completed',
      createdAt: new Date().toISOString()
    };
  };

  const handleNewBill = () => {
    resetForm();
    showToast('New bill created. Form cleared.');
  };

  const handleSaveBill = (showNotification: boolean = true) => {
    const inv = constructInvoiceObject();
    saveInvoice(inv);
    if (showNotification) {
      showToast(`Bill ${inv.invoiceNumber} saved successfully.`);
      resetForm();
    }
    onSaved();
    return inv;
  };

  const handlePayAndPrint = () => {
    if (items.length === 0 || (items.length === 1 && items[0].price === 0)) {
      showToast('Cannot generate bill without items or price.');
      return;
    }
    if (paymentMethod === 'Cash' && receivedAmount < summary.grandTotal) {
      showToast('Received amount is less than Grand Total.');
      return;
    }

    const savedInv = handleSaveBill(false);
    onPrint(savedInv, selectedPaperSize);
    showToast(`Bill ${savedInv.invoiceNumber} generated & sent to printer (${selectedPaperSize})!`);
    resetForm();
  };

  const handlePrintAction = () => {
    const inv = constructInvoiceObject();
    onPrint(inv, selectedPaperSize);
  };

  const handleDownloadPdfAction = () => {
    const inv = constructInvoiceObject();
    onDownloadPdf(inv);
  };

  const handleWhatsAppAction = () => {
    const inv = constructInvoiceObject();
    onWhatsApp(inv);
  };

  const resetForm = () => {
    const nextInvoiceNo = generateNextInvoiceNumber();
    setInvoiceNumber(nextInvoiceNo);
    const today = new Date().toISOString().split('T')[0];
    setInvoiceDate(today);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setItems([
      { id: Date.now().toString(), itemName: 'Regular Item 1', quantity: 1, price: 0, discountPercent: 0, discount: '0%', discountAmount: 0, total: 0 }
    ]);
    setBillDiscountType('Flat');
    setBillDiscountInput(0);
    setBillDiscountApplied(0);
    setNote('');
    setIsDelivery(false);
    setDeliveryChargesInput(settings.defaultDeliveryCharge ?? settings.marketingFooter?.delivery?.standardDeliveryCharge ?? 0);
    setPaymentMethod('Cash');
    setReceivedAmountInput('0.00');

    setTimeout(() => {
      custNameRef.current?.focus();
      custNameRef.current?.select();
    }, 50);
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Global Keyboard Shortcuts (F5: Pay & Print, F2 / Alt+N: New Bill, Ctrl+P: Print, Ctrl+S: Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handlePayAndPrint();
      } else if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        handleNewBill();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrintAction();
      } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveBill(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, invoiceNumber, receivedAmount, paymentMethod, summary]);

  return (
    <div className="flex-1 p-4 lg:p-6 bg-[#F3F2F1] text-[#323130] overflow-y-auto flex flex-col gap-4 font-sans">
      {/* Toast Banner */}
      {notification && (
        <div className="fixed top-14 right-6 bg-[#323130] text-white text-xs font-semibold px-4 py-2.5 rounded-md shadow-xl z-50 flex items-center space-x-2">
          <span>{notification}</span>
        </div>
      )}

      {/* Main 2-Column Grid matching reference image layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start max-w-[1600px] mx-auto w-full">
        {/* LEFT / MAIN COLUMN (8 or 9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
          {/* STORE & INVOICE HEADER CARD */}
          <div className="bg-white p-4 lg:p-5 rounded-lg shadow-sm border border-[#EDEBE9] flex flex-col sm:flex-row justify-between items-start gap-4">
            {/* Store Details (Left) */}
            <div>
              <h2 className="text-lg font-bold text-[#0078D4] tracking-tight uppercase">
                {settings.store.storeName}
              </h2>
              <p className="text-xs italic text-[#605E5C]">
                {settings.store.tagline}
              </p>
              <p className="text-[11px] leading-relaxed mt-1 text-[#323130]">
                {settings.store.address}<br />
                {settings.store.cityStatePin} | Ph: {settings.store.phone}
              </p>
              <p className="text-[10px] font-bold mt-1 text-[#323130]">
                GSTIN: {settings.store.gstin}
              </p>
            </div>

            {/* Invoice Meta (Right) */}
            <div className="text-left sm:text-right w-full sm:w-auto space-y-1.5">
              <div className="text-2xl font-black text-[#323130] uppercase">INVOICE</div>

              <div className="flex items-center space-x-2 text-xs justify-between sm:justify-end">
                <span className="text-[#605E5C]">Date:</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="border border-[#C8C6C4] px-2 py-1 text-xs rounded outline-[#0078D4] bg-white font-bold"
                />
              </div>

              <div className="flex items-center space-x-2 text-xs justify-between sm:justify-end">
                <span className="text-[#605E5C]">Invoice #:</span>
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={invoiceNumber}
                    readOnly
                    className="border border-[#C8C6C4] px-2 py-1 text-xs rounded outline-none bg-[#F3F2F1] font-bold text-right w-32 cursor-not-allowed text-[#323130]"
                    title="Invoice number is automatically generated and non-editable"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = generateNextInvoiceNumber();
                      setInvoiceNumber(next);
                      showToast(`Invoice reset to ${next}`);
                    }}
                    className="p-1 rounded bg-[#F3F2F1] hover:bg-[#EDEBE9] border border-[#C8C6C4] text-[#0078D4] hover:text-[#005A9E] cursor-pointer flex items-center justify-center transition-colors"
                    title="Reset to Next Automatic Invoice Number"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BILL TO / CUSTOMER INFORMATION CARD */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-[#EDEBE9]">
            <p className="text-[10px] font-bold uppercase text-[#A19F9D] mb-2">Bill To</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#605E5C] font-semibold">Customer Name</label>
                <input
                  ref={custNameRef}
                  type="text"
                  placeholder="Walk-in Customer"
                  value={customerName}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) => setCustomerName(capitalizeWords(e.target.value))}
                  onBlur={() => setCustomerName((prev) => capitalizeWords(prev.trim()))}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setCustomerName((prev) => capitalizeWords(prev.trim()));
                      custPhoneRef.current?.focus();
                      custPhoneRef.current?.select();
                    }
                  }}
                  className="border border-[#C8C6C4] px-2.5 py-1.5 text-xs rounded outline-[#0078D4] text-[#323130] font-medium capitalize"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#605E5C] font-semibold">Phone Number</label>
                <input
                  ref={custPhoneRef}
                  type="text"
                  placeholder="Phone number(s) e.g. 9876543210, +91-8457816845"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(sanitizePhoneNumber(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      custAddrRef.current?.focus();
                      custAddrRef.current?.select();
                      return;
                    }
                    if (
                      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
                      e.ctrlKey || e.metaKey
                    ) {
                      return;
                    }
                    if (!/^[0-9,\-+\s\/()]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="border border-[#C8C6C4] px-2.5 py-1.5 text-xs rounded outline-[#0078D4] text-[#323130] font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#605E5C] font-semibold">Customer Address</label>
                <input
                  ref={custAddrRef}
                  type="text"
                  placeholder="Address"
                  value={customerAddress}
                  style={{ textTransform: 'capitalize' }}
                  onChange={(e) => setCustomerAddress(capitalizeWords(e.target.value))}
                  onBlur={() => setCustomerAddress((prev) => capitalizeWords(prev.trim()))}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setCustomerAddress((prev) => capitalizeWords(prev.trim()));
                      focusFirstItemName();
                    }
                  }}
                  className="border border-[#C8C6C4] px-2.5 py-1.5 text-xs rounded outline-[#0078D4] text-[#323130] font-medium capitalize"
                />
              </div>
            </div>
          </div>

          {/* BILLING ITEM TABLE CARD */}
          <div className="bg-white rounded-lg shadow-sm border border-[#EDEBE9] flex flex-col overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3F2F1] text-[#605E5C] text-[10px] font-bold uppercase border-b border-[#EDEBE9]">
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">Item Name</th>
                    <th className="p-2 text-center w-24">Qty</th>
                    <th className="p-2 text-right w-20">Price</th>
                    <th className="p-2 text-right w-16">Disc%</th>
                    <th className="p-2 text-right w-20">Discount</th>
                    <th className="p-2 text-right w-24">Total</th>
                    <th className="p-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-[#FAF9F8] items-center">
                      <td className="p-2 text-[#605E5C] text-center font-medium">{index + 1}</td>
                      <td className="p-2">
                        <input
                          ref={(el) => {
                            if (!itemInputRefs.current[item.id]) {
                              itemInputRefs.current[item.id] = { itemName: null, quantity: null, price: null, discountPercent: null };
                            }
                            itemInputRefs.current[item.id].itemName = el;
                          }}
                          type="text"
                          value={item.itemName}
                          style={{ textTransform: 'capitalize' }}
                          onChange={(e) => handleItemChange(item.id, 'itemName', capitalizeWords(e.target.value))}
                          onBlur={() => handleItemChange(item.id, 'itemName', capitalizeWords(item.itemName.trim()))}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => handleItemKeyDown(e, item.id, index, 'itemName')}
                          className="w-full border border-transparent hover:border-[#C8C6C4] focus:border-[#0078D4] rounded px-1.5 py-1 text-xs font-semibold text-[#323130] bg-transparent focus:bg-white focus:outline-none capitalize"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleQtyChange(item.id, -1)}
                            className="w-5 h-5 border border-[#C8C6C4] rounded bg-white flex items-center justify-center font-bold text-xs hover:bg-[#F3F2F1] cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            ref={(el) => {
                              if (!itemInputRefs.current[item.id]) {
                                itemInputRefs.current[item.id] = { itemName: null, quantity: null, price: null, discountPercent: null };
                              }
                              itemInputRefs.current[item.id].quantity = el;
                            }}
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                            onKeyDown={(e) => handleItemKeyDown(e, item.id, index, 'quantity')}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-10 text-center font-bold text-xs border border-[#C8C6C4] rounded py-0.5 bg-white text-[#323130] outline-[#0078D4]"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleQtyChange(item.id, 1)}
                            className="w-5 h-5 border border-[#C8C6C4] rounded bg-white flex items-center justify-center font-bold text-xs hover:bg-[#F3F2F1] cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <input
                          ref={(el) => {
                            if (!itemInputRefs.current[item.id]) {
                              itemInputRefs.current[item.id] = { itemName: null, quantity: null, price: null, discountPercent: null };
                            }
                            itemInputRefs.current[item.id].price = el;
                          }}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                          onKeyDown={(e) => handleItemKeyDown(e, item.id, index, 'price')}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full text-right border border-[#C8C6C4] rounded px-1.5 py-0.5 text-xs text-[#323130] bg-white outline-[#0078D4]"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          ref={(el) => {
                            if (!itemInputRefs.current[item.id]) {
                              itemInputRefs.current[item.id] = { itemName: null, quantity: null, price: null, discountPercent: null };
                            }
                            itemInputRefs.current[item.id].discountPercent = el;
                          }}
                          type="text"
                          placeholder="0%"
                          value={item.discount !== undefined ? item.discount : (item.discountPercent ? `${item.discountPercent}%` : '')}
                          onChange={(e) => handleItemChange(item.id, 'discount', e.target.value)}
                          onKeyDown={(e) => handleItemKeyDown(e, item.id, index, 'discountPercent')}
                          className="w-full text-right border border-[#C8C6C4] rounded px-1.5 py-0.5 text-xs text-[#323130] bg-white outline-[#0078D4]"
                        />
                      </td>
                      <td className="p-2 text-right font-medium text-[#605E5C]">
                        {formatCurrency(item.discountAmount, settings.currency)}
                      </td>
                      <td className="p-2 text-right font-bold text-[#323130]">
                        {formatCurrency(item.total, settings.currency)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-500 font-bold hover:text-red-700 text-sm px-1 cursor-pointer"
                          title="Delete Item"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ADD ITEM & BILL DISCOUNT BAR */}
            <div className="p-3 border-t border-[#EDEBE9] bg-[#FAF9F8] flex flex-wrap justify-between items-center gap-3">
              <button
                type="button"
                onClick={handleAddItem}
                className="text-[#0078D4] text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                + Add New Item
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#605E5C]">Bill Discount</span>
                <select
                  value={billDiscountType}
                  onChange={(e) => setBillDiscountType(e.target.value as DiscountType)}
                  className="border border-[#C8C6C4] text-xs p-1 rounded bg-white text-[#323130]"
                >
                  <option value="Flat">Flat ₹</option>
                  <option value="Percentage">%</option>
                </select>
                <input
                  type={billDiscountType === 'Flat' ? 'number' : 'text'}
                  placeholder={billDiscountType === 'Flat' ? '0' : '0%'}
                  value={billDiscountInput !== undefined ? billDiscountInput : ''}
                  onChange={(e) => setBillDiscountInput(billDiscountType === 'Flat' ? (parseFloat(e.target.value) || 0) : e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-20 border border-[#C8C6C4] text-xs p-1 rounded text-right bg-white text-[#323130]"
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="bg-[#0078D4] hover:bg-[#005A9E] text-white text-[10px] font-semibold px-2.5 py-1 rounded cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* NOTE CARD */}
          <div className="bg-white p-3 rounded-lg border border-[#EDEBE9] flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-[#A19F9D] block mb-1 uppercase">Note</label>
              <input
                type="text"
                placeholder="Enter bill note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-[#C8C6C4] px-3 py-1.5 text-xs rounded text-[#323130] outline-[#0078D4]"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Actions Panel & Current Bill Summary) (4 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
          {/* ACTIONS CARD */}
          <div className="bg-[#FAF9F8] p-4 rounded-lg border border-[#EDEBE9] space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-[#A19F9D]">Quick Actions</p>
              <span className="text-[10px] text-[#8A8886] font-mono">F2: New | Ctrl+P: Print</span>
            </div>

            {/* Prominent New Bill Button */}
            <button
              type="button"
              onClick={handleNewBill}
              className="w-full py-2.5 bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-md font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              title="Discard current inputs and start a fresh bill (F2 / Alt+N)"
            >
              <FilePlus className="w-4 h-4" />
              <span>+ New Bill (Clear Form)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintAction}
              className="w-full py-2 bg-white hover:bg-[#F3F2F1] text-[#0078D4] border border-[#0078D4] rounded-md font-semibold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              title="Print & Save current invoice (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print to Printer (Ctrl+P)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadPdfAction}
                className="py-2 bg-[#008272] hover:bg-[#006E60] text-white rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Save & Download Bill as PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppAction}
                className="py-2 bg-[#25D366] hover:bg-[#1EBE5A] text-white rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Save & Send PDF Invoice via WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSaveBill(true)}
              className="w-full py-2 bg-[#5C2D91] hover:bg-[#4A2475] text-white rounded-md font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              title="Save Bill & Reset Form (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Bill (Ctrl+S)</span>
            </button>
          </div>

          {/* CURRENT BILL CARD */}
          <div className="bg-white p-4 rounded-lg border border-[#EDEBE9] flex-1 flex flex-col gap-4 shadow-sm">
            <div className="border-b border-[#F3F2F1] pb-3">
              <div className="flex justify-between items-center text-[10px] text-[#A19F9D] font-bold uppercase">
                <span>Current Bill</span>
                <span>{invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-xs text-[#605E5C]">Items: {summary.itemCount}</span>
                <span className="text-2xl font-black text-[#0078D4]">
                  {formatCurrency(summary.subtotal, settings.currency)}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#605E5C]">
                <span>Subtotal</span>
                <span>{formatCurrency(summary.subtotal, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-[#605E5C]">
                <span>Discount</span>
                <span>- {formatCurrency(summary.billDiscountAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-[#605E5C]">
                <span>Tax (GST {settings.tax.gstEnabled ? settings.tax.gstPercentage : 0}%)</span>
                <span>{formatCurrency(summary.taxAmount, settings.currency)}</span>
              </div>

              {/* Delivery Billing Option Checkbox */}
              <div className="pt-2 border-t border-[#F3F2F1]">
                <label className="flex items-center justify-between cursor-pointer select-none py-1 group">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Home Delivery Order</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isDelivery}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsDelivery(checked);
                      if (checked && (!deliveryChargesInput || Number(deliveryChargesInput) === 0)) {
                        const defaultFee = settings.defaultDeliveryCharge ?? settings.marketingFooter?.delivery?.standardDeliveryCharge ?? 0;
                        setDeliveryChargesInput(defaultFee);
                      }
                    }}
                    className="w-4 h-4 rounded text-[#0078D4] focus:ring-[#0078D4] cursor-pointer"
                  />
                </label>

                {isDelivery && (
                  <div className="mt-1.5 flex items-center justify-between bg-blue-50/80 border border-blue-200 rounded-md p-2 text-xs">
                    <span className="font-semibold text-blue-900 flex items-center gap-1">
                      <span>Delivery Fees:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-blue-800">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0.00"
                        value={deliveryChargesInput !== undefined ? deliveryChargesInput : ''}
                        onChange={(e) => setDeliveryChargesInput(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-20 border border-blue-300 bg-white px-2 py-0.5 text-xs font-bold rounded text-right text-blue-900 outline-[#0078D4]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-base font-black pt-2 border-t border-[#F3F2F1] text-[#323130]">
                <span>Grand Total</span>
                <span className="text-[#0078D4]">{formatCurrency(summary.grandTotal, settings.currency)}</span>
              </div>
            </div>

            <div className="mt-auto space-y-4 pt-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#A19F9D] mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Cash', label: 'Cash' },
                    { id: 'UPI', label: 'UPI' },
                    { id: 'Card', label: 'Card' }
                  ].map((pm) => {
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                        className={`py-1.5 rounded font-bold text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#0078D4] bg-[#F3F9FF] text-[#0078D4]'
                            : 'border border-[#C8C6C4] bg-white text-[#323130] hover:bg-[#FAF9F8]'
                        }`}
                      >
                        {pm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
