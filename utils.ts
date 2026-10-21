/**
 * Calculates the Thai fiscal year in the Buddhist Era (B.E.) for a given date.
 * The Thai fiscal year starts on October 1st and ends on September 30th of the next year.
 */
export const getFiscalYearBE = (date: Date): number => {
  const gregorianYear = date.getFullYear();
  const month = date.getMonth(); 
  const gregorianFiscalYearEnd = month >= 9 ? gregorianYear + 1 : gregorianYear;
  return gregorianFiscalYearEnd + 543;
};

/**
 * Returns the exact start and end Dates and standard label for a Thai Fiscal Year.
 * Thai Fiscal Year 2569: 1 Oct 2568 (2025) to 30 Sep 2569 (2026).
 * Thai Fiscal Year 2570 starts 1 Oct 2569 (2026).
 */
export const getFiscalYearDateRange = (fiscalYearBE: number): { start: Date; end: Date; label: string; fullLabel: string } => {
  const gregorianYearEnd = fiscalYearBE - 543;
  const gregorianYearStart = gregorianYearEnd - 1;
  const start = new Date(gregorianYearStart, 9, 1, 0, 0, 0, 0); // 1 Oct
  const end = new Date(gregorianYearEnd, 8, 30, 23, 59, 59, 999); // 30 Sep
  const startThaiYear = gregorianYearStart + 543;
  const endThaiYear = fiscalYearBE;
  const label = `1 ต.ค. ${String(startThaiYear).slice(-2)} - 30 ก.ย. ${String(endThaiYear).slice(-2)}`;
  const fullLabel = `ปีงบประมาณ ${fiscalYearBE} (${label})`;
  return { start, end, label, fullLabel };
};

/**
 * Helper to determine the actual approved quantity of a requisition item.
 * Strictly counts ONLY items that have been approved by Admin:
 * - Requisition status must be 'Ready', 'Completed', or 'PartiallyApproved'
 * - Item status must not be 'Rejected', 'Cancelled', 'Backordered'
 * - Returns item.approvedQuantity if provided; if Ready/Completed with legacy null, uses item.quantity.
 * - Otherwise returns 0.
 */
export const getApprovedItemQuantity = (
  req: { status?: string } | null | undefined,
  item: { approvedQuantity?: number | null; quantity: number; status?: string }
): number => {
  if (!req || !req.status) return 0;
  if (!['Completed', 'Ready', 'PartiallyApproved'].includes(req.status)) return 0;
  if (['Rejected', 'Cancelled', 'Backordered'].includes(item.status as string)) return 0;
  if (item.approvedQuantity !== null && item.approvedQuantity !== undefined) {
    return Math.max(0, Number(item.approvedQuantity));
  }
  if (['Completed', 'Ready'].includes(req.status)) {
    return Math.max(0, Number(item.quantity) || 0);
  }
  return 0;
};


/**
 * Generates a requisition number prefix based on Thai Year and Month (YYMM)
 * @param date The date to use for calculation
 */
export const getThaiYearMonthPrefix = (date: Date): string => {
  const thaiYear = date.getFullYear() + 543;
  const yy = String(thaiYear).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

/**
 * Formats a running number into 3 digits
 */
export const formatRunningNumber = (num: number): string => {
  return String(num).padStart(3, '0');
};

export const safeGetStorage = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
};

export const safeSetStorage = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch (e) {}
};

export const safeRemoveStorage = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch (e) {}
};

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Returns default requisition period string in Thai format, e.g. "ตุลาคม 2569"
 */
export const getDefaultRequisitionPeriod = (date: Date = new Date()): string => {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const thaiYear = d.getFullYear() + 543;
  return `${THAI_MONTH_NAMES[d.getMonth()]} ${thaiYear}`;
};

/**
 * Generates dropdown options for requisition period:
 * - Fiscal Year option
 * - 12 months for current year, previous year, and next year
 */
export const getRequisitionPeriodOptions = (date: Date = new Date()): { value: string; label: string }[] => {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const currentYearBE = d.getFullYear() + 543;
  const fiscalYearBE = getFiscalYearBE(d);

  const options: { value: string; label: string }[] = [];

  // Fiscal year option
  options.push({
    value: `ประจำปีงบประมาณ ${fiscalYearBE}`,
    label: `⭐ ประจำปีงบประมาณ ${fiscalYearBE}`
  });

  // Generate months for years (past, current, next)
  const years = [currentYearBE, currentYearBE - 1, currentYearBE + 1];
  for (const year of years) {
    for (let m = 0; m < 12; m++) {
      const monthName = THAI_MONTH_NAMES[m];
      const periodStr = `${monthName} ${year}`;
      if (!options.some(opt => opt.value === periodStr)) {
        options.push({ value: periodStr, label: `${monthName} ${year}` });
      }
    }
  }

  return options;
};

/**
 * Encodes documentRefNo and requisitionPeriod into a safe tag within urgentReason
 * ensuring 100% backward compatibility even if columns don't exist in Supabase DB yet.
 */
export const encodeRequisitionMeta = (
  urgentReason?: string | null,
  documentRefNo?: string | null,
  requisitionPeriod?: string | null
): string | null => {
  const meta: { docRef?: string; period?: string } = {};
  if (documentRefNo && documentRefNo.trim()) {
    meta.docRef = documentRefNo.trim();
  }
  if (requisitionPeriod && requisitionPeriod.trim()) {
    meta.period = requisitionPeriod.trim();
  }

  const clean = urgentReason ? urgentReason.trim() : '';
  if (Object.keys(meta).length === 0) {
    return clean || null;
  }

  const metaTag = `[META:${JSON.stringify(meta)}]`;
  return clean ? `${metaTag} ${clean}` : metaTag;
};

/**
 * Decodes metadata from raw urgentReason string.
 */
export const decodeRequisitionMeta = (
  rawReason?: string | null,
  rawName?: string | null,
  createdAt?: string | Date | null
): { cleanReason: string | null; documentRefNo: string | null; requisitionPeriod: string } => {
  let cleanReason: string | null = rawReason || null;
  let documentRefNo: string | null = null;
  let requisitionPeriod: string = '';

  if (rawReason && typeof rawReason === 'string' && rawReason.startsWith('[META:')) {
    const closeIdx = rawReason.indexOf(']');
    if (closeIdx > 6) {
      try {
        const jsonStr = rawReason.slice(6, closeIdx);
        const parsed = JSON.parse(jsonStr);
        if (parsed.docRef) documentRefNo = String(parsed.docRef).trim();
        if (parsed.period) requisitionPeriod = String(parsed.period).trim();
        const remaining = rawReason.slice(closeIdx + 1).trim();
        cleanReason = remaining || null;
      } catch (e) {
        // Fallback gracefully on parse error
      }
    }
  }

  if (!requisitionPeriod) {
    const d = createdAt ? new Date(createdAt) : new Date();
    requisitionPeriod = getDefaultRequisitionPeriod(d);
  }

  return { cleanReason, documentRefNo, requisitionPeriod };
};
