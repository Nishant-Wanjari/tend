// Month data shared by the on-screen calendars and the calendar share cards,
// so the card always shows exactly what the screen shows.
import { startOfMonth, endOfMonth, startOfWeek, addDays, eachDay, todayKey, fmtMonth, monthOf } from './date.js';
import { habitDone, habitValue, scheduledOn, isWeekly, habitStreak, isSpend } from './stats.js';
import { inr, inrCompact, num, plural } from './format.js';

export const TYPE_COLOR = { Push: 3, Pull: 5, Legs: 1, 'Upper Body': 3, 'Lower Body': 1, Cardio: 4, 'Full Body': 2, Custom: 6 };
export const TYPE_SHORT = { Push: 'Push', Pull: 'Pull', Legs: 'Legs', 'Upper Body': 'Upper', 'Lower Body': 'Lower', Cardio: 'Cardio', 'Full Body': 'Full', Custom: 'Other' };
// categorical slots as hex, for canvas drawing (light / dark steps of the app palette)
export const HEX = {
  light: ['', '#1E7A55', '#AD7E00', '#2F74C8', '#D2622A', '#6A5CD0', '#CC5F8C', '#7FA58F', '#5A6870'],
  dark: ['', '#35A072', '#B68510', '#4F8EDB', '#D96E36', '#8578E3', '#C9668F', '#6E9881', '#808F98'],
};

export function monthGrid(month) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const cells = eachDay(startOfWeek(first), addDays(startOfWeek(last), 6));
  return { first, last, cells, rows: cells.length / 7 };
}

export const coverSrc = (b) => (b?.coverId ? `/_blob/${b.coverId}` : b?.coverData || null);

/**
 * kind: reading | gym | finance | habits. Returns per-day tiles plus a summary.
 * habitId: a habit id, or 'all' for the combined habits calendar.
 */
