import {
  addDays, diffDays, eachDay, startOfWeek, weekday, monthOf, startOfMonth, endOfMonth,
  addMonths, todayKey, yearOf,
} from './date.js';

/* ───────────────────────── Habits ───────────────────────── */

export const habitValue = (logs, h, k) => logs?.[h.id]?.[k] ?? 0;
export const habitDone = (logs, h, k) => {
  const v = habitValue(logs, h, k);
  return h.type === 'boolean' ? v >= 1 : v >= (h.target || 1);
};
export const isWeekly = (h) => h.freq?.kind === 'weekly';

// Is the habit expected on this specific day? Weekly-count habits are never
// "due" on a particular day; they are judged per week.
export function scheduledOn(h, k) {
  if (k < h.startDate) return false;
  const f = h.freq || { kind: 'daily' };
  if (f.kind === 'daily') return true;
  if (f.kind === 'days') return (f.days || []).includes(weekday(k));
  return false;
}

export function weekDoneCount(logs, h, weekStart) {
  let c = 0;
  for (let i = 0; i < 7; i++) if (habitDone(logs, h, addDays(weekStart, i))) c++;
  return c;
}

// Current streak. Day-based habits count consecutive *scheduled* days that
// were completed; unscheduled days are skipped and today never breaks a streak
// while it is still in progress. Weekly habits count consecutive weeks that
// met their target; the current week only adds once it is met.
export function habitStreak(logs, h, today = todayKey()) {
  if (isWeekly(h)) {
    const times = h.freq.times || 1;
    const cur = startOfWeek(today);
    const first = startOfWeek(h.startDate);
    let wk = cur;
    let n = 0;
    let guard = 0;
    while (wk >= first && guard++ < 600) {
      const met = weekDoneCount(logs, h, wk) >= times;
      if (wk === cur) { if (met) n++; }
      else if (met) n++;
      else break;
      wk = addDays(wk, -7);
    }
    return { count: n, unit: 'week' };
  }
  let k = today;
  let n = 0;
  let guard = 0;
  while (k >= h.startDate && guard++ < 4000) {
    if (scheduledOn(h, k)) {
      if (habitDone(logs, h, k)) n++;
      else if (k !== today) break;
    }
    k = addDays(k, -1);
  }
  return { count: n, unit: 'day' };
}

export function habitLongest(logs, h, today = todayKey()) {
  let best = 0;
  let run = 0;
  if (isWeekly(h)) {
    const times = h.freq.times || 1;
    let wk = startOfWeek(h.startDate);
    const cur = startOfWeek(today);
    let guard = 0;
    while (wk <= cur && guard++ < 600) {
      const met = weekDoneCount(logs, h, wk) >= times;
      if (met) run++;
      else if (wk !== cur) run = 0;
      best = Math.max(best, run);
      wk = addDays(wk, 7);
    }
    return { count: best, unit: 'week' };
  }
  for (const k of eachDay(h.startDate, today)) {
    if (!scheduledOn(h, k)) continue;
    if (habitDone(logs, h, k)) run++;
    else if (k !== today) run = 0;
    best = Math.max(best, run);
  }
  return { count: best, unit: 'day' };
}

// Share of expected check-ins that were completed between from and to.
// Today counts only once it is done, so a morning visit doesn't drag the rate down.
export function habitRate(logs, h, from, to, today = todayKey()) {
  const start = from < h.startDate ? h.startDate : from;
  const end = to > today ? today : to;
  if (start > end) return null;
  if (isWeekly(h)) {
    const times = h.freq.times || 1;
    let wk = startOfWeek(start);
    const cur = startOfWeek(today);
    let got = 0;
    let need = 0;
    let guard = 0;
    while (wk <= end && guard++ < 600) {
      const c = Math.min(times, weekDoneCount(logs, h, wk));
      if (wk !== cur || c >= times) { got += c; need += times; }
      wk = addDays(wk, 7);
    }
    return need ? got / need : null;
  }
  let got = 0;
  let need = 0;
  for (const k of eachDay(start, end)) {
    if (!scheduledOn(h, k)) continue;
    const done = habitDone(logs, h, k);
    if (k === today && !done) continue;
    need++;
    if (done) got++;
  }
  return need ? got / need : null;
}

export const fmtStreak = (s) => `${s.count} ${s.unit}${s.count === 1 ? '' : 's'}`;
export const fmtStreakShort = (s) => `${s.count}${s.unit === 'week' ? 'w' : 'd'}`;

