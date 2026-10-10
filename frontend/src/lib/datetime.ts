// Conversions between ISO date-times from the API and <input type="datetime-local"> values,
// which are in the viewer's time zone.
import { IsoDateTime } from '@/types/api';

const pad = (n: number) => String(n).padStart(2, '0');

export const toLocalInput = (iso: IsoDateTime | null | undefined, withSeconds = false) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
};

export const fromLocalInput = (value: string): IsoDateTime | null => (value ? new Date(value).toISOString() : null);