export function calendarData(state, kind, month, { habitId = 'all', hideAmounts = false } = {}) {
  const today = todayKey();
  const { first, last } = monthGrid(month);
  const days = eachDay(first, last);
  const tiles = {};
  const label = fmtMonth(first);

  if (kind === 'reading') {
    const byDay = {};
    for (const s of state.readingSessions) {
      if (s.date < first || s.date > last) continue;
      (byDay[s.date] ||= {})[s.bookId] = ((byDay[s.date] || {})[s.bookId] || 0) + s.pages;
    }
    let pages = 0;
    const books = new Set();
    for (const k of days) {
      const m = byDay[k];
      if (!m) continue;
      const ids = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      ids.forEach((id) => books.add(id));
      const p = Object.values(m).reduce((a, b) => a + b, 0);
      pages += p;
      tiles[k] = { books: ids.map((id) => state.books.find((b) => b.id === id)).filter(Boolean).slice(0, 2), pages: p };
    }
    const finished = state.books.filter((b) => b.finishedAt && b.finishedAt >= first && b.finishedAt <= last).length;
    return {
      kind, month: first, label, title: 'Monthly reading calendar', tiles,
      summary: [
        { value: String(Object.keys(tiles).length), label: 'days read' },
        { value: num(pages), label: 'pages' },
        { value: String(finished || books.size), label: finished ? plural(finished, 'book finished', 'books finished').replace(/^\d+ /, '') : (books.size === 1 ? 'book on the go' : 'books on the go') },
      ],
    };
  }

  if (kind === 'gym') {
    const counts = {};
    let minutes = 0;
    let n = 0;
    for (const w of state.workouts) {
      if (!w.completed || w.date < first || w.date > last) continue;
      n++;
      minutes += w.duration || 0;
      counts[w.type] = (counts[w.type] || 0) + 1;
      if (!tiles[w.date]) tiles[w.date] = { type: w.type, color: TYPE_COLOR[w.type] || 3, label: TYPE_SHORT[w.type] || w.type, more: 0 };
      else tiles[w.date].more++;
    }
    const legend = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ label: TYPE_SHORT[t] || t, color: TYPE_COLOR[t] || 3, count: c }));
    return {
      kind, month: first, label, title: 'Training calendar', tiles, legend,
      summary: [
        { value: String(n), label: n === 1 ? 'workout' : 'workouts' },
        { value: (minutes / 60).toFixed(minutes >= 600 ? 0 : 1), label: 'hours training' },
        { value: String(Object.keys(tiles).length), label: 'active days' },
      ],
    };
  }

  if (kind === 'finance') {
    const spend = {};
    for (const t of state.transactions) {
      if (t.date < first || t.date > last || !isSpend(t)) continue;
      spend[t.date] = (spend[t.date] || 0) + t.amount;
    }
    // shade against the daily budget so one rent day doesn't flatten every other day
    const daily = (state.settings.monthlyBudget || 0) / days.length;
    const vals = Object.values(spend).sort((a, b) => a - b);
    const p90 = vals[Math.floor(vals.length * 0.9)] || 1;
    const scale = Math.max(daily * 2, p90) || 1;
    const elapsed = days.filter((k) => k <= today);
    let total = 0;
    for (const k of elapsed) {
      const v = spend[k] || 0;
      total += v;
      tiles[k] = { amount: v, level: Math.min(1, v / scale), text: hideAmounts ? '' : v ? inrCompact(v).replace('₹', '₹') : '₹0', over: daily > 0 && v > daily };
    }
    const noSpend = elapsed.filter((k) => !spend[k]).length;
    return {
      kind, month: first, label, title: 'Daily spending', tiles,
      summary: hideAmounts ? [
        { value: String(noSpend), label: 'no-spend days' },
        { value: String(elapsed.filter((k) => spend[k] && spend[k] <= daily).length), label: 'days within budget' },
        { value: daily ? `${Math.round((total / (daily * elapsed.length || 1)) * 100)}%` : '—', label: 'of budget pace' },
      ] : [
        { value: inrCompact(total), label: 'spent' },
        { value: inrCompact(elapsed.length ? total / elapsed.length : 0), label: 'average a day' },
        { value: String(noSpend), label: 'no-spend days' },
      ],
    };
  }

  // habits
  const habits = state.habits.filter((h) => !h.archived);
  const h = habitId !== 'all' ? habits.find((x) => x.id === habitId) : null;
  if (h) {
    let done = 0;
    let due = 0;
    for (const k of days) {
      if (k > today) { tiles[k] = { state: 'future' }; continue; }
      if (k < h.startDate) { tiles[k] = { state: 'off' }; continue; }
      const isDue = isWeekly(h) || scheduledOn(h, k);
      const d = habitDone(state.habitLogs, h, k);
      const v = habitValue(state.habitLogs, h, k);
      if (d) done++;
      if (isDue && !isWeekly(h)) due++;
      tiles[k] = { state: d ? 'done' : v > 0 ? 'part' : isDue && !isWeekly(h) && k < today ? 'miss' : isDue ? 'open' : 'off', level: d ? 1 : h.type === 'boolean' ? 0 : Math.min(1, v / h.target) };
    }
    const s = habitStreak(state.habitLogs, h, today);
    return {
      kind, month: first, label, title: h.name, habit: h, color: h.color, tiles,
      summary: [
        { value: isWeekly(h) ? String(done) : `${done}/${due}`, label: isWeekly(h) ? 'days done' : 'days completed' },
        { value: String(s.count), label: `${s.unit} streak` },
        { value: !isWeekly(h) && due ? `${Math.round((done / due) * 100)}%` : `${h.freq.times}×/wk`, label: !isWeekly(h) && due ? 'completion' : 'target' },
      ],
    };
  }
  let perfect = 0;
  let sum = 0;
  let counted = 0;
  for (const k of days) {
    if (k > today) { tiles[k] = { state: 'future' }; continue; }
    const dueList = habits.filter((x) => scheduledOn(x, k));
    if (!dueList.length) { tiles[k] = { state: 'off' }; continue; }
    const r = dueList.filter((x) => habitDone(state.habitLogs, x, k)).length / dueList.length;
    if (k !== today || r > 0) { sum += r; counted++; }
    if (r >= 1) perfect++;
    tiles[k] = { state: r >= 1 ? 'done' : r > 0 ? 'part' : k < today ? 'miss' : 'open', level: r };
  }
  return {
    kind, month: first, label, title: 'All habits', color: 4, tiles,
    summary: [
      { value: String(perfect), label: 'perfect days' },
      { value: counted ? `${Math.round((sum / counted) * 100)}%` : '—', label: 'average completion' },
      { value: String(habits.length), label: habits.length === 1 ? 'habit tracked' : 'habits tracked' },
    ],
  };
}
