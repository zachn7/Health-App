/**
 * Date Utility Functions
 * 
 * All date operations should use local time, NOT UTC.
 * This prevents timezone issues where "today" becomes "yesterday".
 */

/**
 * Get local date key in YYYY-MM-DD format (uses local time, NOT UTC)
 * This is the canonical format for all storage keys throughout the app.
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's local date key
 */
export function getTodayLocalDateKey(): string {
  return getLocalDateKey(new Date());
}

/**
 * Parse a local date key (YYYY-MM-DD) to a Date object
 * Preserves local time (does not apply timezone offset)
 */
export function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Add or subtract days from a local date key
 */
export function addDaysToLocalDate(dateKey: string, days: number): string {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

/**
 * Format a local date key for display
 */
export function formatLocalDate(dateKey: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseLocalDateKey(dateKey);
  return date.toLocaleDateString('en-US', {
    weekday: options?.weekday,
    year: options?.year || 'numeric',
    month: options?.month || 'long',
    day: options?.day || 'numeric'
  });
}

/**
 * Compare two local date keys
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareLocalDates(dateKey1: string, dateKey2: string): number {
  if (dateKey1 < dateKey2) return -1;
  if (dateKey1 > dateKey2) return 1;
  return 0;
}

/**
 * Check if a local date key is in the past (before today)
 */
export function isPastDate(dateKey: string): boolean {
  return compareLocalDates(dateKey, getTodayLocalDateKey()) < 0;
}

/**
 * Check if a local date key is today
 */
export function isToday(dateKey: string): boolean {
  return compareLocalDates(dateKey, getTodayLocalDateKey()) === 0;
}

/**
 * Check if a local date key is in the future (after today)
 */
export function isFutureDate(dateKey: string): boolean {
  return compareLocalDates(dateKey, getTodayLocalDateKey()) > 0;
}

/**
 * Get relative date description (e.g., "Today", "Yesterday", "Tomorrow", or the date)
 */
export function getRelativeDateDescription(dateKey: string): string {
  if (isToday(dateKey)) return 'Today';
  
  const yesterday = getLocalDateKey(new Date(Date.now() - 86400000));
  if (dateKey === yesterday) return 'Yesterday';
  
  const tomorrow = getLocalDateKey(new Date(Date.now() + 86400000));
  if (dateKey === tomorrow) return 'Tomorrow';
  
  return formatLocalDate(dateKey, { month: 'short', day: 'numeric' });
}

/**
 * Format weight to 1 decimal place consistently
 */
export function formatWeightToOneDecimal(weight: number): string {
  return weight.toFixed(1);
}