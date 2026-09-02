import { Invoice, PaperSize, StoreSettings } from '../types';
import { formatCurrency } from './billing';
import { getAppSettings } from './db';
import { resolveInvoiceMarketingNotes } from './marketingService';

export function printInvoiceToPrinter(invoice: Invoice, store: StoreSettings, paperSize: PaperSize | string = 'A4'): void {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Please allow popups in your browser to enable printing.');
    return;
  }

  const isThermal58 = paperSize === 'Thermal 58mm';
  const isThermal80 = paperSize === 'Thermal 80mm' || (paperSize.includes('Thermal') && !isThermal58);
  const isThermal = isThermal58 || isThermal80;
  const isA5 = paperSize === 'A5';
  const isA6 = paperSize === 'A6';
  const isA4 = paperSize === 'A4' || (!isThermal && !isA5 && !isA6);

  // Resolve marketing notes for this bill
  const currentSettings = getAppSettings();
  const marketingNotes = (invoice.marketingNotes && invoice.marketingNotes.length > 0)
    ? invoice.marketingNotes
    : resolveInvoiceMarketingNotes(currentSettings, invoice.invoiceNumber, invoice.invoiceDate, invoice.grandTotal);

  // Determine size-specific layout parameters
  let pageSizeRule = 'A4';
  let pageMargin = '8mm 10mm';
  let bodyFontSize = '12px';
  let bodyLineHeight = '1.32';
  let shopTitleSize = '20px';
  let invoiceTitleSize = '22px';
  let summaryWidth = '300px';
  let tablePadding = '6px 8px';
  let headerMarginBottom = '10px';
  let headerPaddingBottom = '6px';
  let billToPadding = '6px 8px';
  let billToMarginBottom = '8px';
  let summaryRowPadding = '2.5px 0';
  let grandTotalFontSize = '1.2em';
  let grandTotalPadding = '4px';
  let marketingMarginTop = '10px';
  let marketingPaddingTop = '6px';
  let marketingFontSize = '0.88em';
  let marketingItemMargin = '3px';
  let footerMarginTop = '10px';
  let footerPaddingTop = '6px';
  let footerFontSize = '0.82em';

  if (isA5) {
    pageSizeRule = 'A5';
    pageMargin = '6mm 7mm';
    bodyFontSize = '10.5px';
    bodyLineHeight = '1.26';
    shopTitleSize = '15px';
    invoiceTitleSize = '16px';
    summaryWidth = '230px';
    tablePadding = '4px 6px';
    headerMarginBottom = '6px';
    headerPaddingBottom = '4px';
    billToPadding = '4px 6px';
    billToMarginBottom = '6px';
    summaryRowPadding = '1.5px 0';
    grandTotalFontSize = '1.15em';
    grandTotalPadding = '3px';
    marketingMarginTop = '6px';
    marketingPaddingTop = '4px';
    marketingFontSize = '0.84em';
    marketingItemMargin = '2px';
    footerMarginTop = '6px';
    footerPaddingTop = '4px';
    footerFontSize = '0.78em';
  } else if (isA6) {
    pageSizeRule = 'A6';
    pageMargin = '5mm 6.5mm';
    bodyFontSize = '8.5px';
    bodyLineHeight = '1.20';
    shopTitleSize = '12px';
    invoiceTitleSize = '12.5px';
    summaryWidth = '100%';
    tablePadding = '2px 3px';
    headerMarginBottom = '4px';
    headerPaddingBottom = '3px';
    billToPadding = '3px 5px';
    billToMarginBottom = '4px';
    summaryRowPadding = '1px 0';
    grandTotalFontSize = '1.12em';
    grandTotalPadding = '2px';
    marketingMarginTop = '4px';
    marketingPaddingTop = '3px';
    marketingFontSize = '7.5px';
    marketingItemMargin = '1.5px';
    footerMarginTop = '4px';
    footerPaddingTop = '3px';
    footerFontSize = '7.2px';
  } else if (isThermal58) {
    pageSizeRule = '58mm auto';
    pageMargin = '2mm 2.5mm';
    bodyFontSize = '9px';
    bodyLineHeight = '1.22';
    shopTitleSize = '13px';
    invoiceTitleSize = '12px';
    summaryWidth = '100%';
    tablePadding = '2.5px 2px';
    headerMarginBottom = '6px';
    headerPaddingBottom = '4px';
    billToPadding = '3px 4px';
    billToMarginBottom = '4px';
    summaryRowPadding = '1.5px 0';
    grandTotalFontSize = '1.15em';
    grandTotalPadding = '3px';
    marketingMarginTop = '6px';
    marketingPaddingTop = '4px';
    marketingFontSize = '8px';
    marketingItemMargin = '2px';
    footerMarginTop = '6px';
    footerPaddingTop = '4px';
    footerFontSize = '7.5px';
  } else if (isThermal80) {
    pageSizeRule = '80mm auto';
    pageMargin = '3mm 3.5mm';
    bodyFontSize = '10.5px';
    bodyLineHeight = '1.25';
    shopTitleSize = '15px';
    invoiceTitleSize = '15px';
    summaryWidth = '100%';
    tablePadding = '3.5px 4px';
    headerMarginBottom = '8px';
    headerPaddingBottom = '6px';
    billToPadding = '4px 6px';
    billToMarginBottom = '6px';
    summaryRowPadding = '2px 0';
    grandTotalFontSize = '1.18em';
    grandTotalPadding = '3px';
    marketingMarginTop = '8px';
    marketingPaddingTop = '5px';
    marketingFontSize = '8.5px';
    marketingItemMargin = '2.5px';
    footerMarginTop = '8px';
    footerPaddingTop = '5px';
    footerFontSize = '8px';
  }

  const customFooterMsg = currentSettings.marketingFooter?.customFooterText || 'Thank you for shopping with us! Please visit again.';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice - ${invoice.invoiceNumber || 'Print'}</title>
        <style>
          @page {
            size: ${pageSizeRule};
            margin: ${pageMargin};
          }
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background-color: #ffffff;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            font-size: ${bodyFontSize};
            line-height: ${bodyLineHeight};
            width: 100%;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0078D4;
            padding-bottom: ${headerPaddingBottom};
            margin-bottom: ${headerMarginBottom};
            width: 100%;
          }
          .thermal-header {
            text-align: center;
            border-bottom: 1px dashed #64748b;
            padding-bottom: ${headerPaddingBottom};
            margin-bottom: ${headerMarginBottom};
            width: 100%;
          }
          .shop-title {
            font-size: ${shopTitleSize};
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            line-height: 1.15;
            letter-spacing: -0.1px;
          }
          .shop-tagline {
            font-style: italic;
            color: #475569;
            margin-top: 1px;
            margin-bottom: ${isA6 ? '3px' : '6px'};
            font-size: 0.88em;
            line-height: 1.2;
          }
          .shop-details {
            display: flex;
            flex-direction: column;
            gap: 1px;
            color: #334155;
            font-size: 0.92em;
            line-height: 1.25;
          }
          .invoice-title {
            font-size: ${invoiceTitleSize};
            font-weight: 800;
            color: #0078D4;
            text-align: right;
            margin: 0;
            line-height: 1.15;
          }
          .invoice-meta-right {
            text-align: right;
            font-size: 0.95em;
            line-height: 1.3;
          }
          .thermal-meta {
            display: flex;
            justify-content: space-between;
            font-size: 0.9em;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
          }
          .bill-to {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 3px;
            padding: ${billToPadding};
            margin-bottom: ${billToMarginBottom};
            page-break-inside: avoid;
            width: 100%;
          }
          .bill-to-title {
            font-size: 0.82em;
            font-weight: 800;
            color: #0078D4;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 2px;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: ${isA6 ? '4px' : '8px'};
            table-layout: auto;
          }
          table.items tr {
            page-break-inside: avoid;
          }
          table.items th {
            background-color: ${isThermal ? '#f1f5f9' : '#0f172a'};
            color: ${isThermal ? '#0f172a' : '#ffffff'};
            text-align: left;
            padding: ${tablePadding};
            font-size: 0.86em;
            font-weight: 700;
            border-top: ${isThermal ? '1px solid #94a3b8' : 'none'};
            border-bottom: ${isThermal ? '1px solid #94a3b8' : 'none'};
          }
          table.items td {
            padding: ${tablePadding};
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
            word-break: break-word;
          }
          .nowrap {
            white-space: nowrap;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .summary-box {
            width: ${summaryWidth};
            margin-left: auto;
            border-top: 1px solid #cbd5e1;
            padding-top: 3px;
            page-break-inside: avoid;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${summaryRowPadding};
            gap: 8px;
          }
          .summary-row span:first-child {
            white-space: nowrap;
          }
          .summary-row span:last-child {
            white-space: nowrap;
            text-align: right;
          }
          .grand-total {
            font-size: ${grandTotalFontSize};
            font-weight: 800;
            color: #0078D4;
            border-top: 2px solid #0078D4;
            padding-top: ${grandTotalPadding};
            margin-top: 3px;
          }
          .marketing-section {
            margin-top: ${marketingMarginTop};
            padding-top: ${marketingPaddingTop};
            border-top: 1px dashed #94a3b8;
            page-break-inside: avoid;
            font-size: ${marketingFontSize};
            color: #334155;
            word-break: break-word;
          }
          .marketing-note-item {
            margin-bottom: ${marketingItemMargin};
            line-height: 1.25;
          }
          .marketing-note-item strong {
            color: #0f172a;
          }
          .footer {
            margin-top: ${footerMarginTop};
            text-align: center;
            font-size: ${footerFontSize};
            color: #64748b;
            border-top: 1px dashed #cbd5e1;
            padding-top: ${footerPaddingTop};
            page-break-inside: avoid;
            word-break: break-word;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${
          isThermal
            ? `
          <div class="thermal-header">
            <div class="shop-title">${store.storeName || ''}</div>
            ${store.tagline ? `<div class="shop-tagline">${store.tagline}</div>` : ''}
            <div class="shop-details" style="${!store.tagline ? 'margin-top: 4px;' : ''}">
              ${store.address ? `<div>${store.address}</div>` : ''}
              ${store.cityStatePin ? `<div>${store.cityStatePin}</div>` : ''}
              ${store.phone ? `<div>Ph: ${store.phone}</div>` : ''}
              ${store.gstin ? `<div>GSTIN: ${store.gstin}</div>` : ''}
            </div>
            <div class="thermal-meta">
              <div><strong>Inv #:</strong> ${invoice.invoiceNumber || ''}</div>
              <div><strong>Date:</strong> ${invoice.invoiceDate || ''}</div>
            </div>
          </div>
        `
            : `
          <div class="header">
            <div style="flex: 1; padding-right: 8px; min-width: 0;">
              <div class="shop-title">${store.storeName || ''}</div>
              ${store.tagline ? `<div class="shop-tagline">${store.tagline}</div>` : ''}
              <div class="shop-details" style="${!store.tagline ? (isA6 ? 'margin-top: 3px;' : 'margin-top: 6px;') : ''}">
                ${store.address ? `<div>${store.address}</div>` : ''}
                ${store.cityStatePin ? `<div>${store.cityStatePin}</div>` : ''}
                ${store.phone ? `<div>Ph: ${store.phone}</div>` : ''}
                ${store.gstin ? `<div>GSTIN: ${store.gstin}</div>` : ''}
              </div>
            </div>
            <div class="invoice-meta-right" style="flex-shrink: 0;">
              <div class="invoice-title">INVOICE</div>
              <div style="margin-top: ${isA6 ? '4px' : '8px'};" class="nowrap"><strong>Date:</strong> ${invoice.invoiceDate || ''}</div>
              <div style="margin-top: 2px;" class="nowrap"><strong>Invoice #:</strong> ${invoice.invoiceNumber || ''}</div>
            </div>
          </div>
        `
        }

        ${
          invoice.customerName || invoice.customerPhone || invoice.customerAddress
            ? `
          <div class="bill-to">
            <div class="bill-to-title">Bill To</div>
            ${invoice.customerName ? `<div><strong>Name:</strong> ${invoice.customerName}</div>` : ''}
            ${invoice.customerPhone ? `<div><strong>Phone:</strong> ${invoice.customerPhone}</div>` : ''}
            ${invoice.customerAddress ? `<div><strong>Address:</strong> ${invoice.customerAddress}</div>` : ''}
          </div>
        `
            : ''
        }

        ${
          isThermal58
            ? `
          <table class="items">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center nowrap" style="width: 26px;">Qty</th>
                <th class="text-right nowrap" style="width: 44px;">Price</th>
                <th class="text-right nowrap" style="width: 48px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items
                .map((item) => {
                  const hasDisc = item.discount || (item.discountPercent && item.discountPercent > 0);
                  const discLabel = item.discount || `${item.discountPercent}%`;
                  return `
                <tr>
                  <td>
                    <strong>${item.itemName}</strong>
                    ${hasDisc ? `<div style="font-size: 0.82em; color: #16a34a;">Disc: ${discLabel}</div>` : ''}
                  </td>
                  <td class="text-center nowrap">${item.quantity}</td>
                  <td class="text-right nowrap">${formatCurrency(item.price)}</td>
                  <td class="text-right nowrap"><strong>${formatCurrency(item.total)}</strong></td>
                </tr>
              `;
                })
                .join('')}
            </tbody>
          </table>
        `
            : isA6
            ? `
          <table class="items">
            <thead>
              <tr>
                <th class="nowrap" style="width: 18px;">#</th>
                <th>Item Description</th>
                <th class="text-center nowrap" style="width: 26px;">Qty</th>
                <th class="text-right nowrap" style="width: 48px;">Price</th>
                <th class="text-right nowrap" style="width: 38px;">Disc %</th>
                <th class="text-right nowrap" style="width: 52px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items
                .map((item, idx) => {
                  const discDisplay = item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '0%');
                  return `
                <tr>
                  <td class="nowrap">${idx + 1}</td>
                  <td><strong>${item.itemName}</strong></td>
                  <td class="text-center nowrap">${item.quantity}</td>
                  <td class="text-right nowrap">${formatCurrency(item.price)}</td>
                  <td class="text-right nowrap">${discDisplay}</td>
                  <td class="text-right nowrap"><strong>${formatCurrency(item.total)}</strong></td>
                </tr>
              `;
                })
                .join('')}
            </tbody>
          </table>
        `
            : `
          <table class="items">
            <thead>
              <tr>
                <th class="nowrap" style="width: 25px;">#</th>
                <th>Item Description</th>
                <th class="text-center nowrap" style="width: 42px;">Qty</th>
                <th class="text-right nowrap" style="width: 68px;">Price</th>
                <th class="text-right nowrap" style="width: 58px;">Disc %</th>
                <th class="text-right nowrap" style="width: 72px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items
                .map((item, idx) => {
                  const discDisplay = item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '0%');
                  return `
                <tr>
                  <td class="nowrap">${idx + 1}</td>
                  <td><strong>${item.itemName}</strong></td>
                  <td class="text-center nowrap">${item.quantity}</td>
                  <td class="text-right nowrap">${formatCurrency(item.price)}</td>
                  <td class="text-right nowrap">${discDisplay}</td>
                  <td class="text-right nowrap"><strong>${formatCurrency(item.total)}</strong></td>
                </tr>
              `;
                })
                .join('')}
            </tbody>
          </table>
        `
        }

        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal (${invoice.items.length} items):</span>
            <span>${formatCurrency(invoice.subtotal)}</span>
          </div>
          ${
            invoice.billDiscountAmount > 0
              ? `
            <div class="summary-row">
              <span>Discount:</span>
              <span>-${formatCurrency(invoice.billDiscountAmount)}</span>
            </div>
          `
              : ''
          }
          ${
            invoice.taxAmount > 0
              ? `
            <div class="summary-row">
              <span>Tax (GST ${invoice.taxPercent}%):</span>
              <span>${formatCurrency(invoice.taxAmount)}</span>
            </div>
          `
              : ''
          }
          ${
            invoice.deliveryCharges && invoice.deliveryCharges > 0
              ? `
            <div class="summary-row">
              <span>Delivery Charges:</span>
              <span>+${formatCurrency(invoice.deliveryCharges)}</span>
            </div>
          `
              : ''
          }
          <div class="summary-row grand-total">
            <span>Grand Total:</span>
            <span>${formatCurrency(invoice.grandTotal)}</span>
          </div>
          <div class="summary-row" style="margin-top: ${isA6 ? '3px' : '5px'};">
            <span>Payment Method:</span>
            <span><strong>${invoice.paymentMethod}</strong></span>
          </div>
          ${
            invoice.receivedAmount && invoice.receivedAmount > 0
              ? `
            <div class="summary-row">
              <span>Received Amount:</span>
              <span>${formatCurrency(invoice.receivedAmount)}</span>
            </div>
            <div class="summary-row">
              <span>Change:</span>
              <span>${formatCurrency(invoice.changeAmount || 0)}</span>
            </div>
          `
              : ''
          }
        </div>

        ${invoice.note ? `<div style="margin-top: ${isA6 ? '4px' : '8px'}; padding: ${isA6 ? '3px 5px' : '5px 8px'}; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 0.88em;"><strong>Note:</strong> ${invoice.note}</div>` : ''}

        ${
          marketingNotes.length > 0
            ? `
          <div class="marketing-section">
            ${marketingNotes
              .map((note) => {
                const colonIdx = note.indexOf(':');
                if (colonIdx > 0 && colonIdx < 30) {
                  const title = note.substring(0, colonIdx);
                  const body = note.substring(colonIdx + 1);
                  return `<div class="marketing-note-item"><strong>${title}:</strong>${body}</div>`;
                }
                return `<div class="marketing-note-item">${note}</div>`;
              })
              .join('')}
          </div>
        `
            : ''
        }

        <div class="footer">
          ${customFooterMsg}<br/>
          Smart Bill POS • Crafted with ❤️ by <a href="https://codenpixels.in" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; font-weight: 600;">Code N Pixels (codenpixels.in)</a>
        </div>

        <script>
          function doPrint() {
            try {
              window.focus();
              window.print();
              setTimeout(function() {
                try { window.close(); } catch(e) {}
              }, 1200);
            } catch(e) {}
          }
          if (document.readyState === 'complete') {
            setTimeout(doPrint, 250);
          } else {
            window.addEventListener('load', function() {
              setTimeout(doPrint, 250);
            });
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
