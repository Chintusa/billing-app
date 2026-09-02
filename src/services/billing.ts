import { InvoiceItem, DiscountType } from '../types';

/**
 * Automatically capitalizes the first character of each word in a string.
 * Supports word boundaries like spaces, hyphens, slashes, brackets, commas, periods, etc.
 * Example: "jhasaketan sa" -> "Jhasaketan Sa"
 * Example: "regular item 1" -> "Regular Item 1"
 * Example: "plot 12, station road" -> "Plot 12, Station Road"
 */
export function capitalizeWords(text: string): string {
  if (!text) return '';
  return text.replace(/(^|[\s\-\/\(\[\{,.:;#&])([a-z])/g, (_match, prefix, char) => prefix + char.toUpperCase());
}

/**
 * Phone number sanitizer: allows numeric digits (0-9), commas (,), hyphens (-),
 * plus (+), spaces ( ), slashes (/), and parentheses for multi-numbers and country codes.
 */
export function sanitizePhoneNumber(phone: string, maxLength: number = 100): string {
  if (!phone) return '';
  return phone.replace(/[^0-9,\-+\s\/()]/g, '').slice(0, maxLength);
}


export interface BillingSummary {
  subtotal: number;
  itemCount: number;
  totalQuantity: number;
  billDiscountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  deliveryCharges: number;
  grandTotal: number;
  changeAmount: number;
}

export interface DiscountParseResult {
  isValid: boolean;
  error?: string;
  stages: number[];
  normalizedExpression: string;
}

export interface DiscountCalculationResult {
  isValid: boolean;
  error?: string;
  originalAmount: number;
  discount: string;
  normalizedExpression: string;
  stages: number[];
  finalAmount: number;
  totalDiscountAmount: number;
  effectiveDiscountPercentage: number;
}

export function parseDiscountExpression(discountInput: string | number): DiscountParseResult {
  if (typeof discountInput === 'number') {
    if (isNaN(discountInput) || discountInput < 0) {
      return { isValid: false, stages: [], error: 'Discount percentage cannot be negative', normalizedExpression: '' };
    }
    return { isValid: true, stages: [discountInput], normalizedExpression: `${discountInput}%` };
  }

  const rawStr = (discountInput || '').toString().trim();
  if (!rawStr || rawStr === '0' || rawStr === '0%') {
    return { isValid: true, stages: [0], normalizedExpression: '0%' };
  }

  // Reject strings starting or ending with + or containing ++
  if (rawStr.startsWith('+') || rawStr.endsWith('+') || rawStr.includes('++')) {
    return { isValid: false, stages: [], error: 'Invalid discount expression format', normalizedExpression: rawStr };
  }

  const parts = rawStr.split('+');
  const stages: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part === '') {
      return { isValid: false, stages: [], error: 'Empty stage in discount expression', normalizedExpression: rawStr };
    }

    // Remove all trailing/internal '%' in the stage
    const cleanPart = part.replace(/%/g, '').trim();

    if (!/^\d+(\.\d+)?$/.test(cleanPart)) {
      return { isValid: false, stages: [], error: 'Invalid number in discount percentage', normalizedExpression: rawStr };
    }

    const val = parseFloat(cleanPart);
    if (isNaN(val) || val < 0) {
      return { isValid: false, stages: [], error: 'Discount percentage cannot be negative', normalizedExpression: rawStr };
    }
    if (val > 100) {
      return { isValid: false, stages: [], error: 'Individual discount stage cannot exceed 100%', normalizedExpression: rawStr };
    }
    stages.push(val);
  }

  const normalizedExpression = stages.join('+') + '%';
  return { isValid: true, stages, normalizedExpression };
}

export function calculateDiscount(
  amount: number,
  discountInput: string | number
): DiscountCalculationResult {
  const safeAmount = Math.max(0, amount || 0);
  const rawInput = discountInput !== undefined && discountInput !== null ? discountInput : 0;

  const parsed = parseDiscountExpression(rawInput);
  if (!parsed.isValid) {
    return {
      isValid: false,
      error: parsed.error || 'Invalid discount expression',
      originalAmount: safeAmount,
      discount: String(rawInput),
      normalizedExpression: String(rawInput),
      stages: [],
      finalAmount: safeAmount,
      totalDiscountAmount: 0,
      effectiveDiscountPercentage: 0
    };
  }

  if (safeAmount === 0 || parsed.stages.length === 0) {
    return {
      isValid: true,
      originalAmount: safeAmount,
      discount: parsed.normalizedExpression,
      normalizedExpression: parsed.normalizedExpression,
      stages: parsed.stages,
      finalAmount: 0,
      totalDiscountAmount: 0,
      effectiveDiscountPercentage: 0
    };
  }

  let remaining = safeAmount;
  let totalDiscountAmount = 0;

  for (const stagePct of parsed.stages) {
    if (stagePct <= 0) continue;
    const stageDiscount = Math.round((remaining * (stagePct / 100)) * 100) / 100;
    remaining = Math.max(0, Math.round((remaining - stageDiscount) * 100) / 100);
    totalDiscountAmount += stageDiscount;
  }

  totalDiscountAmount = Math.round(totalDiscountAmount * 100) / 100;
  const finalAmount = Math.max(0, Math.round((safeAmount - totalDiscountAmount) * 100) / 100);
  const effectiveDiscountPercentage = safeAmount > 0
    ? Math.round(((totalDiscountAmount / safeAmount) * 100) * 100) / 100
    : 0;

  return {
    isValid: true,
    originalAmount: safeAmount,
    discount: parsed.normalizedExpression,
    normalizedExpression: parsed.normalizedExpression,
    stages: parsed.stages,
    finalAmount,
    totalDiscountAmount,
    effectiveDiscountPercentage
  };
}

export function calculateItemTotal(
  quantity: number,
  price: number,
  discountInput: number | string
): {
  discountAmount: number;
  total: number;
  discountExpression: string;
  effectiveDiscountPercentage: number;
  isValid: boolean;
  error?: string;
} {
  const safeQty = Math.max(0, quantity || 0);
  const safePrice = Math.max(0, price || 0);
  const gross = safeQty * safePrice;

  const result = calculateDiscount(gross, discountInput);

  return {
    discountAmount: result.totalDiscountAmount,
    total: result.finalAmount,
    discountExpression: result.normalizedExpression,
    effectiveDiscountPercentage: result.effectiveDiscountPercentage,
    isValid: result.isValid,
    error: result.error
  };
}

export function calculateBillingSummary(
  items: InvoiceItem[],
  billDiscountType: DiscountType,
  billDiscountInput: number | string,
  gstEnabled: boolean,
  gstPercentage: number,
  receivedAmount: number,
  deliveryCharges: number = 0
): BillingSummary {
  // 1. Calculate subtotal and item count
  let subtotal = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    subtotal += item.total;
    totalQuantity += item.quantity;
  });

  subtotal = Math.round(subtotal * 100) / 100;

  // 2. Bill level discount calculation
  let billDiscountAmount = 0;

  if (billDiscountType === 'Flat') {
    const safeFlat = typeof billDiscountInput === 'number'
      ? Math.max(0, billDiscountInput)
      : Math.max(0, parseFloat(billDiscountInput as string) || 0);
    billDiscountAmount = Math.min(subtotal, safeFlat);
  } else {
    // Percentage
    const discRes = calculateDiscount(subtotal, billDiscountInput);
    billDiscountAmount = discRes.totalDiscountAmount;
  }
  billDiscountAmount = Math.round(billDiscountAmount * 100) / 100;

  // 3. Taxable Amount
  const taxableAmount = Math.max(0, Math.round((subtotal - billDiscountAmount) * 100) / 100);

  // 4. GST Tax Calculation
  let taxAmount = 0;
  if (gstEnabled && gstPercentage > 0) {
    taxAmount = (taxableAmount * gstPercentage) / 100;
  }
  taxAmount = Math.round(taxAmount * 100) / 100;

  // 5. Delivery Charges
  const safeDelivery = Math.max(0, typeof deliveryCharges === 'number' ? deliveryCharges : parseFloat(deliveryCharges as any) || 0);

  // 6. Grand Total (Taxable + Tax + Delivery Charges)
  const grandTotal = Math.round((taxableAmount + taxAmount + safeDelivery) * 100) / 100;

  // 7. Change Amount
  const safeReceived = Math.max(0, receivedAmount || 0);
  const changeAmount = Math.max(0, Math.round((safeReceived - grandTotal) * 100) / 100);

  return {
    subtotal,
    itemCount: items.length,
    totalQuantity,
    billDiscountAmount,
    taxableAmount,
    taxAmount,
    deliveryCharges: safeDelivery,
    grandTotal,
    changeAmount
  };
}

export function formatCurrency(amount: number, symbol: string = '₹'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `${symbol}${safeAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
