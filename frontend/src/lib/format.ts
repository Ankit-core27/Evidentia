// Display formatting for values the API sends as ISO strings, byte counts and enum keys.
import { IsoDateTime, TimePrecision } from '@/types/api';

const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const timeWithSecondsFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const parse = (iso: IsoDateTime | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (iso: IsoDateTime | null | undefined, fallback = '—') => {
  const date = parse(iso);
  return date ? dateFormat.format(date) : fallback;
};

export const formatTime = (iso: IsoDateTime | null | undefined, fallback = '—') => {
  const date = parse(iso);
  return date ? timeFormat.format(date) : fallback;
};

export const formatDateTime = (iso: IsoDateTime | null | undefined, fallback = '—') => {
  const date = parse(iso);
  return date ? `${dateFormat.format(date)}, ${timeFormat.format(date)}` : fallback;
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const formatAtPrecision = (date: Date, precision: TimePrecision) => {
  switch (precision) {
    case 'exact':
      return timeWithSecondsFormat.format(date);
    case 'minute':
      return timeFormat.format(date);
    case 'approximate':
      return `about ${timeFormat.format(date)}`;
    case 'day':
      return dateFormat.format(date);
  }
};

/**
 * An event's time at the precision it was recorded with, such as
 * "21:40:12", "about 21:40" or "21:38 to 21:42".
 */
export const formatTimeRange = (
  start: IsoDateTime | null,
  end: IsoDateTime | null,
  precision: TimePrecision
): string => {
  const from = parse(start);
  const to = parse(end);
  if (!from && !to) return 'Time unknown';
  if (from && !to) return formatAtPrecision(from, precision);
  if (!from && to) return `before ${formatAtPrecision(to, precision)}`;
  const startText = formatAtPrecision(from!, precision === 'approximate' ? 'minute' : precision);
  const endText =
    precision !== 'day' && sameDay(from!, to!)
      ? formatAtPrecision(to!, precision === 'approximate' ? 'minute' : precision)
      : `${dateFormat.format(to!)} ${timeFormat.format(to!)}`;
  const range = `${startText} to ${endText}`;
  return precision === 'approximate' ? `about ${range}` : range;
};

export const formatBytes = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

/** "road_accident" → "Road accident". */
export const humanize = (key: string | null | undefined) => {
  if (!key) return '';
  const text = key.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** First line of a description, for list rows and titles. */
export const firstLine = (text: string | null | undefined, maxLength = 120) => {
  const line = (text ?? '').split('\n')[0].trim();
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => part && !part.endsWith('.'))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

export const shortHash = (sha256: string | null | undefined) =>
  sha256 ? `${sha256.slice(0, 12)}…${sha256.slice(-6)}` : '—';
