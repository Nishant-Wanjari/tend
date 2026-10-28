import React, { useMemo, useState } from 'react';
import {
  LuChevronLeft, LuChevronRight, LuChevronRight as Chev, LuFlame, LuBookOpen, LuWallet, LuDumbbell, LuListChecks,
  LuCheck, LuBell, LuX, LuSparkles,
} from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Ring, Progress, Pill, Button, IconButton, col, tint, cx, TRACKER } from '../ui.jsx';
import { addDays, startOfWeek, fromKey, fmtLong, DOW, relDay, nowMinutes, timeToMinutes, fmtTime, fmtShort } from '../lib/date.js';
import { inr, inrCompact, pct, plural } from '../lib/format.js';
import {
  dayItems, readingStats, financeStats, gymStats, habitStreak, habitRate, scheduledOn, habitDone, isWeekly, weekDoneCount,
} from '../lib/stats.js';

const QUOTES = [
  'Small steps, big changes.',
  'Show up, then show up again.',
  'Progress hides in ordinary days.',
  'Consistency beats intensity.',
  'One page, one rep, one rupee at a time.',
  'Do it imperfectly. Do it today.',
  'The streak is a by-product. The habit is the point.',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function useOverview() {
  const { state, today } = useApp();
  return useMemo(() => {
    const reading = readingStats(state, today);
    const finance = financeStats(state, today);
    const gym = gymStats(state, today);
    const habits = state.habits.filter((h) => !h.archived);
    const due = habits.filter((h) => scheduledOn(h, today));
    const weekly = habits.filter(isWeekly);
    const habitsDone = due.filter((h) => habitDone(state.habitLogs, h, today)).length;
    const streaks = habits.map((h) => ({ h, s: habitStreak(state.habitLogs, h, today) }));
    const rates = habits.map((h) => habitRate(state.habitLogs, h, addDays(today, -29), today, today)).filter((x) => x != null);
    const consistency = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const bestHabit = streaks.filter((x) => x.s.unit === 'day').sort((a, b) => b.s.count - a.s.count)[0];
    const candidates = [
      { label: 'Reading', count: reading.streak, unit: 'day' },
      bestHabit && { label: bestHabit.h.name, count: bestHabit.s.count, unit: 'day' },
      { label: 'Training', count: gym.streak, unit: 'week' },
      { label: 'Saving', count: finance.savingsStreak, unit: 'month' },
    ].filter(Boolean);
    const best = [...candidates].sort((a, b) => b.count * (b.unit === 'week' ? 7 : b.unit === 'month' ? 30 : 1) - a.count * (a.unit === 'week' ? 7 : a.unit === 'month' ? 30 : 1))[0];
    return { reading, finance, gym, habits, due, weekly, habitsDone, streaks, consistency, best, bestHabit };
  }, [state, today]);
}

export default function Home() {
  const { state, actions, today, nav, openSheet } = useApp();
  const o = useOverview();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [selected, setSelected] = useState(today);
  const day = useMemo(() => dayItems(state, selected, today), [state, selected, today]);
  const quote = QUOTES[Math.floor(fromKey(today).getTime() / 864e5) % QUOTES.length];
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const reminders = useReminders();

  const tapItem = (it) => {
    if (it.kind === 'reading') return openSheet({ type: 'reading' });
    if (it.kind === 'workout') {
      const w = state.workouts.find((x) => x.date === selected);
      return openSheet({ type: 'workout', workout: w, date: selected });
    }
    const h = state.habits.find((x) => x.id === it.id);
    if (!h) return;
    if (h.type === 'boolean') actions.setHabitValue(h.id, selected, it.done ? 0 : 1);
    else openSheet({ type: 'habitValue', habit: h, date: selected });
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <div className="text-[13px] text-muted">{fmtLong(today)}</div>
          <h1 className="serif text-[34px] leading-[1.05] tracking-tight mt-1">{greeting()}{state.settings.name ? `, ${state.settings.name.split(' ')[0]}` : ''}</h1>
          <p className="text-[14px] text-muted mt-1.5">{quote}</p>
        </div>
        <button type="button" onClick={() => nav('profile', null, true)} aria-label="Profile"
          className="w-10 h-10 rounded-full bg-brandsoft text-brand font-semibold grid place-items-center shrink-0 mt-1">
          {(state.settings.name || 'You').slice(0, 1).toUpperCase()}
        </button>
      </header>

      {state.sample && (
        <div className="rounded-2xl border border-dashed hairline px-4 py-3 flex items-center gap-3 text-[13px]">
          <LuSparkles className="w-4 h-4 text-brand shrink-0" aria-hidden />
          <span className="flex-1 text-muted min-w-0">You're exploring <b className="text-ink font-medium">sample data</b>. Clear it when you're ready to track your own.</span>
          <Button size="sm" variant="secondary" onClick={() => openSheet({ type: 'startFresh' })}>Start fresh</Button>
        </div>
      )}

      {/* Week strip + day summary */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="label">{weekStart === startOfWeek(today) ? 'This week' : `Week of ${fmtShort(weekStart)}`}</div>
          <div className="flex gap-1">
            <IconButton icon={LuChevronLeft} label="Previous week" size={32} onClick={() => setWeekStart(addDays(weekStart, -7))} />
            <IconButton icon={LuChevronRight} label="Next week" size={32} disabled={weekStart >= startOfWeek(today)} className="disabled:opacity-30"
              onClick={() => setWeekStart(addDays(weekStart, 7))} />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((k) => {
            const future = k > today;
            const r = future ? 0 : dayItems(state, k, today).rate;
            return (
              <button key={k} type="button" disabled={future} onClick={() => setSelected(k)} aria-pressed={selected === k}
                aria-label={`${fmtLong(k)}${future ? '' : `, ${pct(r)} complete`}`}
                className={cx('flex flex-col items-center gap-1.5 py-2 rounded-2xl transition', selected === k ? 'bg-brandsoft' : 'hover:bg-surface2', future && 'opacity-40')}>
                <span className={cx('text-[11px]', k === today ? 'text-brand font-semibold' : 'text-muted')}>{DOW[fromKey(k).getDay()].slice(0, 1)}</span>
                <Ring value={r} size={32} stroke={3} color={r >= 1 ? 'rgb(var(--brand))' : 'rgb(var(--sage))'}>
                  <span className={cx('text-[12px] num', k === today && 'font-semibold')}>{fromKey(k).getDate()}</span>
                </Ring>
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t hairline flex gap-5 items-center">
          <Ring value={day.rate} size={96} stroke={8} label={`${pct(day.rate)} complete`}>
            <div className="serif text-[28px] num leading-none">{Math.round(day.rate * 100)}<span className="text-[14px] text-muted">%</span></div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-muted">{relDay(selected, today)}</div>
            <div className="text-[18px] font-semibold tracking-tight num">{day.done} of {plural(day.total, 'activity', 'activities')}</div>
            {o.best && o.best.count > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted">
                <LuFlame className="w-4 h-4 text-c4" aria-hidden />
                <span>Best streak <b className="text-ink font-semibold num">{o.best.count} {o.best.unit}{o.best.count === 1 ? '' : 's'}</b> · {o.best.label}</span>
              </div>
            )}
          </div>
        </div>
        {day.items.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Activities">
            {day.items.map((it) => (
              <li key={it.kind + (it.id || '')}>
                <button type="button" onClick={() => tapItem(it)} aria-pressed={it.done}
                  className={cx('h-8 pl-2 pr-3 rounded-full text-[13px] inline-flex items-center gap-1.5 border transition',
                    it.done ? 'bg-brand text-onbrand border-transparent' : 'hairline text-ink hover:bg-surface2')}>
                  <span className={cx('w-4 h-4 rounded-full grid place-items-center', it.done ? 'bg-onbrand/20' : 'border hairline')}>{it.done && <LuCheck className="w-3 h-3" />}</span>
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {reminders.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><LuBell className="w-4 h-4 text-c4" aria-hidden /><div className="label">Due now</div></div>
          <ul className="flex flex-col divide-y hairline">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="text-[14px] flex-1 min-w-0 truncate">{r.label}</span>
                <span className="text-[12px] text-muted num">{fmtTime(r.time)}</span>
                <Button size="sm" variant="secondary" onClick={r.run}>{r.cta}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadingCard o={o} />
        <FinanceCard o={o} />
        <GymCard o={o} />
        <HabitsCard o={o} />
      </div>
    </div>
  );
}

function TrackerCard({ kind, icon: Icon, title, onOpen, children, aside }) {
  const c = TRACKER[kind].c;
  return (
    <Card as="article" className="p-4 md:p-5 flex flex-col gap-4 transition hover:-translate-y-0.5 cursor-pointer" onClick={onOpen}
      role="link" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())} aria-label={`Open ${title}`}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: tint(c, 0.13), color: col(c) }}><Icon className="w-4 h-4" aria-hidden /></div>
        <h2 className="text-[15px] font-semibold flex-1">{title}</h2>
        {aside}
        <Chev className="w-4 h-4 text-faint" aria-hidden />
      </div>
      {children}
    </Card>
  );
}

function ReadingCard({ o }) {
  const { nav } = useApp();
  const r = o.reading;
  const book = r.current[0];
  return (
    <TrackerCard kind="reading" icon={LuBookOpen} title="Reading" onOpen={() => nav('reading')}
      aside={r.streak > 0 && <Pill tone="brand"><LuFlame className="w-3.5 h-3.5" />{r.streak}d</Pill>}>
      <div className="flex items-center gap-4">
        <Ring value={r.pagesToday / r.goal} size={76} stroke={7} color={col(1)} label={`${r.pagesToday} of ${r.goal} pages today`}>
          <div className="text-[18px] font-semibold num leading-none">{r.pagesToday}</div>
          <div className="text-[10px] text-muted mt-0.5">of {r.goal} pp</div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="label">Currently reading</div>
          <div className="serif text-[18px] leading-tight mt-1 line-clamp-2">{book ? book.title : 'Nothing on the go'}</div>
          {book && <div className="text-[12px] text-muted mt-1 num">p. {book.currentPage} of {book.totalPages} · {pct(book.currentPage / book.totalPages)}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t hairline text-[13px]">
        <div><span className="text-muted">Streak </span><b className="num font-semibold">{plural(r.streak, 'day')}</b></div>
        <div><span className="text-muted">This year </span><b className="num font-semibold">{r.finishedThisYear.length}/{r.yearGoal} books</b></div>
      </div>
    </TrackerCard>
  );
}

function FinanceCard({ o }) {
  const { nav } = useApp();
  const f = o.finance;
  return (
    <TrackerCard kind="finance" icon={LuWallet} title="Finance" onOpen={() => nav('finance')}
      aside={f.savingsStreak > 0 && <Pill tone="brand">{f.savingsStreak} mo saving</Pill>}>
      <div>
        <div className="label">Available balance</div>
        <div className="serif text-[32px] leading-none num mt-1.5 tracking-tight">{inr(f.balance)}</div>
        <div className="text-[13px] text-muted mt-1.5 num">Spent today <b className="text-ink font-medium">{inr(f.spentToday)}</b></div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3 border-t hairline">
        <Mini label="In" value={inrCompact(f.month.income)} />
        <Mini label="Out" value={inrCompact(f.month.spending)} />
        <Mini label="Saved" value={pct(f.month.rate)} />
      </div>
      <div>
        <div className="flex justify-between text-[12px] text-muted mb-1.5"><span>Savings goals</span><span className="num">{pct(f.goalProgress)}</span></div>
        <Progress value={f.goalProgress} color={col(2)} label="Savings goal progress" />
      </div>
    </TrackerCard>
  );
}
const Mini = ({ label, value }) => (
  <div className="min-w-0"><div className="text-[11px] text-muted">{label}</div><div className="text-[15px] font-semibold num truncate">{value}</div></div>
);

function GymCard({ o }) {
  const { nav, state, today } = useApp();
  const g = o.gym;
  const doneToday = g.todays.some((w) => w.completed);
  const plan = { 1: 'Push', 3: 'Pull', 5: 'Legs', 6: 'Cardio' };
  const status = doneToday ? { tone: 'good', text: `Done · ${g.todays.find((w) => w.completed).name}` }
    : g.planned ? { tone: 'warn', text: 'Training day · not logged' } : { tone: 'neutral', text: 'Rest day' };
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i));
  return (
    <TrackerCard kind="gym" icon={LuDumbbell} title="Fitness" onOpen={() => nav('gym')}
      aside={g.streak > 0 && <Pill tone="brand"><LuFlame className="w-3.5 h-3.5" />{g.streak}w</Pill>}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="label">Today</div>
          <div className="mt-1.5"><Pill tone={status.tone}>{status.text}</Pill></div>
        </div>
        <div className="text-right">
          <div className="label">This week</div>
          <div className="text-[22px] font-semibold num leading-tight mt-1">{g.thisWeek}<span className="text-[14px] text-muted">/{g.target}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5" aria-label="Workouts this week">
        {weekDays.map((k) => {
          const did = state.workouts.some((w) => w.date === k && w.completed);
          const planned = (state.settings.workoutDays || []).includes(fromKey(k).getDay());
          return (
            <div key={k} className="flex flex-col items-center gap-1">
              <div className={cx('w-full h-1.5 rounded-full', did ? '' : planned ? 'bg-line' : 'bg-surface2')} style={did ? { background: col(3) } : undefined} />
              <span className={cx('text-[10px]', k === today ? 'text-ink font-semibold' : 'text-faint')}>{DOW[fromKey(k).getDay()].slice(0, 1)}</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t hairline text-[13px]">
        <div className="truncate"><span className="text-muted">Streak </span><b className="num font-semibold">{plural(g.streak, 'week')}</b></div>
        <div className="truncate"><span className="text-muted">Last </span><b className="font-semibold">{g.last ? `${relDay(g.last.date, today)} · ${g.last.type}` : '—'}</b></div>
      </div>
    </TrackerCard>
  );
}

function HabitsCard({ o }) {
  const { nav } = useApp();
  const best = o.bestHabit;
  return (
    <TrackerCard kind="habits" icon={LuListChecks} title="Habits" onOpen={() => nav('habits')}
      aside={best?.s.count > 0 && <Pill tone="brand"><LuFlame className="w-3.5 h-3.5" />{best.s.count}d</Pill>}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="label">Done today</div>
          <div className="serif text-[32px] leading-none num mt-1.5">{o.habitsDone}<span className="text-[18px] text-muted">/{o.due.length}</span></div>
        </div>
        <div className="text-right">
          <div className="label">30-day consistency</div>
          <div className="text-[22px] font-semibold num leading-tight mt-1">{pct(o.consistency)}</div>
        </div>
      </div>
      <Progress value={o.due.length ? o.habitsDone / o.due.length : 0} color={col(4)} label="Habits done today" />
      <div className="grid grid-cols-2 gap-3 pt-3 border-t hairline text-[13px]">
        <div className="truncate"><span className="text-muted">Best </span><b className="font-semibold">{best ? best.h.name : '—'}</b></div>
        <div className="truncate"><span className="text-muted">Streak </span><b className="num font-semibold">{best ? plural(best.s.count, 'day') : '—'}</b></div>
      </div>
    </TrackerCard>
  );
}

// In-app reminders: shown while the app is open; this page can't push phone notifications.
export function useReminders() {
  const { state, today, openSheet, actions } = useApp();
  const r = state.settings.reminders || {};
  if (!r.enabled) return [];
  const now = nowMinutes();
  const out = [];
  if (r.habits) {
    for (const h of state.habits) {
      if (h.archived || !h.reminder || !scheduledOn(h, today) || habitDone(state.habitLogs, h, today)) continue;
      if (timeToMinutes(h.reminder) > now) continue;
      out.push({
        id: h.id, label: h.name, time: h.reminder,
        cta: h.type === 'boolean' ? 'Mark done' : 'Log',
        run: () => (h.type === 'boolean' ? actions.setHabitValue(h.id, today, 1) : openSheet({ type: 'habitValue', habit: h, date: today })),
      });
    }
  }
  if (r.reading && r.readingTime && timeToMinutes(r.readingTime) <= now) {
    const pages = state.readingSessions.filter((s) => s.date === today).reduce((a, s) => a + s.pages, 0);
    if (pages < (state.settings.readingDailyPages || 20)) out.push({ id: 'reading', label: 'Reading goal', time: r.readingTime, cta: 'Log', run: () => openSheet({ type: 'reading' }) });
  }
  if (r.workout && r.workoutTime && timeToMinutes(r.workoutTime) <= now && (state.settings.workoutDays || []).includes(new Date().getDay())
    && !state.workouts.some((w) => w.date === today && w.completed)) {
    out.push({ id: 'workout', label: 'Training day', time: r.workoutTime, cta: 'Record', run: () => openSheet({ type: 'workout' }) });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 4);
}
