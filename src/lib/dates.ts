/** Alle Werke liegen in Deutschland. Fachliche Datumswerte (z. B. Fälligkeit) beziehen sich auf diese Zeitzone. */
export const DEPOT_TIME_ZONE = 'Europe/Berlin';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DEPOT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Kalenderdatum (YYYY-MM-DD) eines Zeitpunkts in Werkszeit. */
export function toDepotDate(date: Date): string {
  return isoDateFormatter.format(date);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

