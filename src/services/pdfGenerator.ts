import PDFDocument from 'pdfkit';
import { Invoice, StoreSettings } from '../types';

function formatPdfCurrency(amount: number, includePrefix: boolean = true): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  const numStr = safeAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return includePrefix ? `Rs. ${numStr}` : numStr;
}

export function generateInvoicePDFBuffer(invoice: Invoice, store: StoreSettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#107C41';
      const textColor = '#201F1E';
      const mutedColor = '#605E5C';
      const borderColor = '#EDEBE9';

      // --- HEADER ---
      doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text((store.storeName || '').toUpperCase(), 40, 40);
      let topY = 56;
      if (store.tagline) {
        doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Oblique').text(store.tagline, 40, topY);
        topY += 16; // comfortable spacing between tagline and address details
      } else {
        topY += 6;
      }
      doc.fillColor('#334155').fontSize(9).font('Helvetica');
      if (store.address) {
        doc.text(store.address, 40, topY);
        topY += 12;
      }
      if (store.cityStatePin) {
        doc.text(store.cityStatePin, 40, topY);
        topY += 12;
      }
      if (store.phone) {
        doc.text(`Ph: ${store.phone}`, 40, topY);
        topY += 12;
      }
      if (store.gstin) {
        doc.text(`GSTIN: ${store.gstin}`, 40, topY);
        topY += 12;
      }

      // --- INVOICE TITLE & METADATA (Right Aligned) ---
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 350, 40, { align: 'right' });
      doc.fillColor(textColor).fontSize(10).font('Helvetica');
      doc.text(`Invoice No: ${invoice.invoiceNumber}`, 350, 65, { align: 'right' });
      doc.text(`Date: ${invoice.invoiceDate}`, 350, 80, { align: 'right' });
      doc.text(`Payment: ${invoice.paymentMethod}`, 350, 95, { align: 'right' });

      let currentY = Math.max(topY + 15, 120);

      // Horizontal Divider
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderColor).lineWidth(1).stroke();
      currentY += 15;

      // --- CUSTOMER DETAILS ---
      doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text('Billed To:', 40, currentY);
      currentY += 14;
      doc.font('Helvetica').fontSize(9);
      if (invoice.customerName) {
        doc.text(`Name: ${invoice.customerName}`, 40, currentY);
        currentY += 12;
      }
      if (invoice.customerPhone) {
        doc.text(`Phone: ${invoice.customerPhone}`, 40, currentY);
        currentY += 12;
      }
      if (invoice.customerAddress) {
        doc.text(`Address: ${invoice.customerAddress}`, 40, currentY);
        currentY += 12;
      }
      currentY += 10;

      // --- ITEMS TABLE HEADER ---
      const tableTop = currentY;
      doc.rect(40, tableTop, 515, 22).fill('#F3F2F1');
      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
      doc.text('#', 45, tableTop + 6, { width: 25 });
      doc.text('Item Description', 72, tableTop + 6, { width: 195 });
      doc.text('Qty', 270, tableTop + 6, { width: 35, align: 'center' });
      doc.text('Rate (Rs.)', 310, tableTop + 6, { width: 65, align: 'right' });
      doc.text('Discount', 380, tableTop + 6, { width: 60, align: 'right' });
      doc.text('Amount (Rs.)', 445, tableTop + 6, { width: 100, align: 'right' });

      currentY = tableTop + 25;
      doc.font('Helvetica').fontSize(9);

      // --- ITEMS TABLE ROWS ---
      invoice.items.forEach((item, index) => {
        const rowY = currentY;
        const discDisplay = item.discount || (item.discountPercent > 0 ? `${item.discountPercent}%` : '0%');
        const formattedPrice = formatPdfCurrency(item.price, false);
        const formattedTotal = formatPdfCurrency(item.total, false);

        // Check page overflow
        if (rowY > 720) {
          doc.addPage();
          currentY = 40;
        }

        doc.fillColor(textColor);
        doc.text(String(index + 1), 45, rowY, { width: 25 });
        doc.text(item.itemName, 72, rowY, { width: 195 });
        doc.text(String(item.quantity), 270, rowY, { width: 35, align: 'center' });
        doc.text(formattedPrice, 310, rowY, { width: 65, align: 'right' });
        doc.text(discDisplay, 380, rowY, { width: 60, align: 'right' });
        doc.font('Helvetica-Bold').text(formattedTotal, 445, rowY, { width: 100, align: 'right' }).font('Helvetica');

        currentY += 20;
        doc.moveTo(40, currentY - 4).lineTo(555, currentY - 4).strokeColor('#F3F2F1').lineWidth(0.5).stroke();
      });

      currentY += 10;

      // --- SUMMARY BLOCK ---
      const summaryX = 310;
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderColor).lineWidth(1).stroke();
      currentY += 15;

      const printSummaryRow = (label: string, valStr: string, isBold = false) => {
        if (isBold) {
          doc.font('Helvetica-Bold').fillColor(primaryColor).fontSize(10);
        } else {
          doc.font('Helvetica').fillColor(textColor).fontSize(9);
        }
        doc.text(label, summaryX, currentY, { width: 130, align: 'left' });
        doc.text(valStr, summaryX + 130, currentY, { width: 110, align: 'right' });
        currentY += 16;
      };

      printSummaryRow('Sub Total:', formatPdfCurrency(invoice.subtotal));
      if (invoice.billDiscountAmount > 0) {
        printSummaryRow('Bill Discount:', `- ${formatPdfCurrency(invoice.billDiscountAmount)}`);
      }
      if (invoice.taxAmount > 0) {
        printSummaryRow('GST / Tax:', formatPdfCurrency(invoice.taxAmount));
      }
      if (invoice.deliveryCharges && invoice.deliveryCharges > 0) {
        printSummaryRow('Delivery Fees:', `+ ${formatPdfCurrency(invoice.deliveryCharges)}`);
      }

      currentY += 2;
      doc.rect(summaryX - 5, currentY - 4, 250, 24).fill('#E1DFDD');
      currentY += 3;
      printSummaryRow('Grand Total:', formatPdfCurrency(invoice.grandTotal), true);

      if (invoice.receivedAmount !== undefined && invoice.receivedAmount > 0) {
        currentY += 6;
        printSummaryRow('Amount Received:', formatPdfCurrency(invoice.receivedAmount));
        if (invoice.changeAmount !== undefined && invoice.changeAmount > 0) {
          printSummaryRow('Change / Balance:', formatPdfCurrency(invoice.changeAmount));
        }
      }

      // --- FOOTER ---
      currentY += 30;
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderColor).lineWidth(1).stroke();
      currentY += 15;
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('Thank you for your business!', 40, currentY, { align: 'center' });
      currentY += 12;
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Smart Bill POS - Crafted by Code N Pixels (codenpixels.in)', 40, currentY, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
