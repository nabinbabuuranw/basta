import { fmtNpr, adIsoToBs } from '../../shared/school';
import { BS_MONTHS_EN } from '../../shared/nepali-date.js';
export const rs = (p: number) => 'Rs ' + fmtNpr(p);
export function bsDate(iso: string | null | undefined): string {
  if (!iso) return ''; const b = adIsoToBs(iso.slice(0, 10)); if (!b) return iso; const [y, m, d] = b.split('-').map(Number); return `${d} ${BS_MONTHS_EN[m - 1]} ${y}`;
}
export function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' d ago';
}
export const initials = (n: string) => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
export const waLink = (phone: string, text: string) => `https://wa.me/977${phone}?text=${encodeURIComponent(text)}`;
