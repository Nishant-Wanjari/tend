import { addDays, todayKey, weekday, diffDays, monthOf, addMonths, startOfMonth, endOfMonth } from './date.js';
import { uid } from './format.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_SETTINGS = {
  name: 'Sushant',
  theme: 'system',
  readingDailyPages: 25,
  readingYearGoal: 12,
  monthlyBudget: 45000,
  openingBalance: 82000,
  workoutsPerWeek: 4,
  workoutDays: [1, 3, 5, 6],
  monthlyWorkoutTarget: 18,
  targetWeight: 72,
  dailySteps: 8000,
  reminders: { enabled: true, habits: true, reading: true, readingTime: '21:30', workout: true, workoutTime: '07:00' },
};

export function emptyState(settings = DEFAULT_SETTINGS) {
  return {
    version: 1,
    sample: false,
    updatedAt: Date.now(),
    settings: { ...settings },
    books: [], readingSessions: [], transactions: [], goals: [],
    workouts: [], weights: [], habits: [], habitLogs: {},
  };
}

export function seedState(today = todayKey()) {
  const r = rng(20261028);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => Math.round(a + r() * (b - a));
  const s = emptyState();
  s.sample = true;

  /* Books + reading sessions */
  const books = [
    { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', totalPages: 562, status: 'reading', start: -38, cover: '#2B4A6F' },
    { title: 'The Psychology of Money', author: 'Morgan Housel', totalPages: 252, status: 'reading', start: -16, cover: '#B5651D' },
    { title: 'Atomic Habits', author: 'James Clear', totalPages: 320, status: 'completed', start: -265, end: -236, rating: 5, cover: '#C9A227', notes: 'Identity-based habits. Make it obvious, attractive, easy, satisfying.' },
    { title: 'Deep Work', author: 'Cal Newport', totalPages: 296, status: 'completed', start: -228, end: -196, rating: 4, cover: '#1F3A34' },
    { title: 'Ikigai', author: 'Héctor García & Francesc Miralles', totalPages: 208, status: 'completed', start: -180, end: -160, rating: 4, cover: '#A63D40' },
    { title: 'The Pragmatic Programmer', author: 'Andrew Hunt & David Thomas', totalPages: 352, status: 'completed', start: -150, end: -101, rating: 5, cover: '#3C3C3C', notes: 'Tracer bullets, DRY, broken windows.' },
    { title: "Man's Search for Meaning", author: 'Viktor E. Frankl', totalPages: 184, status: 'completed', start: -92, end: -70, rating: 5, cover: '#6B705C' },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', totalPages: 499, status: 'completed', start: -68, end: -40, rating: 4, cover: '#E8E2D0' },
    { title: 'Sapiens', author: 'Yuval Noah Harari', totalPages: 443, status: 'paused', start: -300, end: -270, cover: '#8C6A4A', pausedAt: 140 },
    { title: 'The Almanack of Naval Ravikant', author: 'Eric Jorgenson', totalPages: 242, status: 'want', cover: '#22313F' },
    { title: 'Project Hail Mary', author: 'Andy Weir', totalPages: 476, status: 'want', cover: '#0F4C5C' },
  ];
  for (const b of books) {
    const id = uid();
    const book = {
      id, title: b.title, author: b.author, totalPages: b.totalPages, currentPage: 0,
      status: b.status, rating: b.rating || 0, notes: b.notes || '', cover: b.cover,
      addedAt: addDays(today, (b.start ?? -10) - 3), startedAt: null, finishedAt: null, lastReadAt: null,
    };
    if (b.start != null) {
      const startK = addDays(today, b.start);
      const endK = b.end != null ? addDays(today, b.end) : today;
      const days = diffDays(endK, startK) + 1;
      const goalPages = b.status === 'completed' ? b.totalPages : b.status === 'paused' ? b.pausedAt : Math.round(b.totalPages * (b.title.startsWith('Designing') ? 0.41 : 0.62));
      // spread pages over the window; recent days are kept unbroken so the sample streak is real
      const active = [];
      for (let i = 0; i < days; i++) {
        const k = addDays(startK, i);
        const recent = diffDays(today, k) <= 18;
        if (recent || r() > 0.2) active.push(k);
      }
      let left = goalPages;
      active.forEach((k, i) => {
        const remainingDays = active.length - i;
        let pages = i === active.length - 1 ? left : Math.max(4, Math.round((left / remainingDays) * (0.6 + r() * 0.8)));
        pages = Math.min(pages, left);
        if (k === today) pages = Math.min(pages, 9);
        if (pages <= 0) return;
        left -= pages;
        s.readingSessions.push({ id: uid(), bookId: id, date: k, pages, minutes: Math.round(pages * (1.5 + r() * 0.9)) });
      });
      book.currentPage = goalPages - left;
      book.startedAt = startK;
      book.lastReadAt = active[active.length - 1] || startK;
      if (b.status === 'completed') { book.currentPage = b.totalPages; book.finishedAt = endK; }
    }
    s.books.push(book);
  }

  /* Transactions — six months of a salaried month in Nagpur */
  const firstMonth = addMonths(today, -5);
  for (let mi = 0; mi < 6; mi++) {
    const mStart = addMonths(firstMonth, mi);
    const mEnd = endOfMonth(mStart);
    const last = mEnd > today ? today : mEnd;
    const add = (dayOffset, type, category, amount, note) => {
      const k = addDays(mStart, dayOffset);
      if (k > last) return;
      s.transactions.push({ id: uid(), type, category, amount, note, date: k });
    };
    add(0, 'income', 'Salary', 118500, 'Salary — monthly');
    if (mi % 2 === 1) add(between(12, 20), 'income', 'Freelance', between(8, 18) * 1000, 'Freelance dashboard work');
    add(4, 'expense', 'Rent', 16000, 'House rent');
    add(6, 'expense', 'Bills', between(1400, 2600), 'Electricity — MSEDCL');
    add(7, 'expense', 'Bills', 799, 'Broadband');
    add(9, 'expense', 'Bills', 599, 'Mobile recharge');
    add(9, 'expense', 'Investment', 15000, 'Index fund SIP');
    add(14, 'expense', 'Investment', 5000, 'NPS contribution');
    add(between(2, 26), 'expense', 'Health', between(400, 2200), pick(['Pharmacy', 'Doctor visit', 'Lab test']));
    add(between(3, 25), 'expense', 'Education', pick([499, 1299, 3499]), pick(['Online course', 'Books', 'Udemy course']));
    for (let w = 0; w < 5; w++) {
      add(w * 7 + between(0, 2), 'expense', 'Food', between(1800, 3200), 'Groceries — D-Mart');
      add(w * 7 + between(0, 6), 'expense', 'Transport', between(900, 1600), 'Petrol');
      add(w * 7 + between(0, 6), 'expense', 'Food', between(250, 780), pick(['Swiggy', 'Zomato', 'Lunch out', 'Haldiram\'s']));
      if (r() > 0.4) add(w * 7 + between(0, 6), 'expense', 'Entertainment', between(300, 1400), pick(['Movie — PVR', 'Netflix', 'Weekend outing', 'Concert ticket']));
      if (r() > 0.5) add(w * 7 + between(0, 6), 'expense', 'Shopping', between(600, 4500), pick(['Clothes', 'Amazon order', 'Home supplies', 'Shoes']));
      if (r() > 0.5) add(w * 7 + between(0, 6), 'expense', 'Transport', between(120, 380), pick(['Uber', 'Rapido', 'Auto']));
    }
  }
  s.transactions.push({ id: uid(), type: 'expense', category: 'Food', amount: 180, note: 'Filter coffee & poha', date: today });
  s.transactions.push({ id: uid(), type: 'expense', category: 'Transport', amount: 140, note: 'Rapido to office', date: today });
  s.transactions.sort((a, b) => b.date.localeCompare(a.date));

  s.goals = [
    { id: uid(), name: 'Emergency Fund', target: 300000, saved: 186000, deadline: '2027-03-31' },
    { id: uid(), name: 'New Laptop', target: 120000, saved: 64000, deadline: '2027-01-15' },
    { id: uid(), name: 'Travel — Coorg in December', target: 60000, saved: 22500, deadline: '2026-12-15' },
    { id: uid(), name: 'Investment Target', target: 500000, saved: 212000, deadline: '2027-12-31' },
  ];

  /* Workouts + weight */
  const plan = { 1: 'Push', 3: 'Pull', 5: 'Legs', 6: 'Cardio' };
  const lifts = {
    Push: [['Bench Press', 50], ['Overhead Press', 30], ['Incline Dumbbell Press', 18], ['Tricep Pushdown', 22]],
    Pull: [['Deadlift', 80], ['Lat Pulldown', 45], ['Barbell Row', 45], ['Bicep Curl', 12]],
    Legs: [['Back Squat', 65], ['Romanian Deadlift', 55], ['Leg Press', 110], ['Calf Raise', 40]],
  };
  for (let d = 112; d >= 1; d--) {
    const k = addDays(today, -d);
    const dow = weekday(k);
    const type = plan[dow];
    const skip = d > 21 && r() < 0.1;
    const extra = !type && r() < 0.06;
    if ((!type && !extra) || skip) continue;
    const t = type || 'Full Body';
    const progress = (112 - d) / 112; // 0 → 1 over the period
    const w = { id: uid(), date: k, type: t, name: `${t} day`, duration: between(45, 75), calories: 0, completed: true, notes: '', exercises: [] };
    if (t === 'Cardio') {
      w.name = pick(['Morning run', 'Futala lake run', 'Cycling', 'Treadmill intervals']);
      w.duration = between(30, 50);
      w.calories = between(280, 460);
      w.exercises = [{ id: uid(), name: w.name.includes('Cycl') ? 'Cycling' : 'Running', sets: [{ reps: 1, weight: 0 }] }];
    } else {
      const set = lifts[t] || [['Push-up', 0], ['Pull-up', 0], ['Goblet Squat', 20]];
      w.exercises = set.map(([name, base]) => {
        const top = Math.round((base * (1 + progress * 0.22)) / 2.5) * 2.5;
        return { id: uid(), name, sets: [0, 1, 2].map((i) => ({ reps: [10, 8, 6][i], weight: Math.max(0, top - (2 - i) * 2.5) })) };
      });
      if (r() > 0.6) w.calories = between(220, 380);
    }
    s.workouts.push(w);
  }
  s.workouts.sort((a, b) => b.date.localeCompare(a.date));
  for (let wk = 16; wk >= 0; wk--) {
    const k = addDays(today, -wk * 7 - 1);
    const kg = Math.round((78.6 - (16 - wk) * 0.21 + (r() - 0.5) * 0.6) * 10) / 10;
    s.weights.push({ id: uid(), date: k, kg });
  }

  /* Habits */
  const habitDefs = [
    { name: 'Drink water', icon: 'droplet', color: 3, category: 'Health', type: 'numeric', target: 3, unit: 'L', step: 0.5, freq: { kind: 'daily' }, reminder: '11:00', p: 0.86, todayVal: 1.5 },
    { name: 'Meditate', icon: 'leaf', color: 1, category: 'Mind', type: 'duration', target: 10, unit: 'min', step: 5, freq: { kind: 'daily' }, reminder: '07:30', p: 0.8, todayVal: 10 },
    { name: 'Sleep 8 hours', icon: 'moon', color: 5, category: 'Health', type: 'numeric', target: 8, unit: 'hours', step: 0.5, freq: { kind: 'daily' }, p: 0.62, todayVal: 8 },
    { name: 'Study data engineering', icon: 'graduation', color: 2, category: 'Learning', type: 'duration', target: 120, unit: 'min', step: 15, freq: { kind: 'days', days: [1, 3, 5] }, reminder: '20:00', p: 0.84, todayVal: 0 },
    { name: 'No social media', icon: 'phoneoff', color: 4, category: 'Mind', type: 'boolean', target: 1, unit: '', step: 1, freq: { kind: 'daily' }, p: 0.7, todayVal: 0 },
    { name: 'Walk 10,000 steps', icon: 'footprints', color: 1, category: 'Fitness', type: 'numeric', target: 10000, unit: 'steps', step: 1000, freq: { kind: 'daily' }, p: 0.66, todayVal: 4200 },
    { name: 'Cook at home', icon: 'chef', color: 6, category: 'Health', type: 'boolean', target: 1, unit: '', step: 1, freq: { kind: 'weekly', times: 3 }, p: 0.48, todayVal: 0 },
  ];
  for (const d of habitDefs) {
    const h = {
      id: uid(), name: d.name, icon: d.icon, color: d.color, category: d.category, type: d.type,
      target: d.target, unit: d.unit, step: d.step, freq: d.freq, startDate: addDays(today, -150),
      reminder: d.reminder || '', archived: false,
    };
    const logs = {};
    for (let i = 150; i >= 1; i--) {
      const k = addDays(today, -i);
      if (d.freq.kind === 'days' && !d.freq.days.includes(weekday(k))) continue;
      const recent = i <= 9 && d.p > 0.75; // keeps a believable live streak on the strong habits
      const weeklyPick = d.freq.kind === 'weekly' && i <= 30 ? [0, 2, 4].includes(weekday(k)) : null;
      if (weeklyPick === false) continue;
      if (recent || weeklyPick || r() < d.p) {
        logs[k] = d.type === 'boolean' ? 1 : d.target * (1 + Math.round(r() * 2) / 10);
        if (d.unit === 'steps') logs[k] = Math.round(logs[k] / 100) * 100;
      } else if (d.type !== 'boolean' && r() > 0.4) {
        logs[k] = Math.round(d.target * (0.3 + r() * 0.5) * 10) / 10;
      }
    }
    if (d.todayVal) logs[today] = d.todayVal;
    s.habits.push(h);
    s.habitLogs[h.id] = logs;
  }
  return s;
}

export { monthOf, startOfMonth };
