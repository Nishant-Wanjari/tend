import React, { useMemo, useRef, useState } from 'react';
import { LuStar, LuPlus, LuMinus, LuX, LuCopy, LuBookOpen, LuImagePlus, LuTrash2, LuArrowDownLeft, LuReceipt, LuSearch } from 'react-icons/lu';
import { saveCover, searchBooks, coverFromResult } from './lib/covers.js';
import { CAT_ICONS, tint } from './ui.jsx';
import { useApp } from './ctx.js';
import {
  Sheet, Button, Field, Segmented, Chips, Toggle, ConfirmDelete, BookCover, HABIT_ICONS, CATEGORIES, col, cx, Empty,
} from './ui.jsx';
import { todayKey, fmtShort, DOW, DOW_MON } from './lib/date.js';
import { inr } from './lib/format.js';

export const INCOME_CATS = ['Salary', 'Freelance', 'Interest', 'Refund', 'Other'];
export const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Upper Body', 'Lower Body', 'Cardio', 'Full Body', 'Custom'];
export const EXERCISES = {
  Push: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Dips', 'Lateral Raise', 'Tricep Pushdown'],
  Pull: ['Deadlift', 'Pull-up', 'Lat Pulldown', 'Barbell Row', 'Face Pull', 'Bicep Curl'],
  Legs: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Leg Curl', 'Calf Raise'],
  'Upper Body': ['Bench Press', 'Barbell Row', 'Overhead Press', 'Pull-up', 'Bicep Curl'],
  'Lower Body': ['Back Squat', 'Deadlift', 'Hip Thrust', 'Leg Press', 'Calf Raise'],
  Cardio: ['Running', 'Cycling', 'Rowing', 'Skipping', 'Stair Climber'],
  'Full Body': ['Deadlift', 'Goblet Squat', 'Push-up', 'Kettlebell Swing', 'Plank'],
  Custom: ['Plank', 'Push-up', 'Yoga', 'Swimming'],
};
const COVERS = ['#174D3A', '#2B4A6F', '#B5651D', '#A63D40', '#C9A227', '#6B705C', '#3C3C3C', '#E8E2D0', '#0F4C5C', '#8C6A4A'];
const HABIT_CATS = ['Health', 'Mind', 'Learning', 'Fitness', 'Productivity', 'Other'];
const HABIT_TEMPLATES = [
  { name: 'Drink 3L of water', icon: 'droplet', color: 3, category: 'Health', type: 'numeric', target: 3, unit: 'L', step: 0.5 },
  { name: 'Meditate', icon: 'leaf', color: 1, category: 'Mind', type: 'duration', target: 10, unit: 'min', step: 5 },
  { name: 'Sleep 8 hours', icon: 'moon', color: 5, category: 'Health', type: 'numeric', target: 8, unit: 'hours', step: 0.5 },
  { name: 'Study', icon: 'graduation', color: 2, category: 'Learning', type: 'duration', target: 120, unit: 'min', step: 15 },
  { name: 'No social media', icon: 'phoneoff', color: 4, category: 'Mind', type: 'boolean', target: 1, unit: '', step: 1 },
  { name: 'Walk 10,000 steps', icon: 'footprints', color: 1, category: 'Fitness', type: 'numeric', target: 10000, unit: 'steps', step: 1000 },
];

const n = (v) => (v === '' || v == null ? NaN : Number(v));

function Footer({ onCancel, onSave, saveLabel = 'Save', left }) {
  return (
    <>
      {left}
      <div className="flex-1" />
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={onSave}>{saveLabel}</Button>
    </>
  );
}

/* ───────────── Reading ───────────── */