/* ───────────────────────── Reading ───────────────────────── */

export function pagesByDay(sessions) {
  const m = {};
  for (const s of sessions) m[s.date] = (m[s.date] || 0) + (s.pages || 0);
  return m;
}
export function minutesByDay(sessions) {
  const m = {};
  for (const s of sessions) m[s.date] = (m[s.date] || 0) + (s.minutes || 0);
  return m;
}

// Generic daily streak over a set of active dates; today may still be pending.
export function dayStreak(activeSet, today = todayKey()) {
  let k = activeSet.has(today) ? today : addDays(today, -1);
  let n = 0;
  let guard = 0;
  while (activeSet.has(k) && guard++ < 4000) { n++; k = addDays(k, -1); }
  return n;
}
export function longestDayStreak(activeSet) {
  const keys = [...activeSet].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && diffDays(k, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export function readingStats(state, today = todayKey()) {
  const { books, readingSessions: sessions, settings } = state;
  const pbd = pagesByDay(sessions);
  const active = new Set(Object.keys(pbd).filter((k) => pbd[k] > 0));
  const y = yearOf(today);
  const finishedThisYear = books.filter((b) => b.status === 'completed' && b.finishedAt && yearOf(b.finishedAt) === y);
  const totalMinutes = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
  const pagesToday = pbd[today] || 0;
  const minutesToday = sessions.filter((s) => s.date === today).reduce((a, s) => a + (s.minutes || 0), 0);
  const current = books.filter((b) => b.status === 'reading').sort((a, b) => (b.lastReadAt || '').localeCompare(a.lastReadAt || ''));
  return {
    pbd,
    streak: dayStreak(active, today),
    longest: longestDayStreak(active),
    pagesToday,
    minutesToday,
    goal: settings.readingDailyPages || 20,
    totalMinutes,
    finishedThisYear,
    yearGoal: settings.readingYearGoal || 12,
    current,
    totalPages: Object.values(pbd).reduce((a, b) => a + b, 0),
  };
}

/* ───────────────────────── Finance ───────────────────────── */

export const isSpend = (t) => t.type === 'expense' && t.category !== 'Investment';
export const isInvest = (t) => t.type === 'expense' && t.category === 'Investment';

export function monthFinance(txs, monthKey) {
  let income = 0;
  let spending = 0;
  let invested = 0;
  const byCat = {};
  for (const t of txs) {
    if (monthOf(t.date) !== monthKey) continue;
    if (t.type === 'income') income += t.amount;
    else if (isInvest(t)) invested += t.amount;
    else {
      spending += t.amount;
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
  }
  const saved = income - spending;
  return { income, spending, invested, saved, rate: income > 0 ? saved / income : 0, byCat };
}

export function financeStats(state, today = todayKey()) {
  const { transactions: txs, settings } = state;
  let balance = settings.openingBalance || 0;
  for (const t of txs) balance += t.type === 'income' ? t.amount : -t.amount;
  const spentToday = txs.filter((t) => t.date === today && isSpend(t)).reduce((a, t) => a + t.amount, 0);
  const month = monthFinance(txs, monthOf(today));
  // savings streak: consecutive months with income > spending; current month
  // counts once positive and never breaks the streak while in progress
  let n = 0;
  let mk = startOfMonth(today);
  const earliest = txs.reduce((m, t) => (t.date < m ? t.date : m), today);
  let guard = 0;
  while (mk >= startOfMonth(earliest) && guard++ < 240) {
    const f = monthFinance(txs, monthOf(mk));
    const isCur = mk === startOfMonth(today);
    if (f.saved > 0 && f.income > 0) n++;
    else if (!isCur) break;
    mk = addMonths(mk, -1);
  }
  const goals = state.goals || [];
  const goalTarget = goals.reduce((a, g) => a + g.target, 0);
  const goalSaved = goals.reduce((a, g) => a + Math.min(g.saved, g.target), 0);
  return {
    balance, spentToday, month, savingsStreak: n,
    budget: settings.monthlyBudget || 0,
    goalProgress: goalTarget ? goalSaved / goalTarget : 0,
  };
}

export function monthsBack(today, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(monthOf(addMonths(today, -i)));
  return out;
}

/* ───────────────────────── Gym ───────────────────────── */

export const workoutVolume = (w) =>
  (w.exercises || []).reduce((a, e) => a + (e.sets || []).reduce((b, s) => b + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0), 0);

export function gymStats(state, today = todayKey()) {
  const { workouts, weights, settings } = state;
  const done = workouts.filter((w) => w.completed);
  const target = settings.workoutsPerWeek || 3;
  const byWeek = {};
  for (const w of done) {
    const wk = startOfWeek(w.date);
    byWeek[wk] = (byWeek[wk] || 0) + 1;
  }
  const cur = startOfWeek(today);
  const earliest = done.reduce((m, w) => (w.date < m ? w.date : m), today);
  let streak = 0;
  let wk = cur;
  let guard = 0;
  while (wk >= startOfWeek(earliest) && guard++ < 600) {
    const met = (byWeek[wk] || 0) >= target;
    if (met) streak++;
    else if (wk !== cur) break;
    wk = addDays(wk, -7);
  }
  let longest = 0;
  let run = 0;
  wk = startOfWeek(earliest);
  guard = 0;
  while (wk <= cur && guard++ < 600) {
    if ((byWeek[wk] || 0) >= target) run++;
    else if (wk !== cur) run = 0;
    longest = Math.max(longest, run);
    wk = addDays(wk, 7);
  }
  const mk = monthOf(today);
  const thisMonth = done.filter((w) => monthOf(w.date) === mk);
  const sortedW = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latestW = sortedW[sortedW.length - 1];
  const firstW = sortedW.find((w) => diffDays(today, w.date) <= 90) || sortedW[0];
  const todays = workouts.filter((w) => w.date === today);
  const planned = (settings.workoutDays || []).includes(weekday(today));
  const last = [...done].sort((a, b) => b.date.localeCompare(a.date))[0];
  // personal records: heaviest set per exercise
  const prs = {};
  for (const w of done) {
    for (const e of w.exercises || []) {
      for (const s of e.sets || []) {
        const wt = Number(s.weight) || 0;
        if (!wt) continue;
        const key = e.name.trim();
        if (!prs[key] || wt > prs[key].weight || (wt === prs[key].weight && s.reps > prs[key].reps)) {
          prs[key] = { name: key, weight: wt, reps: Number(s.reps) || 0, date: w.date };
        }
      }
    }
  }
  return {
    byWeek, streak, longest, target,
    thisWeek: byWeek[cur] || 0,
    monthCount: thisMonth.length,
    monthMinutes: thisMonth.reduce((a, w) => a + (w.duration || 0), 0),
    monthCalories: thisMonth.reduce((a, w) => a + (w.calories || 0), 0),
    caloriesLogged: thisMonth.some((w) => w.calories),
    weight: latestW?.kg ?? null,
    weightChange: latestW && firstW ? latestW.kg - firstW.kg : 0,
    weightSince: firstW?.date,
    todays, planned, last,
    prs: Object.values(prs).sort((a, b) => b.weight - a.weight),
    monthTarget: settings.monthlyWorkoutTarget || 12,
  };
}

/* ───────────────────────── Whole-day roll-up ───────────────────────── */

// The activities expected on a given day: every habit due that day, the
// reading goal, and a workout when it's a planned training day (or one was logged).
export function dayItems(state, k, today = todayKey()) {
  const items = [];
  for (const h of state.habits) {
    if (h.archived || !scheduledOn(h, k)) continue;
    items.push({ kind: 'habit', id: h.id, label: h.name, done: habitDone(state.habitLogs, h, k) });
  }
  const pages = state.readingSessions.filter((s) => s.date === k).reduce((a, s) => a + s.pages, 0);
  const firstRead = state.readingSessions.reduce((m, s) => (s.date < m ? s.date : m), today);
  if (k >= firstRead || pages) {
    items.push({ kind: 'reading', label: 'Reading goal', done: pages >= (state.settings.readingDailyPages || 20) });
  }
  const logged = state.workouts.some((w) => w.date === k && w.completed);
  const firstWorkout = state.workouts.reduce((m, w) => (w.date < m ? w.date : m), today);
  const planned = k >= firstWorkout && (state.settings.workoutDays || []).includes(weekday(k));
  if (planned || logged) items.push({ kind: 'workout', label: 'Workout', done: logged });
  const doneCount = items.filter((i) => i.done).length;
  return { items, done: doneCount, total: items.length, rate: items.length ? doneCount / items.length : 0 };
}

export function dayRate(state, k) {
  return dayItems(state, k).rate;
}

export { eachDay, startOfMonth, endOfMonth };
