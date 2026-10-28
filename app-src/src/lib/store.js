import { useCallback, useEffect, useRef, useState } from 'react';
import { seedState, emptyState, DEFAULT_SETTINGS } from './seed.js';
import { uid } from './format.js';
import { todayKey } from './date.js';

const KEY = 'tend.state.v1';
const CLOUD_LIMIT = 240 * 1024;

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeLocal(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function normalize(raw) {
  const base = emptyState();
  const s = { ...base, ...raw };
  s.settings = { ...DEFAULT_SETTINGS, ...(raw?.settings || {}) };
  s.settings.reminders = { ...DEFAULT_SETTINGS.reminders, ...(raw?.settings?.reminders || {}) };
  for (const k of ['books', 'readingSessions', 'transactions', 'goals', 'workouts', 'weights', 'habits']) {
    if (!Array.isArray(s[k])) s[k] = [];
  }
  if (!s.habitLogs || typeof s.habitLogs !== 'object') s.habitLogs = {};
  return s;
}

export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'That file is not a Tend backup.';
  const data = obj.app === 'tend' ? obj.data : obj;
  if (!data || !Array.isArray(data.habits) || !Array.isArray(data.transactions) || !data.settings) {
    return 'That file is not a Tend backup. Choose a file made with "Download backup".';
  }
  return null;
}

/**
 * App state lives in localStorage on this device. When the page runs inside
 * Claude and the viewer is signed in, the same state is mirrored to the
 * viewer's private store so it follows them to other devices.
 */
