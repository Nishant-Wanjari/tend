import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuPlus, LuFlame, LuClock, LuTrophy, LuBookOpen, LuPencil, LuCheck, LuPause, LuPlay, LuTrash2, LuShare2, LuImage } from 'react-icons/lu';
import { fetchMissingCovers } from '../lib/covers.js';
import { drawShelf, autoShelf } from '../lib/shelf.js';
import { useApp } from '../ctx.js';
import { Card, Ring, Progress, Pill, Button, Segmented, Section, Stat, Empty, BarChart, Heatmap, BookCover, col, cx } from '../ui.jsx';
import { Stars } from '../forms.jsx';
import { TrackerCalendar } from '../calendarView.jsx';
import { addDays, eachDay, fmtShort, fmtDow, monthOf, addMonths, fmtMonthShort, startOfWeek, relDay, yearOf } from '../lib/date.js';
import { readingStats, monthsBack } from '../lib/stats.js';
import { hoursMin, hoursDec, pct, plural } from '../lib/format.js';

const SHELVES = [
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
  { value: 'want', label: 'Want to read' },
  { value: 'paused', label: 'Paused' },
];

export default function Reading() {
  const { state, today, nav, openSheet, actions, toast } = useApp();
  const [coverJob, setCoverJob] = useState(null);
  const missingCovers = state.books.filter((b) => !b.coverId && !b.coverData).length;
  const getCovers = async () => {
    setCoverJob({ done: 0, total: missingCovers });
    try {
      const r = await fetchMissingCovers(state.books, actions.setCover, (done, total) => setCoverJob({ done, total }));
      toast(r.found ? `Added ${r.found} real ${r.found === 1 ? 'cover' : 'covers'}${r.found < r.total ? `. ${r.total - r.found} not found; use Find cover on those.` : ''}` : 'No matching covers found. Use Find cover on a book to pick one.');
    } catch (e) {
      toast(e.message, { duration: 5000 });
    } finally { setCoverJob(null); }
  };
  const r = useMemo(() => readingStats(state, today), [state, today]);
  const [shelf, setShelf] = useState('reading');
  const [period, setPeriod] = useState('week');
  const [calMonth, setCalMonth] = useState(today);
  const book = r.current[0];
  const shelfBooks = state.books.filter((b) => b.status === shelf)
    .sort((a, b) => (shelf === 'completed' ? (b.finishedAt || '').localeCompare(a.finishedAt || '') : (b.lastReadAt || b.addedAt || '').localeCompare(a.lastReadAt || a.addedAt || '')));

  const chart = useMemo(() => {
    const mbd = {};
    for (const s of state.readingSessions) mbd[s.date] = (mbd[s.date] || 0) + (s.minutes || 0);
    if (period === 'week') {
      return { data: eachDay(addDays(today, -6), today).map((k) => ({ key: k, label: fmtDow(k).slice(0, 2), value: mbd[k] || 0, tip: `${relDay(k, today)}: ${mbd[k] || 0} min · ${r.pbd[k] || 0} pages` })), fmt: (v) => `${Math.round(v)}m`, title: 'Minutes read per day', every: 1 };
    }
    if (period === 'month') {
      const days = eachDay(addDays(today, -29), today);
      return { data: days.map((k) => ({ key: k, label: fmtShort(k).split(' ')[0], value: r.pbd[k] || 0, tip: `${fmtShort(k)}: ${r.pbd[k] || 0} pages` })), fmt: (v) => Math.round(v), title: 'Pages per day, last 30 days', every: 5, goal: r.goal };
    }
    const months = monthsBack(today, 12);
    return {
      data: months.map((m) => {
        const v = Object.entries(r.pbd).filter(([k]) => k.startsWith(m)).reduce((a, [, p]) => a + p, 0);
        return { key: m, label: fmtMonthShort(m + '-01').slice(0, 1), value: v, tip: `${fmtMonthShort(m + '-01')}: ${v} pages` };
      }), fmt: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)), title: 'Pages per month', every: 1,
    };
  }, [state.readingSessions, period, today, r]);

  const byMonth = useMemo(() => monthsBack(today, 12).map((m) => {
    const n = state.books.filter((b) => b.status === 'completed' && b.finishedAt?.startsWith(m)).length;
    return { key: m, label: fmtMonthShort(m + '-01').slice(0, 1), value: n, tip: `${fmtMonthShort(m + '-01')}: ${plural(n, 'book')}` };
  }), [state.books, today]);

  return (
    <div className="flex flex-col gap-6">
      {/* Currently reading */}
      <Card className="p-5 overflow-hidden relative">
        {book ? (
          <div className="flex gap-5 items-start">
            <button type="button" onClick={() => nav('book', { id: book.id })} aria-label={`Open ${book.title}`}><BookCover book={book} w={92} /></button>
            <div className="min-w-0 flex-1">
              <div className="label">Currently reading</div>
              <h2 className="serif text-[22px] leading-tight mt-1.5 line-clamp-2">{book.title}</h2>
              <div className="text-[13px] text-muted mt-1 truncate">{book.author}</div>
              <div className="mt-4 flex items-center justify-between text-[12px] text-muted num"><span>p. {book.currentPage} of {book.totalPages}</span><span className="font-semibold text-ink">{pct(book.currentPage / book.totalPages)}</span></div>
              <Progress value={book.currentPage / book.totalPages} color={col(1)} className="mt-1.5" label="Book progress" />
              <div className="flex gap-2 mt-4 flex-wrap">
                <Button size="sm" icon={LuPlus} onClick={() => openSheet({ type: 'reading', bookId: book.id })}>Log pages</Button>
                <Button size="sm" variant="secondary" onClick={() => nav('book', { id: book.id })}>Details</Button>
              </div>
            </div>
          </div>
        ) : (
          <Empty icon={LuBookOpen} title="No book in progress" body="Add the book you're reading to start a streak." action={<Button icon={LuPlus} onClick={() => openSheet({ type: 'book' })}>Add a book</Button>} />
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <Ring value={r.pagesToday / r.goal} size={52} stroke={5} color={col(1)}><span className="text-[12px] font-semibold num">{Math.min(999, Math.round((r.pagesToday / r.goal) * 100))}%</span></Ring>
          <Stat label="Today" value={`${r.pagesToday}`} sub={`of ${r.goal} pages`} />
        </Card>
        <Card className="p-4"><Stat label="Streak" value={plural(r.streak, 'day')} sub={`Longest ${r.longest} days`} /></Card>
        <Card className="p-4"><Stat label="Time reading" value={`${hoursDec(r.totalMinutes)} h`} sub={`${hoursMin(r.minutesToday)} today`} /></Card>
        <Card className="p-4">
          <Stat label={`Books in ${yearOf(today)}`} value={`${r.finishedThisYear.length} / ${r.yearGoal}`} sub={`${pct(r.finishedThisYear.length / r.yearGoal)} of yearly goal`} />
          <Progress value={r.finishedThisYear.length / r.yearGoal} color={col(1)} height={4} className="mt-2" />
        </Card>
      </div>

      <ShelfTeaser />

      <Section title="Monthly reading calendar">
        <Card className="p-4 md:p-5">
          <TrackerCalendar kind="reading" month={calMonth} onMonth={setCalMonth} onDay={(k) => openSheet({ type: 'reading', date: k })} />
        </Card>
      </Section>

      {/* Library */}
      <Section title="Library" action={
        <div className="flex gap-2">
          {missingCovers > 0 && (
            <Button size="sm" variant="ghost" icon={LuImage} disabled={!!coverJob} onClick={getCovers}>
              {coverJob ? `Covers ${coverJob.done}/${coverJob.total}` : 'Get real covers'}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={LuPlus} onClick={() => openSheet({ type: 'book' })}>Add book</Button>
        </div>}>
        <div className="scroll-x -mx-1 px-1"><Segmented value={shelf} onChange={setShelf} options={SHELVES.map((s) => ({ ...s, label: `${s.label} ${state.books.filter((b) => b.status === s.value).length}` }))} label="Shelves" /></div>
        {shelfBooks.length ? (
          <Card className="divide-y hairline">
            {shelfBooks.map((b) => (
              <button key={b.id} type="button" onClick={() => nav('book', { id: b.id })} className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface2/60 transition first:rounded-t-[20px] last:rounded-b-[20px]">
                <BookCover book={b} w={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{b.title}</div>
                  <div className="text-[13px] text-muted truncate">{b.author}</div>
                  {b.status === 'reading' || b.status === 'paused' ? (
                    <div className="flex items-center gap-2 mt-2"><Progress value={b.currentPage / b.totalPages} color={col(1)} height={4} /><span className="text-[11px] text-muted num shrink-0">{pct(b.currentPage / b.totalPages)}</span></div>
                  ) : b.status === 'completed' ? (
                    <div className="flex items-center gap-2 mt-1"><Stars value={b.rating} size={13} /><span className="text-[12px] text-muted">{b.finishedAt ? `Finished ${fmtShort(b.finishedAt)}` : ''}</span></div>
                  ) : <div className="text-[12px] text-muted mt-1 num">{b.totalPages} pages</div>}
                </div>
              </button>
            ))}
          </Card>
        ) : <Card><Empty icon={LuBookOpen} title={`Nothing in ${SHELVES.find((s) => s.value === shelf).label}`} body="Books move between shelves as you read, pause and finish them." /></Card>}
      </Section>

      {/* Analytics */}
      <Section title="Reading analytics" action={<Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} label="Chart period" />}>
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-3">{chart.title}</div>
          <BarChart data={chart.data} color={col(1)} format={chart.fmt} labelEvery={chart.every} goal={chart.goal} ariaLabel={chart.title} />
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <div className="text-[13px] text-muted">Reading days, last 12 months</div>
            <div className="text-[12px] text-muted num">Longest streak <b className="text-ink">{r.longest} days</b></div>
          </div>
          <Heatmap from={addDays(today, -364)} to={today} color="var(--c1)" ariaLabel="Reading heatmap"
            valueOf={(k) => (r.pbd[k] ? r.pbd[k] / r.goal : 0)} tip={(k) => `${fmtShort(k)} · ${r.pbd[k] || 0} pages`} />
        </Card>
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-3">Books finished by month</div>
          <BarChart data={byMonth} color={col(1)} height={120} format={(v) => Math.round(v)} ariaLabel="Books finished by month" />
        </Card>
      </Section>
    </div>
  );
}

export function BookDetail({ id }) {
  const { state, actions, nav, openSheet, toast, today } = useApp();
  const b = state.books.find((x) => x.id === id);
  if (!b) return <Empty icon={LuBookOpen} title="This book was removed" />;
  const sessions = state.readingSessions.filter((s) => s.bookId === id).sort((a, x) => x.date.localeCompare(a.date));
  const minutes = sessions.reduce((a, s) => a + s.minutes, 0);
  const pagesPerDay = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.pages, 0) / new Set(sessions.map((s) => s.date)).size) : 0;
  const left = b.totalPages - b.currentPage;
  const eta = pagesPerDay && b.status === 'reading' ? Math.ceil(left / pagesPerDay) : null;
  const setStatus = (status) => {
    actions.saveBook({ ...b, status, finishedAt: status === 'completed' ? today : b.finishedAt, currentPage: status === 'completed' ? b.totalPages : b.currentPage, startedAt: b.startedAt || (status === 'reading' ? today : null) });
    toast(status === 'completed' ? `Marked ${b.title} as finished` : `Moved to ${SHELVES.find((s) => s.value === status).label}`);
  };
  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 flex flex-col sm:flex-row gap-5">
        <BookCover book={b} w={120} className="self-center sm:self-start" />
        <div className="min-w-0 flex-1">
          <Pill tone={b.status === 'completed' ? 'good' : b.status === 'reading' ? 'brand' : 'neutral'}>{SHELVES.find((s) => s.value === b.status).label}</Pill>
          <h1 className="serif text-[28px] leading-tight mt-2">{b.title}</h1>
          <div className="text-muted mt-1">{b.author}</div>
          <div className="mt-4 flex items-center justify-between text-[13px] num"><span className="text-muted">Page {b.currentPage} of {b.totalPages}</span><b>{pct(b.currentPage / b.totalPages)}</b></div>
          <Progress value={b.currentPage / b.totalPages} color={col(1)} className="mt-1.5" />
          <div className="flex flex-wrap gap-2 mt-4">
            {b.status !== 'completed' && <Button size="sm" icon={LuPlus} onClick={() => openSheet({ type: 'reading', bookId: b.id })}>Log pages</Button>}
            {b.status !== 'completed' && <Button size="sm" variant="secondary" icon={LuCheck} onClick={() => setStatus('completed')}>Mark finished</Button>}
            {b.status === 'reading' && <Button size="sm" variant="secondary" icon={LuPause} onClick={() => setStatus('paused')}>Pause</Button>}
            {(b.status === 'paused' || b.status === 'want') && <Button size="sm" variant="secondary" icon={LuPlay} onClick={() => setStatus('reading')}>Start reading</Button>}
            <Button size="sm" variant="ghost" icon={LuPencil} onClick={() => openSheet({ type: 'book', book: b })}>Edit</Button>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label="Sessions" value={sessions.length} /></Card>
        <Card className="p-4"><Stat label="Time" value={hoursMin(minutes)} /></Card>
        <Card className="p-4"><Stat label={eta ? 'Finish in' : 'Pace'} value={eta ? `${eta} days` : pagesPerDay ? `${pagesPerDay}/day` : '—'} sub={eta ? `at ${pagesPerDay} pages/day` : ''} /></Card>
      </div>
      <Card className="p-5 flex flex-col gap-3">
        <div className="label">Rating & notes</div>
        <Stars value={b.rating} onChange={(v) => actions.saveBook({ ...b, rating: v })} />
        <textarea aria-label="Notes" className="field min-h-[100px]" defaultValue={b.notes} placeholder="Quotes, ideas, what you'd tell a friend"
          onBlur={(e) => e.target.value !== b.notes && (actions.saveBook({ ...b, notes: e.target.value }), toast('Notes saved'))} />
      </Card>
      <Section title="Reading sessions">
        {sessions.length ? (
          <Card className="divide-y hairline">
            {sessions.slice(0, 40).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0"><div className="text-[14px]">{relDay(s.date, today)}</div><div className="text-[12px] text-muted num">{s.minutes} min</div></div>
                <div className="num font-semibold">{s.pages} pp</div>
                <button type="button" aria-label={`Delete session on ${s.date}`} onClick={() => { actions.deleteSession(s.id); toast('Session removed'); }}
                  className="w-8 h-8 grid place-items-center rounded-full text-faint hover:text-bad hover:bg-bad/10"><LuTrash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </Card>
        ) : <Card><Empty title="No sessions yet" body="Log pages to build this book's history." /></Card>}
      </Section>
    </div>
  );
}

function ShelfTeaser() {
  const { state, nav } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const shelf = state.bookshelf || autoShelf(state);
    drawShelf(ref.current, { ...shelf, showStats: false }, state.books, { size: 'post', name: '', images: new Map(), showSelection: false });
  }, [state.bookshelf, state.books]);
  return (
    <Card as="button" type="button" onClick={() => nav('bookshelf')} className="p-4 flex items-center gap-4 text-left hover:-translate-y-0.5 transition w-full">
      <canvas ref={ref} aria-hidden className="w-[92px] h-[92px] rounded-xl shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">Your bookshelf</span>
        <span className="block text-[13px] text-muted">Arrange your books and shelf objects, then share it as a story or post</span>
      </span>
      <LuShare2 className="w-5 h-5 text-faint shrink-0" />
    </Card>
  );
}