export function ReadingLogSheet({ open, onClose, bookId, date: initialDate }) {
  const { state, actions, toast, nav, openSheet } = useApp();
  const candidates = state.books.filter((b) => b.status !== 'completed');
  const reading = candidates.filter((b) => b.status === 'reading').sort((a, b) => (b.lastReadAt || '').localeCompare(a.lastReadAt || ''));
  const [book, setBook] = useState(bookId || reading[0]?.id || candidates[0]?.id || '');
  const [mode, setMode] = useState('pages');
  const [pages, setPages] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(initialDate || todayKey());
  const [err, setErr] = useState({});
  const b = state.books.find((x) => x.id === book);
  const delta = b ? (mode === 'pages' ? n(pages) : n(pages) - (b.currentPage || 0)) : NaN;

  const save = () => {
    const e = {};
    if (!b) e.book = 'Choose a book.';
    if (!(delta > 0)) e.pages = mode === 'pages' ? 'Enter the pages you read.' : `Enter a page after ${b?.currentPage || 0}.`;
    else if (b && (b.currentPage || 0) + delta > b.totalPages) e.pages = `This book has ${b.totalPages} pages; you're on ${b.currentPage}.`;
    if (minutes !== '' && !(n(minutes) >= 0)) e.minutes = 'Minutes must be a number.';
    if (date > todayKey()) e.date = 'Pick today or an earlier day.';
    setErr(e);
    if (Object.keys(e).length) return;
    const mins = minutes === '' ? Math.round(delta * 1.8) : n(minutes);
    const finished = actions.logReading({ bookId: b.id, date, pages: delta, minutes: mins });
    toast(finished ? `You finished ${b.title}. Add a rating?` : `Logged ${delta} pages of ${b.title}`, finished ? { action: { label: 'Rate', run: () => nav('book', { id: b.id }) } } : {});
    onClose();
  };

  if (!candidates.length) {
    return (
      <Sheet open={open} onClose={onClose} title="Log reading">
        <Empty icon={LuBookOpen} title="No book in progress" body="Add the book you're reading, then log pages against it."
          action={<Button onClick={() => { onClose(); openSheet({ type: 'book' }); }}>Add a book</Button>} />
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title="Log reading" footer={<Footer onCancel={onClose} onSave={save} saveLabel="Log session" />}>
      <div className="flex flex-col gap-4">
        <Field label="Book" htmlFor="rl-book" error={err.book}>
          <div className="flex gap-2 scroll-x -mx-1 px-1 pb-1" role="radiogroup" aria-label="Book">
            {candidates.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={book === x.id} onClick={() => setBook(x.id)}
                className={cx('flex flex-col items-start gap-1.5 p-2 rounded-2xl border transition w-[96px] shrink-0 text-left', book === x.id ? 'border-brand bg-brandsoft' : 'hairline')}>
                <BookCover book={x} w={44} />
                <span className="text-[12px] leading-tight line-clamp-2">{x.title}</span>
              </button>
            ))}
          </div>
        </Field>
        <Segmented value={mode} onChange={(v) => { setMode(v); setPages(''); }} label="Entry mode"
          options={[{ value: 'pages', label: 'Pages read' }, { value: 'page', label: "I'm now on page" }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === 'pages' ? 'Pages' : 'Page number'} htmlFor="rl-pages" error={err.pages}
            hint={b ? `On page ${b.currentPage} of ${b.totalPages}` : ''}>
            <input id="rl-pages" className="field num" inputMode="numeric" type="number" min="1" value={pages} onChange={(e) => setPages(e.target.value)} aria-invalid={!!err.pages} placeholder={mode === 'pages' ? '25' : String((b?.currentPage || 0) + 20)} />
          </Field>
          <Field label="Minutes" htmlFor="rl-min" error={err.minutes} hint="Optional">
            <input id="rl-min" className="field num" inputMode="numeric" type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={delta > 0 ? String(Math.round(delta * 1.8)) : '30'} />
          </Field>
        </div>
        <Field label="Date" htmlFor="rl-date" error={err.date}>
          <input id="rl-date" className="field" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

export function BookSheet({ open, onClose, book }) {
  const { actions, toast, back } = useApp();
  const editing = !!book;
  const [f, setF] = useState(() => book ? { ...book } : { title: '', author: '', totalPages: '', currentPage: 0, status: 'reading', cover: COVERS[Math.floor(Math.random() * COVERS.length)], rating: 0, notes: '' });
  const [err, setErr] = useState({});
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState({ open: !book, busy: false, results: null, error: '' });
  const fileRef = useRef(null);
  const runSearch = async () => {
    if (!f.title.trim()) { setErr((x) => ({ ...x, title: 'Type a title to search for.' })); return; }
    setSearch({ open: true, busy: true, results: null, error: '' });
    try {
      const results = await searchBooks(f.title, f.author);
      setSearch({ open: true, busy: false, results, error: results.length ? '' : 'No covers found. Try a shorter title or add the author.' });
    } catch (e) {
      setSearch({ open: true, busy: false, results: null, error: e.message });
    }
  };
  const choose = async (r) => {
    setUploading(true);
    try {
      const c = await coverFromResult(r);
      setF((x) => ({
        ...x, ...c,
        title: x.title.trim() ? x.title : r.title,
        author: x.author.trim() ? x.author : r.author,
        totalPages: x.totalPages ? x.totalPages : r.pages || '',
      }));
      setSearch((s) => ({ ...s, open: false }));
      setErr((x) => ({ ...x, cover: undefined }));
    } catch (e) {
      setErr((x) => ({ ...x, cover: e.message === 'timeout' ? 'That cover took too long to download. Pick another.' : "Couldn't download that cover. Pick another." }));
    } finally { setUploading(false); }
  };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const pickCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const c = await saveCover(file);
      setF((x) => ({ ...x, ...c }));
      setErr((x) => ({ ...x, cover: undefined }));
    } catch (er) {
      setErr((x) => ({ ...x, cover: er.message }));
    } finally { setUploading(false); }
  };
  const save = () => {
    const e = {};
    if (uploading) e.cover = 'Wait for the cover to finish uploading.';
    if (!f.title.trim()) e.title = 'Give the book a title.';
    const tp = n(f.totalPages);
    const cp = n(f.currentPage || 0);
    if (!(tp > 0)) e.totalPages = 'Enter the number of pages.';
    if (!(cp >= 0)) e.currentPage = 'Enter a page number.';
    else if (tp > 0 && cp > tp) e.currentPage = `Can't be past page ${tp}.`;
    setErr(e);
    if (Object.keys(e).length) return;
    const today = todayKey();
    const status = cp >= tp ? 'completed' : f.status;
    actions.saveBook({
      ...f, title: f.title.trim(), author: f.author.trim(), totalPages: tp,
      currentPage: status === 'completed' ? tp : cp, status,
      startedAt: f.startedAt || (status !== 'want' ? today : null),
      finishedAt: status === 'completed' ? f.finishedAt || today : null,
    });
    toast(editing ? 'Book updated' : `Added ${f.title.trim()}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit book' : 'Add a book'}
      footer={<Footer onCancel={onClose} onSave={save} left={editing && <ConfirmDelete onConfirm={() => { actions.deleteBook(book.id); toast('Book deleted'); onClose(); back(); }} />} />}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 items-start">
          <BookCover book={{ ...f, title: f.title || 'Title', author: f.author }} w={72} />
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <Field label="Title" htmlFor="bk-title" error={err.title}>
              <input id="bk-title" className="field" value={f.title} onChange={set('title')} aria-invalid={!!err.title} placeholder="The Psychology of Money" />
            </Field>
            <Field label="Author" htmlFor="bk-author">
              <input id="bk-author" className="field" value={f.author} onChange={set('author')} placeholder="Morgan Housel" />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total pages" htmlFor="bk-total" error={err.totalPages}>
            <input id="bk-total" className="field num" type="number" inputMode="numeric" min="1" value={f.totalPages} onChange={set('totalPages')} aria-invalid={!!err.totalPages} />
          </Field>
          <Field label="Current page" htmlFor="bk-cur" error={err.currentPage}>
            <input id="bk-cur" className="field num" type="number" inputMode="numeric" min="0" value={f.currentPage} onChange={set('currentPage')} aria-invalid={!!err.currentPage} />
          </Field>
        </div>
        <Field label="Shelf">
          <Chips value={f.status} onChange={set('status')} options={[
            { value: 'reading', label: 'Reading' }, { value: 'want', label: 'Want to read' },
            { value: 'paused', label: 'Paused' }, { value: 'completed', label: 'Completed' }]} />
        </Field>
        <Field label="Cover" error={err.cover} hint={f.coverId || f.coverData ? 'Shown in your library, calendar and share cards' : 'Find the real cover online, or upload a photo. The colour below is used until you add one.'}>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" icon={LuSearch} disabled={uploading || search.busy} onClick={runSearch}>{search.busy ? 'Searching…' : 'Find cover'}</Button>
            <Button size="sm" variant="secondary" icon={LuImagePlus} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : f.coverId || f.coverData ? 'Replace photo' : 'Upload cover'}</Button>
            {(f.coverId || f.coverData) && <Button size="sm" variant="ghost" icon={LuTrash2} onClick={() => setF((x) => ({ ...x, coverId: null, coverData: null }))}>Remove photo</Button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Cover image file" onChange={pickCover} />
          </div>
          {search.open && (search.error || search.results) && (
            <div className="mt-2 rounded-2xl bg-surface2 p-3">
              {search.error ? <p className="text-[13px] text-muted">{search.error}</p> : (
                <>
                  <div className="text-[12px] text-muted mb-2">Tap the right edition. Title, author and pages fill in if they're blank.</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {search.results.map((r) => (
                      <button key={r.thumb} type="button" onClick={() => choose(r)} disabled={uploading}
                        className="flex flex-col gap-1 text-left rounded-xl p-1 hover:bg-surface disabled:opacity-50 min-w-0">
                        <span className="w-full aspect-[2/3] rounded-md overflow-hidden bg-line block shadow-sm">
                          <img src={r.thumb} alt={`Cover of ${r.title}`} loading="lazy" className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.parentElement.parentElement.style.display = 'none'; }} />
                        </span>
                        <span className="text-[11px] leading-tight line-clamp-2">{r.title}</span>
                        <span className="text-[10px] text-muted truncate">{[r.author, r.year].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-faint mt-2">Covers from Open Library and Google Books</div>
                </>
              )}
            </div>
          )}
        </Field>
        <Field label="Cover colour">
          <div className="flex flex-wrap gap-2">
            {COVERS.map((c) => (
              <button key={c} type="button" aria-label={`Cover ${c}`} aria-pressed={f.cover === c} onClick={() => set('cover')(c)}
                className={cx('w-8 h-8 rounded-lg border-2 transition', f.cover === c ? 'border-ink scale-110' : 'border-transparent')} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <Field label="Rating">
          <Stars value={f.rating} onChange={set('rating')} />
        </Field>
        <Field label="Notes" htmlFor="bk-notes">
          <textarea id="bk-notes" className="field min-h-[88px]" value={f.notes} onChange={set('notes')} placeholder="Ideas worth keeping" />
        </Field>
      </div>
    </Sheet>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onClick={() => onChange?.(value === i ? 0 : i)} disabled={!onChange} className="p-0.5 disabled:cursor-default">
          <LuStar style={{ width: size, height: size }} className={i <= value ? 'text-c2' : 'text-line'} fill={i <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

/* ───────────── Finance ───────────── */

export function TxSheet({ open, onClose, tx, type: initialType = 'expense', date: initialDate }) {
  const { actions, toast } = useApp();
  const editing = !!tx;
  const [f, setF] = useState(() => tx ? { ...tx, amount: String(tx.amount) } : { type: initialType, amount: '', category: initialType === 'income' ? 'Salary' : 'Food', note: '', date: initialDate || todayKey() });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const save = () => {
    const e = {};
    const amt = n(String(f.amount).replace(/,/g, ''));
    if (!(amt > 0)) e.amount = 'Enter an amount above ₹0.';
    if (!f.date) e.date = 'Pick a date.';
    setErr(e);
    if (Object.keys(e).length) return;
    actions.saveTx({ ...f, amount: Math.round(amt * 100) / 100, note: f.note.trim() });
    toast(editing ? 'Transaction updated' : `${f.type === 'income' ? 'Income' : 'Expense'} of ${inr(amt)} added`);
    onClose();
  };
  const cats = f.type === 'income' ? INCOME_CATS : CATEGORIES;
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit transaction' : 'Add transaction'}
      footer={<Footer onCancel={onClose} onSave={save} left={editing && <ConfirmDelete onConfirm={() => { actions.deleteTx(tx.id); toast('Transaction deleted'); onClose(); }} />} />}>
      <div className="flex flex-col gap-4">
        <Segmented value={f.type} label="Type" onChange={(v) => setF((x) => ({ ...x, type: v, category: v === 'income' ? 'Salary' : 'Food' }))}
          options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <Field label="Amount" htmlFor="tx-amt" error={err.amount}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[20px]">₹</span>
            <input id="tx-amt" className="field num !text-[24px] !pl-8 font-semibold" inputMode="decimal" value={f.amount} onChange={set('amount')} aria-invalid={!!err.amount} placeholder="0" />
          </div>
        </Field>
        <Field label="Category"><Chips value={f.category} onChange={set('category')} options={cats} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Note" htmlFor="tx-note"><input id="tx-note" className="field" value={f.note} onChange={set('note')} placeholder={f.type === 'income' ? 'Salary' : 'Lunch'} /></Field>
          <Field label="Date" htmlFor="tx-date" error={err.date}><input id="tx-date" className="field" type="date" value={f.date} onChange={set('date')} /></Field>
        </div>
      </div>
    </Sheet>
  );
}

export function GoalSheet({ open, onClose, goal }) {
  const { actions, toast } = useApp();
  const editing = !!goal;
  const [f, setF] = useState(() => goal ? { ...goal, target: String(goal.target), saved: String(goal.saved) } : { name: '', target: '', saved: '0', deadline: '' });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Name the goal.';
    if (!(n(f.target) > 0)) e.target = 'Enter a target amount.';
    if (!(n(f.saved) >= 0)) e.saved = 'Enter what you have saved (0 is fine).';
    setErr(e);
    if (Object.keys(e).length) return;
    actions.saveGoal({ ...f, name: f.name.trim(), target: n(f.target), saved: n(f.saved) });
    toast(editing ? 'Goal updated' : 'Goal created');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit goal' : 'New savings goal'}
      footer={<Footer onCancel={onClose} onSave={save} left={editing && <ConfirmDelete onConfirm={() => { actions.deleteGoal(goal.id); toast('Goal deleted'); onClose(); }} />} />}>
      <div className="flex flex-col gap-4">
        {!editing && <Chips value="" onChange={(v) => setF((x) => ({ ...x, name: v }))} options={['Emergency Fund', 'New Laptop', 'Travel', 'Investment Target']} />}
        <Field label="Goal" htmlFor="g-name" error={err.name}><input id="g-name" className="field" value={f.name} onChange={set('name')} aria-invalid={!!err.name} placeholder="Emergency Fund" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (₹)" htmlFor="g-target" error={err.target}><input id="g-target" className="field num" inputMode="numeric" value={f.target} onChange={set('target')} aria-invalid={!!err.target} /></Field>
          <Field label="Saved so far (₹)" htmlFor="g-saved" error={err.saved}><input id="g-saved" className="field num" inputMode="numeric" value={f.saved} onChange={set('saved')} /></Field>
        </div>
        <Field label="Deadline" htmlFor="g-dl" hint="Optional"><input id="g-dl" className="field" type="date" value={f.deadline} onChange={set('deadline')} /></Field>
      </div>
    </Sheet>
  );
}

export function ContributeSheet({ open, onClose, goal }) {
  const { actions, toast } = useApp();
  const [amt, setAmt] = useState('');
  const [dir, setDir] = useState('add');
  const [err, setErr] = useState('');
  if (!goal) return null;
  const save = () => {
    const a = n(amt.replace(/,/g, ''));
    if (!(a > 0)) return setErr('Enter an amount above ₹0.');
    if (dir === 'remove' && a > goal.saved) return setErr(`You've saved ${inr(goal.saved)} towards this goal.`);
    actions.contribute(goal.id, dir === 'add' ? a : -a);
    toast(dir === 'add' ? `Added ${inr(a)} to ${goal.name}` : `Withdrew ${inr(a)} from ${goal.name}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={goal.name} footer={<Footer onCancel={onClose} onSave={save} saveLabel={dir === 'add' ? 'Add money' : 'Withdraw'} />}>
      <div className="flex flex-col gap-4">
        <Segmented value={dir} onChange={setDir} options={[{ value: 'add', label: 'Add money' }, { value: 'remove', label: 'Withdraw' }]} />
        <Field label="Amount (₹)" htmlFor="c-amt" error={err} hint={`${inr(goal.saved)} of ${inr(goal.target)} saved`}>
          <input id="c-amt" className="field num !text-[22px]" inputMode="numeric" value={amt} onChange={(e) => { setAmt(e.target.value); setErr(''); }} placeholder="5,000" />
        </Field>
      </div>
    </Sheet>
  );
}

/* ───────────── Gym ───────────── */

export function WorkoutSheet({ open, onClose, workout, date }) {
  const { state, actions, toast } = useApp();
  const editing = !!workout?.id;
  const [f, setF] = useState(() => workout
    ? { ...workout, duration: String(workout.duration || ''), calories: workout.calories ? String(workout.calories) : '', exercises: (workout.exercises || []).map((e) => ({ ...e, sets: e.sets.map((s) => ({ reps: String(s.reps), weight: String(s.weight) })) })) }
    : { date: date || todayKey(), type: suggestType(state), name: '', duration: '', calories: '', completed: true, notes: '', exercises: [] });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const lastOfType = state.workouts.find((w) => w.type === f.type && w.id !== f.id && w.exercises?.length);
  const setEx = (i, patch) => setF((x) => ({ ...x, exercises: x.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  const addEx = (name = '') => setF((x) => ({ ...x, exercises: [...x.exercises, { id: Math.random().toString(36).slice(2), name, sets: [{ reps: '10', weight: '' }] }] }));
  const save = () => {
    const e = {};
    if (!(n(f.duration) > 0)) e.duration = 'Enter how long you trained.';
    if (f.calories !== '' && !(n(f.calories) >= 0)) e.calories = 'Calories must be a number.';
    if (f.exercises.some((x) => !x.name.trim())) e.exercises = 'Name every exercise or remove the empty ones.';
    if (f.exercises.some((x) => x.sets.some((s) => !(n(s.reps) > 0) || (s.weight !== '' && !(n(s.weight) >= 0))))) e.exercises = 'Each set needs reps above 0; weight can be blank for bodyweight.';
    setErr(e);
    if (Object.keys(e).length) return;
    actions.saveWorkout({
      ...f, name: f.name.trim() || `${f.type} day`, duration: n(f.duration), calories: f.calories === '' ? 0 : n(f.calories),
      exercises: f.exercises.map((x) => ({ ...x, name: x.name.trim(), sets: x.sets.map((s) => ({ reps: n(s.reps), weight: s.weight === '' ? 0 : n(s.weight) })) })),
    });
    toast(editing ? 'Workout updated' : f.completed ? 'Workout logged' : 'Workout planned');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit workout' : 'Record workout'} wide
      footer={<Footer onCancel={onClose} onSave={save} left={editing && <ConfirmDelete onConfirm={() => { actions.deleteWorkout(workout.id); toast('Workout deleted'); onClose(); }} />} />}>
      <div className="flex flex-col gap-4">
        <Field label="Type"><Chips value={f.type} onChange={set('type')} options={WORKOUT_TYPES} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="w-name"><input id="w-name" className="field" value={f.name} onChange={set('name')} placeholder={`${f.type} day`} /></Field>
          <Field label="Date" htmlFor="w-date"><input id="w-date" className="field" type="date" max={todayKey()} value={f.date} onChange={set('date')} /></Field>
          <Field label="Duration (min)" htmlFor="w-dur" error={err.duration}><input id="w-dur" className="field num" inputMode="numeric" type="number" min="1" value={f.duration} onChange={set('duration')} aria-invalid={!!err.duration} placeholder="60" /></Field>
          <Field label="Calories" htmlFor="w-cal" error={err.calories} hint="Only if measured"><input id="w-cal" className="field num" inputMode="numeric" type="number" min="0" value={f.calories} onChange={set('calories')} placeholder="—" /></Field>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-medium text-muted">Exercises</div>
            {lastOfType && !f.exercises.length && (
              <Button size="sm" variant="secondary" icon={LuCopy} onClick={() => setF((x) => ({ ...x, exercises: lastOfType.exercises.map((e) => ({ ...e, id: Math.random().toString(36).slice(2), sets: e.sets.map((s) => ({ reps: String(s.reps), weight: String(s.weight) })) })) }))}>
                Repeat last {f.type}
              </Button>
            )}
          </div>
          {f.exercises.map((ex, i) => (
            <div key={ex.id} className="rounded-2xl bg-surface2 p-3 flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <input aria-label="Exercise name" className="field !bg-surface flex-1" list="ex-list" value={ex.name} onChange={(e) => setEx(i, { name: e.target.value })} placeholder="Exercise" />
                <button type="button" aria-label="Remove exercise" className="w-9 h-9 grid place-items-center rounded-full text-muted hover:bg-surface" onClick={() => setF((x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== i) }))}><LuX className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-[28px_1fr_1fr_32px] gap-2 items-center text-[12px] text-muted px-1">
                <span>Set</span><span>Reps</span><span>kg</span><span />
              </div>
              {ex.sets.map((s, si) => (
                <div key={si} className="grid grid-cols-[28px_1fr_1fr_32px] gap-2 items-center">
                  <span className="text-[13px] text-muted num text-center">{si + 1}</span>
                  <input aria-label={`Set ${si + 1} reps`} className="field !bg-surface num !py-2" inputMode="numeric" value={s.reps} onChange={(e) => setEx(i, { sets: ex.sets.map((q, qi) => (qi === si ? { ...q, reps: e.target.value } : q)) })} />
                  <input aria-label={`Set ${si + 1} weight in kg`} className="field !bg-surface num !py-2" inputMode="decimal" value={s.weight} placeholder="BW" onChange={(e) => setEx(i, { sets: ex.sets.map((q, qi) => (qi === si ? { ...q, weight: e.target.value } : q)) })} />
                  <button type="button" aria-label={`Remove set ${si + 1}`} disabled={ex.sets.length === 1} className="w-8 h-8 grid place-items-center rounded-full text-muted hover:bg-surface disabled:opacity-30"
                    onClick={() => setEx(i, { sets: ex.sets.filter((_, qi) => qi !== si) })}><LuMinus className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" className="self-start text-[13px] font-medium text-brand px-1 py-1" onClick={() => setEx(i, { sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] })}>+ Add set</button>
            </div>
          ))}
          <datalist id="ex-list">{[...new Set([...(EXERCISES[f.type] || []), ...Object.values(EXERCISES).flat()])].map((x) => <option key={x} value={x} />)}</datalist>
          <div className="flex flex-wrap gap-1.5">
            {(EXERCISES[f.type] || []).filter((x) => !f.exercises.some((e) => e.name === x)).slice(0, 4).map((x) => (
              <button key={x} type="button" onClick={() => addEx(x)} className="h-8 px-3 rounded-full text-[13px] border hairline text-muted hover:text-ink">+ {x}</button>
            ))}
            <button type="button" onClick={() => addEx()} className="h-8 px-3 rounded-full text-[13px] border hairline text-ink font-medium">+ Custom</button>
          </div>
          {err.exercises && <p className="text-[12px] text-bad" role="alert">{err.exercises}</p>}
        </div>
        <Toggle label="Completed" sub="Turn off to save this as a planned session" checked={f.completed} onChange={set('completed')} />
        <Field label="Notes" htmlFor="w-notes"><textarea id="w-notes" className="field min-h-[70px]" value={f.notes} onChange={set('notes')} placeholder="How it felt, what to change next time" /></Field>
      </div>
    </Sheet>
  );
}
function suggestType(state) {
  const plan = { 1: 'Push', 3: 'Pull', 5: 'Legs', 6: 'Cardio' };
  const last = state.workouts.find((w) => w.completed);
  const order = ['Push', 'Pull', 'Legs'];
  if (last && order.includes(last.type)) return order[(order.indexOf(last.type) + 1) % 3];
  return plan[new Date().getDay()] || 'Full Body';
}

export function WeightSheet({ open, onClose }) {
  const { state, actions, toast } = useApp();
  const last = [...state.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [kg, setKg] = useState(last ? String(last.kg) : '');
  const [date, setDate] = useState(todayKey());
  const [err, setErr] = useState('');
  const save = () => {
    const v = n(kg);
    if (!(v >= 25 && v <= 300)) return setErr('Enter your weight in kg (25–300).');
    actions.logWeight(date, Math.round(v * 10) / 10);
    toast(`Weight logged: ${v} kg`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log body weight" footer={<Footer onCancel={onClose} onSave={save} />}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight (kg)" htmlFor="wt-kg" error={err}><input id="wt-kg" className="field num !text-[22px]" inputMode="decimal" value={kg} onChange={(e) => { setKg(e.target.value); setErr(''); }} aria-invalid={!!err} /></Field>
        <Field label="Date" htmlFor="wt-date"><input id="wt-date" className="field" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

/* ───────────── Habits ───────────── */

export function HabitSheet({ open, onClose, habit }) {
  const { actions, toast, back } = useApp();
  const editing = !!habit;
  const [f, setF] = useState(() => habit
    ? { ...habit, target: String(habit.target), freq: { kind: 'daily', days: [1, 3, 5], times: 3, ...habit.freq } }
    : { name: '', icon: 'sprout', color: 1, category: 'Health', type: 'boolean', target: '1', unit: '', step: 1, freq: { kind: 'daily', days: [1, 3, 5], times: 3 }, startDate: todayKey(), reminder: '' });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const setFreq = (patch) => setF((x) => ({ ...x, freq: { ...x.freq, ...patch } }));
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Name the habit.';
    const t = f.type === 'boolean' ? 1 : n(f.target);
    if (!(t > 0)) e.target = 'Enter a target above 0.';
    if (f.type === 'numeric' && !String(f.unit).trim()) e.unit = 'Add a unit, like L or pages.';
    if (f.freq.kind === 'days' && !f.freq.days.length) e.freq = 'Pick at least one day.';
    if (f.freq.kind === 'weekly' && !(f.freq.times >= 1 && f.freq.times <= 7)) e.freq = 'Choose 1 to 7 times a week.';
    if (!f.startDate) e.startDate = 'Pick a start date.';
    setErr(e);
    if (Object.keys(e).length) return;
    const freq = f.freq.kind === 'daily' ? { kind: 'daily' } : f.freq.kind === 'days' ? { kind: 'days', days: [...f.freq.days].sort() } : { kind: 'weekly', times: Number(f.freq.times) };
    const unit = f.type === 'duration' ? 'min' : f.type === 'boolean' ? '' : f.unit.trim();
    const step = f.type === 'boolean' ? 1 : f.type === 'duration' ? (t >= 60 ? 15 : 5) : t >= 1000 ? Math.round(t / 10) : t <= 5 ? 0.5 : 1;
    actions.saveHabit({ ...f, name: f.name.trim(), target: t, unit, step, freq, archived: false });
    toast(editing ? 'Habit updated' : `Added ${f.name.trim()}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit habit' : 'New habit'} wide
      footer={<Footer onCancel={onClose} onSave={save} left={editing && <ConfirmDelete onConfirm={() => { actions.deleteHabit(habit.id); toast('Habit deleted'); onClose(); back(); }} />} />}>
      <div className="flex flex-col gap-4">
        {!editing && (
          <div>
            <div className="text-[13px] font-medium text-muted mb-1.5">Start from an example</div>
            <div className="flex gap-1.5 scroll-x -mx-1 px-1">
              {HABIT_TEMPLATES.map((t) => (
                <button key={t.name} type="button" className="h-8 px-3 rounded-full text-[13px] border hairline text-muted hover:text-ink shrink-0"
                  onClick={() => setF((x) => ({ ...x, ...t, target: String(t.target) }))}>{t.name}</button>
              ))}
            </div>
          </div>
        )}
        <Field label="Name" htmlFor="h-name" error={err.name}><input id="h-name" className="field" value={f.name} onChange={set('name')} aria-invalid={!!err.name} placeholder="Read before bed" /></Field>
        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(HABIT_ICONS).map(([k, Icon]) => (
              <button key={k} type="button" aria-label={k} aria-pressed={f.icon === k} onClick={() => set('icon')(k)}
                className={cx('aspect-square rounded-xl grid place-items-center transition', f.icon === k ? 'text-onbrand' : 'bg-surface2 text-muted hover:text-ink')}
                style={f.icon === k ? { background: col(f.color) } : undefined}>
                <Icon className="w-[18px] h-[18px]" />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Colour">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => set('color')(c)}
                className={cx('w-8 h-8 rounded-full transition border-2', f.color === c ? 'border-ink scale-110' : 'border-transparent')} style={{ background: col(c) }} />
            ))}
          </div>
        </Field>
        <Field label="Category"><Chips value={f.category} onChange={set('category')} options={HABIT_CATS} /></Field>
        <Field label="Type">
          <Segmented value={f.type} onChange={(v) => setF((x) => ({ ...x, type: v, unit: v === 'duration' ? 'min' : v === 'boolean' ? '' : x.unit || 'times', target: v === 'boolean' ? '1' : x.target === '1' ? '' : x.target }))}
            options={[{ value: 'boolean', label: 'Yes / No' }, { value: 'numeric', label: 'Amount' }, { value: 'duration', label: 'Duration' }]} />
        </Field>
        {f.type !== 'boolean' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={f.type === 'duration' ? 'Target (minutes)' : 'Daily target'} htmlFor="h-target" error={err.target}>
              <input id="h-target" className="field num" inputMode="decimal" value={f.target} onChange={set('target')} aria-invalid={!!err.target} placeholder={f.type === 'duration' ? '30' : '3'} />
            </Field>
            {f.type === 'numeric' && (
              <Field label="Unit" htmlFor="h-unit" error={err.unit}><input id="h-unit" className="field" value={f.unit} onChange={set('unit')} placeholder="L, pages, steps" /></Field>
            )}
          </div>
        )}
        <Field label="Frequency" error={err.freq}>
          <Segmented value={f.freq.kind} onChange={(v) => setFreq({ kind: v })}
            options={[{ value: 'daily', label: 'Every day' }, { value: 'days', label: 'Specific days' }, { value: 'weekly', label: 'Times a week' }]} />
          {f.freq.kind === 'days' && (
            <div className="flex gap-1.5 mt-2">
              {DOW_MON.map((d) => (
                <button key={d} type="button" aria-pressed={f.freq.days.includes(d)} onClick={() => setFreq({ days: f.freq.days.includes(d) ? f.freq.days.filter((x) => x !== d) : [...f.freq.days, d] })}
                  className={cx('flex-1 h-10 rounded-xl text-[13px] font-medium transition', f.freq.days.includes(d) ? 'bg-brand text-onbrand' : 'bg-surface2 text-muted')}>{DOW[d].slice(0, 2)}</button>
              ))}
            </div>
          )}
          {f.freq.kind === 'weekly' && (
            <div className="flex items-center gap-3 mt-2">
              <button type="button" aria-label="Fewer times" className="w-10 h-10 rounded-xl bg-surface2 grid place-items-center" onClick={() => setFreq({ times: Math.max(1, f.freq.times - 1) })}><LuMinus className="w-4 h-4" /></button>
              <div className="num text-[15px] font-medium min-w-[110px] text-center">{f.freq.times} times a week</div>
              <button type="button" aria-label="More times" className="w-10 h-10 rounded-xl bg-surface2 grid place-items-center" onClick={() => setFreq({ times: Math.min(7, f.freq.times + 1) })}><LuPlus className="w-4 h-4" /></button>
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" htmlFor="h-start" error={err.startDate}><input id="h-start" className="field" type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Reminder" htmlFor="h-rem" hint="Optional, shown in the app"><input id="h-rem" className="field" type="time" value={f.reminder} onChange={set('reminder')} /></Field>
        </div>
      </div>
    </Sheet>
  );
}

export function HabitValueSheet({ open, onClose, habit, date }) {
  const { state, actions, toast } = useApp();
  const cur = state.habitLogs[habit?.id]?.[date] ?? 0;
  const [v, setV] = useState(cur ? String(cur) : '');
  const [err, setErr] = useState('');
  if (!habit) return null;
  const save = () => {
    const x = v === '' ? 0 : n(v);
    if (!(x >= 0)) return setErr('Enter a number, or 0 to clear.');
    actions.setHabitValue(habit.id, date, x);
    toast(`${habit.name}: ${x} ${habit.unit} on ${fmtShort(date)}`);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`${habit.name} · ${fmtShort(date)}`} footer={<Footer onCancel={onClose} onSave={save} />}>
      <Field label={`Amount (${habit.unit || 'count'})`} htmlFor="hv" error={err} hint={`Target ${habit.target} ${habit.unit}`}>
        <div className="flex gap-2">
          <button type="button" aria-label="Decrease" className="w-12 h-12 rounded-xl bg-surface2 grid place-items-center shrink-0" onClick={() => setV(String(Math.max(0, (n(v) || 0) - habit.step)))}><LuMinus className="w-4 h-4" /></button>
          <input id="hv" className="field num !text-[22px] text-center" inputMode="decimal" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} />
          <button type="button" aria-label="Increase" className="w-12 h-12 rounded-xl bg-surface2 grid place-items-center shrink-0" onClick={() => setV(String(Math.round(((n(v) || 0) + habit.step) * 100) / 100))}><LuPlus className="w-4 h-4" /></button>
        </div>
      </Field>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="secondary" onClick={() => setV(String(habit.target))}>Mark target met</Button>
        <Button size="sm" variant="ghost" onClick={() => setV('0')}>Clear</Button>
      </div>
    </Sheet>
  );
}

