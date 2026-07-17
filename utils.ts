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
