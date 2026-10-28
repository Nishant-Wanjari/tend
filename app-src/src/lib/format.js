const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const inr = (n) => inrFmt.format(Math.round(n || 0));
export const num = (n) => numFmt.format(n || 0);

// ₹1.2L / ₹3.4Cr — the way amounts are spoken in India
export function inrCompact(n) {
  const v = Math.abs(n || 0);
  const sign = n < 0 ? '−' : '';
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${sign}₹${trim(v / 1e3)}k`;
  return `${sign}₹${Math.round(v)}`;
}
const trim = (x) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''));

export function hoursMin(minutes) {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
export const hoursDec = (minutes) => trim((minutes || 0) / 60);
export const pct = (x) => `${Math.round((x || 0) * 100)}%`;
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
