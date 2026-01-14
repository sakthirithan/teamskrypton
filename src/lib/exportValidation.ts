import { parseISO, isBefore, isAfter, startOfDay } from 'date-fns';

export interface DateValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validateExportDateRange(
  fromDate: string,
  toDate: string
): DateValidationResult {
  const today = startOfDay(new Date());

  // If both are empty, valid (full export)
  if (!fromDate && !toDate) {
    return { isValid: true, error: null };
  }

  // Validate From Date
  if (fromDate) {
    const from = parseISO(fromDate);
    if (isAfter(from, today)) {
      return { isValid: false, error: 'From Date cannot be in the future' };
    }
  }

  // Validate To Date
  if (toDate) {
    const to = parseISO(toDate);
    if (isAfter(to, today)) {
      return { isValid: false, error: 'To Date cannot be in the future' };
    }
  }

  // Validate From <= To
  if (fromDate && toDate) {
    const from = parseISO(fromDate);
    const to = parseISO(toDate);
    if (isAfter(from, to)) {
      return { isValid: false, error: 'From Date must be before or equal to To Date' };
    }
  }

  return { isValid: true, error: null };
}

// Format today's date as YYYY-MM-DD for max attribute on date inputs
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}
