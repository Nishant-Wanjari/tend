// Local-calendar date helpers. Every date in the app is a "YYYY-MM-DD" key
// built from local time, never from toISOString(), so IST users never see
// yesterday's date after 18:30 UTC.

export const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = () => toKey(new Date());
export const addDays = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
export const diffDays = (a, b) => Math.round((fromKey(a) - fromKey(b)) / 864e5);
export const weekday = (k) => fromKey(k).getDay(); // 0 = Sun
export const startOfWeek = (k) => addDays(k, -((weekday(k) + 6) % 7)); // Monday
export const monthOf = (k) => k.slice(0, 7);
export const startOfMonth = (k) => k.slice(0, 8) + '01';
export const endOfMonth = (k) => {
  const d = fromKey(startOfMonth(k));
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
export const addMonths = (k, n) => {
  const d = fromKey(startOfMonth(k));
  return toKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
};
export const yearOf = (k) => Number(k.slice(0, 4));

export function eachDay(from, to) {
  const out = [];
  if (from > to) return out;
  let k = from;
  let guard = 0;
  while (k <= to && guard++ < 4000) {
    out.push(k);
    k = addDays(k, 1);
  }
  return out;
}

const fmtCache = {};
export function fmt(k, opts) {
  const id = JSON.stringify(opts);
  if (!fmtCache[id]) fmtCache[id] = new Intl.DateTimeFormat('en-IN', opts);
  return fmtCache[id].format(fromKey(k));
}
export const fmtShort = (k) => fmt(k, { day: 'numeric', month: 'short' });
export const fmtLong = (k) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtMonth = (k) => fmt(k, { month: 'long', year: 'numeric' });
export const fmtMonthShort = (k) => fmt(k, { month: 'short' });
export const fmtDow = (k) => fmt(k, { weekday: 'short' });
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_MON = [1, 2, 3, 4, 5, 6, 0];

export function relDay(k, today = todayKey()) {
  const d = diffDays(today, k);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d > 1 && d < 7) return fmtDow(k);
  return fmtShort(k) + (yearOf(k) !== yearOf(today) ? ` ${yearOf(k)}` : '');
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
export const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const fmtTime = (t) => {
  const m = timeToMinutes(t);
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const mm = pad(m % 60);
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
};
