import { Invoice, StoreSettings } from '../types';
import { getAppSettings } from './db';
import { resolveInvoiceMarketingNotes } from './marketingService';

function formatMoney(amount: number): string {
  const safe = isNaN(amount) ? 0 : amount;
  return safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapePdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ''); // keep standard printable ASCII to prevent font corruption
}

export async function downloadInvoicePDF(invoice: Invoice, store: StoreSettings): Promise<boolean> {
  try {
    const pdfBytes = createInvoicePDF(invoice, store);
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${invoice.invoiceNumber || 'bill'}.pdf`;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 150);

    return true;
  } catch (error) {
    console.error('Client PDF generation error:', error);
    window.print();
    return false;
  }
}

/**
 * Pure client-side PDF 1.4 generator.
 * Produces crisp vector A4 PDFs without server dependencies or character corruption.
 */
export function createInvoicePDF(invoice: Invoice, store: StoreSettings): Uint8Array {
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const streamOps: string[] = [];

  // Helper to convert top-down Y (0 at top) to PDF coordinate Y (0 at bottom)
  const toPdfY = (yTop: number) => (pageHeight - yTop).toFixed(2);

  const drawRect = (x: number, yTop: number, w: number, h: number, r: number, g: number, b: number) => {
    const yPdf = pageHeight - yTop - h;
    streamOps.push(`q ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${yPdf.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
  };

  const drawLine = (x1: number, y1Top: number, x2: number, y2Top: number, r: number, g: number, b: number, lineWidth: number = 1) => {
    const y1Pdf = pageHeight - y1Top;
    const y2Pdf = pageHeight - y2Top;
    streamOps.push(`q ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${lineWidth.toFixed(2)} w ${x1.toFixed(2)} ${y1Pdf.toFixed(2)} m ${x2.toFixed(2)} ${y2Pdf.toFixed(2)} l S Q`);
  };

  const drawText = (
    text: string,
    x: number,
    yTop: number,
    fontSize: number,
    fontKey: 'F1' | 'F2' = 'F1', // F1 = Helvetica, F2 = Helvetica-Bold
    color: [number, number, number] = [0.125, 0.122, 0.118],
    align: 'left' | 'right' | 'center' = 'left',
    boxWidth?: number
  ) => {
    const safeText = escapePdfText(text);
    let posX = x;
    const charWidth = fontSize * (fontKey === 'F2' ? 0.58 : 0.52);
    const textWidth = safeText.length * charWidth;

    if (align === 'right' && boxWidth) {
      posX = x + boxWidth - textWidth;
    } else if (align === 'center' && boxWidth) {
      posX = x + (boxWidth - textWidth) / 2;
    }

    const yPdf = pageHeight - yTop;
    const [r, g, b] = color;
    streamOps.push(
      `BT /${fontKey} ${fontSize.toFixed(2)} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${posX.toFixed(2)} ${yPdf.toFixed(2)} Tm (${safeText}) Tj ET`
    );
  };

  // --- 1. STORE HEADER (Left) ---
  const greenColor: [number, number, number] = [0.063, 0.486, 0.255]; // #107C41
  const darkTextColor: [number, number, number] = [0.125, 0.122, 0.118];
  const mutedTextColor: [number, number, number] = [0.376, 0.369, 0.361];

  drawText((store.storeName || 'STORE').toUpperCase(), 40, 48, 18, 'F2', greenColor);

  let currentY = 62;
  if (store.tagline) {
    drawText(store.tagline, 40, currentY, 8.5, 'F1', mutedTextColor);
    currentY += 16; // comfortable spacing between tagline and address details
  } else {
    currentY += 6;
  }
  if (store.address) {
    drawText(store.address, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }
  if (store.cityStatePin) {
    drawText(store.cityStatePin, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }
  if (store.phone) {
    drawText(`Phone: ${store.phone}`, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }
  if (store.gstin) {
    drawText(`GSTIN: ${store.gstin}`, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }

  // --- 2. TAX INVOICE METADATA (Right) ---
  drawText('TAX INVOICE', 350, 48, 16, 'F2', greenColor, 'right', 205);
  drawText(`Invoice No: ${invoice.invoiceNumber || ''}`, 350, 68, 9, 'F1', darkTextColor, 'right', 205);
  drawText(`Date: ${invoice.invoiceDate || ''}`, 350, 82, 9, 'F1', darkTextColor, 'right', 205);
  drawText(`Payment: ${invoice.paymentMethod || 'Cash'}`, 350, 96, 9, 'F1', darkTextColor, 'right', 205);

  currentY = Math.max(currentY + 15, 125);

  // Top Divider
  drawLine(40, currentY, 555, currentY, 0.9, 0.9, 0.9, 1);
  currentY += 16;

  // --- 3. CUSTOMER DETAILS ---
  drawText('Billed To:', 40, currentY, 10, 'F2', darkTextColor);
  currentY += 14;

  if (invoice.customerName) {
    drawText(`Name: ${invoice.customerName}`, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }
  if (invoice.customerPhone) {
    drawText(`Phone: ${invoice.customerPhone}`, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }
  if (invoice.customerAddress) {
    drawText(`Address: ${invoice.customerAddress}`, 40, currentY, 9, 'F1', darkTextColor);
    currentY += 12;
  }
  currentY += 10;

  // --- 4. ITEMS TABLE ---
  const tableTop = currentY;
  drawRect(40, tableTop - 2, 515, 20, 0.95, 0.95, 0.95);

  drawText('#', 45, tableTop + 11, 8.5, 'F2', darkTextColor, 'left', 25);
  drawText('Item Description', 75, tableTop + 11, 8.5, 'F2', darkTextColor, 'left', 190);
  drawText('Qty', 270, tableTop + 11, 8.5, 'F2', darkTextColor, 'center', 35);
  drawText('Rate (Rs.)', 315, tableTop + 11, 8.5, 'F2', darkTextColor, 'right', 65);
  drawText('Discount', 390, tableTop + 11, 8.5, 'F2', darkTextColor, 'right', 55);
  drawText('Amount (Rs.)', 455, tableTop + 11, 8.5, 'F2', darkTextColor, 'right', 95);

  currentY = tableTop + 26;

  invoice.items.forEach((item, idx) => {
    const discStr = item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '0%');
    const priceStr = formatMoney(item.price);
    const totalStr = formatMoney(item.total);

    drawText(String(idx + 1), 45, currentY, 8.5, 'F1', darkTextColor, 'left', 25);
    drawText(item.itemName || 'Item', 75, currentY, 8.5, 'F1', darkTextColor, 'left', 190);
    drawText(String(item.quantity), 270, currentY, 8.5, 'F1', darkTextColor, 'center', 35);
    drawText(priceStr, 315, currentY, 8.5, 'F1', darkTextColor, 'right', 65);
    drawText(discStr, 390, currentY, 8.5, 'F1', darkTextColor, 'right', 55);
    drawText(totalStr, 455, currentY, 8.5, 'F2', darkTextColor, 'right', 95);

    currentY += 18;
    drawLine(40, currentY - 5, 555, currentY - 5, 0.95, 0.95, 0.95, 0.5);
  });

  currentY += 10;

  // --- 5. SUMMARY BLOCK ---
  drawLine(40, currentY, 555, currentY, 0.88, 0.88, 0.88, 1);
  currentY += 16;

  const summaryX = 310;
  const printRow = (label: string, value: string, isBold: boolean = false) => {
    drawText(label, summaryX, currentY, 9, isBold ? 'F2' : 'F1', isBold ? greenColor : darkTextColor);
    drawText(value, summaryX + 110, currentY, 9, isBold ? 'F2' : 'F1', isBold ? greenColor : darkTextColor, 'right', 135);
    currentY += 16;
  };

  printRow('Sub Total:', `Rs. ${formatMoney(invoice.subtotal)}`);
  if (invoice.billDiscountAmount > 0) {
    printRow('Bill Discount:', `- Rs. ${formatMoney(invoice.billDiscountAmount)}`);
  }
  if (invoice.taxAmount > 0) {
    printRow('GST / Tax:', `Rs. ${formatMoney(invoice.taxAmount)}`);
  }
  if (invoice.deliveryCharges && invoice.deliveryCharges > 0) {
    printRow('Delivery Fees:', `+ Rs. ${formatMoney(invoice.deliveryCharges)}`);
  }

  // Grand Total Highlight Box
  drawRect(summaryX - 6, currentY - 12, 252, 22, 0.88, 0.92, 0.88);
  printRow('Grand Total:', `Rs. ${formatMoney(invoice.grandTotal)}`, true);

  if (invoice.receivedAmount !== undefined && invoice.receivedAmount > 0) {
    currentY += 4;
    printRow('Amount Received:', `Rs. ${formatMoney(invoice.receivedAmount)}`);
    if (invoice.changeAmount !== undefined && invoice.changeAmount > 0) {
      printRow('Change Due:', `Rs. ${formatMoney(invoice.changeAmount)}`);
    }
  }

  // --- 6. MARKETING NOTES & FOOTER ---
  const currentSettings = getAppSettings();
  const marketingNotes = (invoice.marketingNotes && invoice.marketingNotes.length > 0)
    ? invoice.marketingNotes
    : resolveInvoiceMarketingNotes(currentSettings, invoice.invoiceNumber, invoice.invoiceDate, invoice.grandTotal);

  if (marketingNotes.length > 0) {
    currentY += 20;
    drawLine(40, currentY, 555, currentY, 0.88, 0.88, 0.88, 1);
    currentY += 14;
    marketingNotes.forEach((mNote) => {
      drawText(mNote, 45, currentY, 8, 'F1', darkTextColor, 'left', 510);
      currentY += 12;
    });
  }

  currentY += 16;
  drawLine(40, currentY, 555, currentY, 0.88, 0.88, 0.88, 1);
  currentY += 16;
  const footerText = currentSettings.marketingFooter?.customFooterText || 'Thank you for your business! Please visit again.';
  drawText(footerText, 40, currentY, 9, 'F2', darkTextColor, 'center', 515);
  currentY += 12;
  drawText('Smart Bill POS - Crafted by Code N Pixels (codenpixels.in)', 40, currentY, 7.5, 'F1', mutedTextColor, 'center', 515);

  // --- 7. ASSEMBLE PDF DATA ---
  const contentStream = streamOps.join('\n');
  const streamLength = contentStream.length;

  const pdfBody = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    'endobj',
    '4 0 obj',
    `<< /Length ${streamLength} >>`,
    'stream',
    contentStream,
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    'endobj',
    '6 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    'endobj'
  ];

  let offset = 0;
  const xrefOffsets: number[] = [0];

  const fullPdfStringParts: string[] = [];
  pdfBody.forEach((item) => {
    if (item.startsWith('1 0 obj') || item.startsWith('2 0 obj') || item.startsWith('3 0 obj') || item.startsWith('4 0 obj') || item.startsWith('5 0 obj') || item.startsWith('6 0 obj')) {
      xrefOffsets.push(offset);
    }
    const part = item + '\n';
    fullPdfStringParts.push(part);
    offset += part.length;
  });

  const startXref = offset;
  const xrefCount = xrefOffsets.length;

  fullPdfStringParts.push('xref\n');
  fullPdfStringParts.push(`0 ${xrefCount}\n`);
  fullPdfStringParts.push('0000000000 65535 f \n');
  for (let i = 1; i < xrefCount; i++) {
    const offStr = xrefOffsets[i].toString().padStart(10, '0');
    fullPdfStringParts.push(`${offStr} 00000 n \n`);
  }

  fullPdfStringParts.push('trailer\n');
  fullPdfStringParts.push(`<< /Size ${xrefCount} /Root 1 0 R >>\n`);
  fullPdfStringParts.push('startxref\n');
  fullPdfStringParts.push(`${startXref}\n`);
  fullPdfStringParts.push('%%EOF\n');

  const finalString = fullPdfStringParts.join('');
  const outputBytes = new Uint8Array(finalString.length);
  for (let i = 0; i < finalString.length; i++) {
    outputBytes[i] = finalString.charCodeAt(i) & 0xff;
  }

  return outputBytes;
}