export function useAppState() {
  const [state, setState] = useState(() => {
    const local = readLocal();
    return local ? normalize(local) : { ...seedState(todayKey()), updatedAt: 0 };
  });
  const [sync, setSync] = useState({ status: 'local', detail: 'Saved on this device' });
  const cloud = useRef({ ref: null, busy: false, pending: false, lastPushed: 0 });
  const skipPush = useRef(false);
  const edited = useRef(false);
  const timer = useRef(null);
  const latest = useRef(state);
  latest.current = state;

  // persist locally on every change
  useEffect(() => {
    const ok = writeLocal(state);
    if (!ok && sync.status === 'local') setSync({ status: 'local', detail: 'This browser is not keeping data. Download a backup to be safe.' });
  }, [state]);

  const push = useCallback(async () => {
    const c = cloud.current;
    if (!c.ref) return;
    if (c.busy) { c.pending = true; return; }
    const s = latest.current;
    const json = JSON.stringify(s);
    if (json.length > CLOUD_LIMIT) {
      setSync({ status: 'local', detail: 'Too much data to sync; saved on this device' });
      return;
    }
    c.busy = true;
    setSync({ status: 'syncing', detail: 'Syncing…' });
    try {
      await c.ref.set({ json, updatedAt: s.updatedAt });
      c.lastPushed = s.updatedAt;
      setSync({ status: 'synced', detail: 'Synced to your Claude account' });
    } catch (e) {
      setSync({ status: 'local', detail: 'Sync paused; saved on this device' });
    } finally {
      c.busy = false;
      if (c.pending) { c.pending = false; push(); }
    }
  }, []);

  // connect to the viewer's private store when available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return;
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user || cancelled) return;
        const id = await user.id();
        if (!id || cancelled) return;
        const ref = db.doc(`data/users/${id}/tend`);
        const snap = await ref.get();
        if (cancelled) return;
        cloud.current.ref = ref;
        const remote = snap.exists ? snap.data() : null;
        if (remote?.json && remote.updatedAt > (latest.current.updatedAt || 0) && !edited.current) {
          try {
            skipPush.current = true;
            setState(normalize(JSON.parse(remote.json)));
            setSync({ status: 'synced', detail: 'Synced to your Claude account' });
            return;
          } catch { /* fall through and push local */ }
        }
        if (remote?.json && remote.updatedAt === latest.current.updatedAt) {
          setSync({ status: 'synced', detail: 'Synced to your Claude account' });
          return;
        }
        push();
      } catch {
        /* stays local */
      }
    })();
    return () => { cancelled = true; };
  }, [push]);

  // debounce cloud writes
  useEffect(() => {
    if (skipPush.current) { skipPush.current = false; return; }
    if (!cloud.current.ref) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(push, 1500);
    return () => clearTimeout(timer.current);
  }, [state, push]);

  const update = useCallback((fn) => {
    setState((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      edited.current = true;
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  const getState = useCallback(() => latest.current, []);
  return [state, update, sync, getState];
}

/* ───────────────────────── Actions ───────────────────────── */

const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i < 0) return [item, ...arr];
  const next = arr.slice();
  next[i] = item;
  return next;
};
const without = (arr, id) => arr.filter((x) => x.id !== id);

export function makeActions(update, getState) {
  return {
    settings: (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

    // books
    saveBook: (b) => update((s) => ({ ...s, books: upsert(s.books, { id: b.id || uid(), addedAt: todayKey(), ...b }) })),
    setShelf: (shelf) => update((s) => ({ ...s, bookshelf: shelf })),
    setCover: (id, patch) => update((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    deleteBook: (id) => update((s) => ({ ...s, books: without(s.books, id), readingSessions: s.readingSessions.filter((x) => x.bookId !== id) })),
    // log a reading session; moves the bookmark forward and finishes the book when it reaches the end
    logReading: ({ bookId, date, pages, minutes }) => {
      const cur = getState().books.find((b) => b.id === bookId);
      const finished = !!cur && cur.status !== 'completed' && (cur.currentPage || 0) + pages >= cur.totalPages;
      update((s) => {
        const books = s.books.map((b) => {
          if (b.id !== bookId) return b;
          const currentPage = Math.min(b.totalPages, (b.currentPage || 0) + pages);
          const done = currentPage >= b.totalPages;
          return {
            ...b, currentPage,
            status: done ? 'completed' : b.status === 'want' || b.status === 'paused' ? 'reading' : b.status,
            startedAt: b.startedAt || date,
            finishedAt: done ? b.finishedAt || date : b.finishedAt,
            lastReadAt: !b.lastReadAt || date > b.lastReadAt ? date : b.lastReadAt,
          };
        });
        return { ...s, books, readingSessions: [{ id: uid(), bookId, date, pages, minutes }, ...s.readingSessions] };
      });
      return finished;
    },
    deleteSession: (id) => update((s) => {
      const sess = s.readingSessions.find((x) => x.id === id);
      if (!sess) return s;
      const books = s.books.map((b) => (b.id === sess.bookId ? { ...b, currentPage: Math.max(0, (b.currentPage || 0) - sess.pages) } : b));
      return { ...s, books, readingSessions: without(s.readingSessions, id) };
    }),

    // finance
    saveTx: (t) => update((s) => ({ ...s, transactions: upsert(s.transactions, { id: t.id || uid(), ...t }).sort((a, b) => b.date.localeCompare(a.date)) })),
    deleteTx: (id) => update((s) => ({ ...s, transactions: without(s.transactions, id) })),
    saveGoal: (g) => update((s) => ({ ...s, goals: upsert(s.goals, { id: g.id || uid(), ...g }) })),
    deleteGoal: (id) => update((s) => ({ ...s, goals: without(s.goals, id) })),
    contribute: (id, amount) => update((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)) })),

    // gym
    saveWorkout: (w) => update((s) => ({ ...s, workouts: upsert(s.workouts, { id: w.id || uid(), ...w }).sort((a, b) => b.date.localeCompare(a.date)) })),
    deleteWorkout: (id) => update((s) => ({ ...s, workouts: without(s.workouts, id) })),
    logWeight: (date, kg) => update((s) => {
      const others = s.weights.filter((w) => w.date !== date);
      return { ...s, weights: [...others, { id: uid(), date, kg }].sort((a, b) => a.date.localeCompare(b.date)) };
    }),
    deleteWeight: (id) => update((s) => ({ ...s, weights: without(s.weights, id) })),

    // habits
    saveHabit: (h) => update((s) => ({ ...s, habits: s.habits.some((x) => x.id === h.id) ? s.habits.map((x) => (x.id === h.id ? h : x)) : [...s.habits, { ...h, id: h.id || uid() }] })),
    deleteHabit: (id) => update((s) => {
      const habitLogs = { ...s.habitLogs };
      delete habitLogs[id];
      return { ...s, habits: without(s.habits, id), habitLogs };
    }),
    setHabitValue: (id, date, value) => update((s) => {
      const logs = { ...(s.habitLogs[id] || {}) };
      if (!value) delete logs[date];
      else logs[date] = value;
      return { ...s, habitLogs: { ...s.habitLogs, [id]: logs } };
    }),

    // data
    reset: () => update(() => ({ ...seedState(todayKey()) })),
    clearAll: () => update((s) => ({ ...emptyState({ ...s.settings }) })),
    dismissSample: () => update((s) => ({ ...s, sample: false })),
    restore: (data) => update(() => normalize(data)),
  };
}
