// Basta's own 24px icon set: 2px round strokes, chunky "school supplies" forms. Not a stock icon library.
import type { SVGProps } from 'react';
type P = SVGProps<SVGSVGElement> & { size?: number };
const S = ({ size = 22, children, ...p }: P & { children: any }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
export const IBag = (p: P) => <S {...p}><rect x="3.5" y="7" width="17" height="14" rx="4" /><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" /><rect x="7.5" y="11.5" width="9" height="4.5" rx="1.6" /></S>;
export const IRoll = (p: P) => <S {...p}><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14.5 9.5H17M14.5 15.5H17" /></S>;
export const ICoin = (p: P) => <S {...p}><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></S>;
export const IBell = (p: P) => <S {...p}><path d="M12 3v1.5M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></S>;
export const IReport = (p: P) => <S {...p}><path d="M6 3.5h9l3.5 3.5v13.5H6z" /><path d="M15 3.5V7h3.5M9 12h6M9 15.5h4" /><circle cx="15.5" cy="16.5" r="0" /></S>;
export const IKids = (p: P) => <S {...p}><circle cx="8.5" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M3.5 20c.5-3.6 2.4-5.5 5-5.5s4.5 1.9 5 5.5M14 15.2c.8-.5 1.6-.7 2.5-.7 2.2 0 3.6 1.7 4 4.5" /></S>;
export const IHome = (p: P) => <S {...p}><path d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></S>;
export const ICog = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" /></S>;
export const IPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const ISearch = (p: P) => <S {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></S>;
export const IClose = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IMenu = (p: P) => <S {...p}><path d="M4 7h16M4 12h16M4 17h10" /></S>;
export const IPrint = (p: P) => <S {...p}><path d="M7 9V3.5h10V9M7 17H4.5V9h15v8H17" /><rect x="7" y="14" width="10" height="6.5" rx="1" /></S>;
export const IChat = (p: P) => <S {...p}><path d="M4 18.5l1.2-3.4A7.5 7.5 0 1 1 8.4 18z" /><path d="M9 11h6M9 14h3.5" /></S>;
export const IPin = (p: P) => <S {...p}><path d="M14.5 3.5l6 6-3 1-3.5 3.5.5 4-2 2-9-9 2-2 4 .5L13.5 6z" /><path d="M7 17l-3.5 3.5" /></S>;
export const ILock = (p: P) => <S {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></S>;
export const IOut = (p: P) => <S {...p}><path d="M14 4.5H6.5v15H14M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" /></S>;
export const IShield = (p: P) => <S {...p}><path d="M12 3.5l7 3v5.5c0 4.2-3 7.4-7 8.5-4-1.1-7-4.3-7-8.5V6.5z" /><path d="M9 12l2 2 4-4" /></S>;
export const IPencil = (p: P) => <S {...p}><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" /><path d="M13.5 7l3 3" /></S>;
export const IBack = (p: P) => <S {...p}><path d="M14.5 5.5L8 12l6.5 6.5" /></S>;
export const IDown = (p: P) => <S {...p}><path d="M6 9.5l6 6 6-6" /></S>;
export const IDoc = (p: P) => <S {...p}><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4" /></S>;