export function FinanceDaySheet({ open, onClose, date }) {
  const { state, openSheet } = useApp();
  const txs = state.transactions.filter((t) => t.date === date);
  const spent = txs.filter((t) => t.type === 'expense' && t.category !== 'Investment').reduce((a, t) => a + t.amount, 0);
  const go = (s) => { onClose(); setTimeout(() => openSheet(s), 10); };
  return (
    <Sheet open={open} onClose={onClose} title={fmtShort(date)}
      footer={<><div className="flex-1" /><Button variant="secondary" onClick={() => go({ type: 'tx', txType: 'income', date })}>Add income</Button><Button icon={LuPlus} onClick={() => go({ type: 'tx', txType: 'expense', date })}>Add expense</Button></>}>
      <div className="text-[13px] text-muted mb-3 num">Spent {inr(spent)} · {txs.length} {txs.length === 1 ? 'transaction' : 'transactions'}</div>
      {txs.length ? (
        <div className="divide-y hairline rounded-2xl bg-surface2/50">
          {txs.map((t) => {
            const Icon = t.type === 'income' ? LuArrowDownLeft : CAT_ICONS[t.category] || LuReceipt;
            return (
              <button key={t.id} type="button" onClick={() => go({ type: 'tx', tx: t })} className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface2">
                <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 bg-surface" style={t.type === 'income' ? { color: col(1) } : undefined}><Icon className="w-4 h-4" /></span>
                <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{t.note || t.category}</span><span className="block text-[12px] text-muted">{t.category}</span></span>
                <span className={cx('num font-semibold text-[14px]', t.type === 'income' && 'text-good')}>{t.type === 'income' ? '+' : '−'}{inr(t.amount)}</span>
              </button>
            );
          })}
        </div>
      ) : <Empty title="Nothing logged this day" body="A no-spend day. Add an expense if you missed one." />}
    </Sheet>
  );
}
