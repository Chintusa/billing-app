import { AppSettings, MarketingFooterSettings, MarketingNote } from '../types';

/**
 * 2 Curated Default Marketing Notes for Store POS Bills
 */
export const DEFAULT_MARKETING_NOTES: MarketingNote[] = [
  {
    id: 'note-delivery',
    title: 'HOME DELIVERY',
    content: 'Available at applicable charges based on distance/order value. Please ask our staff for details.',
    category: 'Delivery',
    priority: 'High',
    active: true,
    order: 1
  },
  {
    id: 'note-new-arrivals',
    title: 'NEW ARRIVALS',
    content: 'Fresh styles and new collections are added regularly. Visit us again to explore what’s new.',
    category: 'New Arrivals',
    priority: 'High',
    active: true,
    order: 2
  }
];

export const DEFAULT_MARKETING_SETTINGS: MarketingFooterSettings = {
  enabled: true,
  delivery: {
    enabled: true,
    freeDeliveryAbove: 2000,
    standardDeliveryCharge: 50,
    customMessage: 'HOME DELIVERY: Available at applicable charges based on distance/order value. Please ask our staff for details.'
  },
  maxNotesPerBill: 2,
  rotationMode: 'Rotate by Bill Number',
  showDivider: true,
  customFooterText: 'Thank you for shopping with us! Please visit again.',
  notes: DEFAULT_MARKETING_NOTES
};

/**
 * Formats a single MarketingNote into the standard receipt note string.
 * Example: "HOME DELIVERY: Available at applicable charges..."
 */
export function formatMarketingNoteString(note: MarketingNote | { title: string; content: string }): string {
  const cleanTitle = note.title.trim().toUpperCase();
  const cleanContent = note.content.trim();
  if (!cleanTitle) return cleanContent;
  if (!cleanContent) return cleanTitle;
  // If content already begins with title, return content
  if (cleanContent.toUpperCase().startsWith(cleanTitle)) {
    return cleanContent;
  }
  return `${cleanTitle}: ${cleanContent}`;
}

/**
 * Resolves the exact list of marketing note strings to display on a specific bill/invoice.
 * Strictly guarantees:
 * 1. Delivery is ALWAYS note #1 if delivery is enabled.
 * 2. Rotating notes are selected deterministically by invoice number so receipts don't repeat the same ad.
 * 3. Priority & active date ranges (startDate / endDate) are strictly respected.
 * 4. Never exceeds maxNotesPerBill (preventing thermal paper overflow).
 */
export function resolveInvoiceMarketingNotes(
  settings?: AppSettings,
  invoiceNumber: string = 'INV-1',
  invoiceDate?: string,
  grandTotal?: number
): string[] {
  const config = settings?.marketingFooter || DEFAULT_MARKETING_SETTINGS;

  if (!config || !config.enabled) {
    return [];
  }

  const resultNotes: string[] = [];
  const maxNotes = Math.max(1, Math.min(6, config.maxNotesPerBill || 3));

  // 1. MANDATORY NOTE: Delivery Information (Always Note #1 if enabled)
  if (config.delivery?.enabled) {
    let deliveryText = config.delivery.customMessage?.trim();
    if (!deliveryText) {
      deliveryText = 'HOME DELIVERY: Available at applicable charges based on distance/order value. Please ask our staff for details.';
    }

    // Dynamic free delivery notification if order qualifies
    if (
      config.delivery.freeDeliveryAbove &&
      config.delivery.freeDeliveryAbove > 0 &&
      grandTotal !== undefined &&
      grandTotal >= config.delivery.freeDeliveryAbove
    ) {
      deliveryText = `HOME DELIVERY: Qualified for FREE Home Delivery on this order (above ₹${config.delivery.freeDeliveryAbove})! Please ask staff for dispatch.`;
    }

    resultNotes.push(deliveryText);
  }

  // If we already reached the max notes quota from mandatory notes alone, return immediately
  if (resultNotes.length >= maxNotes) {
    return resultNotes.slice(0, maxNotes);
  }

  // 2. FILTER & SORT CANDIDATE MARKETING NOTES
  const todayStr = invoiceDate || new Date().toISOString().split('T')[0];
  const allNotes = Array.isArray(config.notes) ? config.notes : DEFAULT_MARKETING_NOTES;

  const candidateNotes = allNotes.filter((note) => {
    if (!note.active) return false;
    if (note.category === 'Delivery') return false; // Handled separately by delivery policy

    // Date range validation
    if (note.startDate && note.startDate.trim() && todayStr < note.startDate) {
      return false;
    }
    if (note.endDate && note.endDate.trim() && todayStr > note.endDate) {
      return false;
    }

    return true;
  });

  if (candidateNotes.length === 0) {
    return resultNotes;
  }

  // Sort candidate notes by Priority (High -> Medium -> Low), then by defined Order
  const priorityWeight: Record<string, number> = { High: 1, Medium: 2, Low: 3 };
  const sortedNotes = [...candidateNotes].sort((a, b) => {
    const pA = priorityWeight[a.priority] || 2;
    const pB = priorityWeight[b.priority] || 2;
    if (pA !== pB) return pA - pB;
    return (a.order || 0) - (b.order || 0);
  });

  const slotsRemaining = maxNotes - resultNotes.length;

  // 3. APPLY ROTATION LOGIC
  if (config.rotationMode === 'All Active') {
    for (let i = 0; i < slotsRemaining && i < sortedNotes.length; i++) {
      resultNotes.push(formatMarketingNoteString(sortedNotes[i]));
    }
  } else if (config.rotationMode === 'Random') {
    // Random sample without duplicates
    const pool = [...sortedNotes];
    while (resultNotes.length < maxNotes && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const chosen = pool.splice(idx, 1)[0];
      resultNotes.push(formatMarketingNoteString(chosen));
    }
  } else {
    // Default & Recommended: 'Rotate by Bill Number' (Deterministic & predictable)
    // Extract numerical suffix or sum character codes of invoiceNumber
    const numMatch = invoiceNumber.match(/(\d+)/g);
    let invoiceSeq = 1;
    if (numMatch && numMatch.length > 0) {
      invoiceSeq = parseInt(numMatch[numMatch.length - 1], 10) || 1;
    } else {
      invoiceSeq = invoiceNumber.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    }

    const totalCandidates = sortedNotes.length;
    const startIndex = Math.abs(invoiceSeq - 1) % totalCandidates;

    for (let i = 0; i < slotsRemaining && i < totalCandidates; i++) {
      const noteIndex = (startIndex + i) % totalCandidates;
      resultNotes.push(formatMarketingNoteString(sortedNotes[noteIndex]));
    }
  }

  return resultNotes;
}
