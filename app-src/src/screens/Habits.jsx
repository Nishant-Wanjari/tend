import React, { useMemo, useState } from 'react';
import { LuPlus, LuMinus, LuCheck, LuFlame, LuPencil, LuListChecks, LuBell, LuChevronDown } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Ring, Progress, Pill, Button, Section, Stat, Empty, Heatmap, MonthCalendar, BarChart, HabitIcon, col, tint, cx } from '../ui.jsx';
import { addDays, startOfWeek, fromKey, fmtShort, DOW, eachDay, relDay, fmtTime, weekday } from '../lib/date.js';
import {
  habitValue, habitDone, scheduledOn, isWeekly, weekDoneCount, habitStreak, habitLongest, habitRate, fmtStreak,
} from '../lib/stats.js';
import { pct, num, plural } from '../lib/format.js';
import { TrackerCalendar } from '../calendarView.jsx';

export const freqText = (h) => {
  const f = h.freq || { kind: 'daily' };
  if (f.kind === 'daily') return 'Every day';
  if (f.kind === 'weekly') return `${f.times}× a week`;
  const d = [...f.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (d.length === 5 && !d.includes(0) && !d.includes(6)) return 'Weekdays';
  return d.map((x) => DOW[x]).join(', ');
};
const targetText = (h) => (h.type === 'boolean' ? '' : `${num(h.target)} ${h.unit}`);

function nextDue(h, today) {
  for (let i = 1; i <= 7; i++) { const k = addDays(today, i); if (scheduledOn(h, k)) return relDay(k, today) === 'Yesterday' ? DOW[weekday(k)] : i === 1 ? 'Tomorrow' : DOW[weekday(k)]; }
  return null;
}

export function HabitControl({ h, date, size = 'md' }) {
  const { state, actions, openSheet } = useApp();
  const v = habitValue(state.habitLogs, h, date);
  const done = habitDone(state.habitLogs, h, date);
  const [bump, setBump] = useState(0);
  if (h.type === 'boolean') {
    return (
      <button type="button" aria-pressed={done} aria-label={`${done ? 'Unmark' : 'Mark'} ${h.name} ${relDay(date)}`}
        onClick={(e) => { e.stopPropagation(); actions.setHabitValue(h.id, date, done ? 0 : 1); setBump((x) => x + 1); }}
        className={cx('rounded-full grid place-items-center transition border-2 shrink-0', size === 'sm' ? 'w-9 h-9' : 'w-11 h-11', done ? 'border-transparent text-onbrand' : 'hairline text-transparent hover:text-faint')}
        style={done ? { background: col(h.color) } : undefined}>
        <LuCheck key={bump} className={cx('w-5 h-5', done && 'pop')} />
      </button>
    );
  }
  const step = h.step || 1;
  const set = (x) => actions.setHabitValue(h.id, date, Math.max(0, Math.round(x * 100) / 100));
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`Decrease ${h.name}`} disabled={!v} onClick={() => set(v - step)} className="w-9 h-9 rounded-full bg-surface2 grid place-items-center disabled:opacity-30"><LuMinus className="w-4 h-4" /></button>
      <button type="button" aria-label={`Set ${h.name} amount`} onClick={() => openSheet({ type: 'habitValue', habit: h, date })} className="min-w-[52px] h-9 px-1.5 rounded-lg text-center num text-[13px] font-semibold hover:bg-surface2">
        {num(v)}<span className="text-faint font-normal">/{num(h.target)}</span>
      </button>
      <button type="button" aria-label={`Increase ${h.name}`} onClick={() => set(v + step)} className={cx('w-9 h-9 rounded-full grid place-items-center transition', done ? 'text-onbrand' : 'bg-surface2')} style={done ? { background: col(h.color) } : undefined}>
        {done ? <LuCheck className="w-4 h-4" /> : <LuPlus className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function Habits() {
  const { state, today, nav, openSheet, actions } = useApp();
  const [showOff, setShowOff] = useState(false);
  const [calMonth, setCalMonth] = useState(today);
  const [calHabit, setCalHabit] = useState('all');
  const habits = state.habits.filter((h) => !h.archived);
  const daily = habits.filter((h) => scheduledOn(h, today));
  const weekly = habits.filter(isWeekly);
  const off = habits.filter((h) => !isWeekly(h) && !scheduledOn(h, today));
  const doneToday = daily.filter((h) => habitDone(state.habitLogs, h, today)).length;
  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const summary = useMemo(() => {
    const rows = habits.map((h) => ({ h, cur: habitStreak(state.habitLogs, h, today), long: habitLongest(state.habitLogs, h, today), rate: habitRate(state.habitLogs, h, addDays(today, -29), today, today) }));
    const rates = rows.map((r) => r.rate).filter((x) => x != null);
    const dayRows = rows.filter((r) => r.cur.unit === 'day');
    return {
      rows: Object.fromEntries(rows.map((r) => [r.h.id, r])),
      consistency: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
      bestCur: dayRows.sort((a, b) => b.cur.count - a.cur.count)[0],
      bestLong: [...rows].filter((r) => r.long.unit === 'day').sort((a, b) => b.long.count - a.long.count)[0],
    };
  }, [state.habitLogs, state.habits, today]);

  const dayRate = useMemo(() => {
    const m = {};
    for (const k of eachDay(addDays(today, -364), today)) {
      const due = habits.filter((h) => scheduledOn(h, k));
      m[k] = due.length ? due.filter((h) => habitDone(state.habitLogs, h, k)).length / due.length : null;
    }
    return m;
  }, [state.habitLogs, state.habits, today]);

  const Row = ({ h, weeklyMode }) => {
    const r = summary.rows[h.id];
    const v = habitValue(state.habitLogs, h, today);
    const wc = weeklyMode ? weekDoneCount(state.habitLogs, h, weekStart) : 0;
    return (
      <div role="button" tabIndex={0} onClick={() => nav('habit', { id: h.id })} onKeyDown={(e) => e.key === 'Enter' && nav('habit', { id: h.id })}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface2/50 transition cursor-pointer">
        <HabitIcon habit={h} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium truncate">{h.name}</div>
          <div className="text-[12px] text-muted flex items-center gap-2 mt-0.5 flex-wrap">
            {weeklyMode ? <span className="num">{wc}/{h.freq.times} this week</span> : h.type !== 'boolean' ? <span className="num">{targetText(h)}</span> : <span>{freqText(h)}</span>}
            {r?.cur.count > 0 && <span className="inline-flex items-center gap-0.5 num"><LuFlame className="w-3 h-3 text-c4" />{fmtStreak(r.cur)}</span>}
            {h.reminder && <span className="inline-flex items-center gap-0.5"><LuBell className="w-3 h-3" />{fmtTime(h.reminder)}</span>}
          </div>
          {h.type !== 'boolean' && <Progress value={v / h.target} color={col(h.color)} height={4} className="mt-2 max-w-[220px]" />}
          {weeklyMode && <Progress value={wc / h.freq.times} color={col(h.color)} height={4} className="mt-2 max-w-[220px]" />}
        </div>
        <HabitControl h={h} date={today} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <Ring value={daily.length ? doneToday / daily.length : 0} size={52} stroke={5} color={col(4)}><span className="text-[12px] font-semibold num">{doneToday}/{daily.length}</span></Ring>
          <Stat label="Today" value={pct(daily.length ? doneToday / daily.length : 0)} sub="habits done" />
        </Card>
        <Card className="p-4"><Stat label="Consistency" value={pct(summary.consistency)} sub="last 30 days" /></Card>
        <Card className="p-4"><Stat label="Current best" value={summary.bestCur ? fmtStreak(summary.bestCur.cur) : '—'} sub={summary.bestCur?.h.name} /></Card>
        <Card className="p-4"><Stat label="Longest ever" value={summary.bestLong ? fmtStreak(summary.bestLong.long) : '—'} sub={summary.bestLong?.h.name} /></Card>
      </div>

      <Section title="Today" action={<Button size="sm" variant="secondary" icon={LuPlus} onClick={() => openSheet({ type: 'habit' })}>New habit</Button>}>
        {habits.length ? (
          <>
            {daily.length > 0 && <Card className="divide-y hairline overflow-hidden">{daily.map((h) => <Row key={h.id} h={h} />)}</Card>}
            {weekly.length > 0 && (
              <>
                <div className="label mt-1">This week</div>
                <Card className="divide-y hairline overflow-hidden">{weekly.map((h) => <Row key={h.id} h={h} weeklyMode />)}</Card>
              </>
            )}
            {off.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowOff(!showOff)} className="flex items-center gap-1 text-[13px] text-muted py-1" aria-expanded={showOff}>
                  {plural(off.length, 'habit')} not due today <LuChevronDown className={cx('w-4 h-4 transition', showOff && 'rotate-180')} />
                </button>
                {showOff && (
                  <Card className="divide-y hairline mt-2 overflow-hidden">
                    {off.map((h) => (
                      <button key={h.id} type="button" onClick={() => nav('habit', { id: h.id })} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2/50">
                        <HabitIcon habit={h} size={32} />
                        <span className="flex-1 text-[14px] truncate">{h.name}</span>
                        <span className="text-[12px] text-muted">{h.startDate > today ? `Starts ${fmtShort(h.startDate)}` : `Next ${nextDue(h, today) || '—'}`}</span>
                      </button>
                    ))}
                  </Card>
                )}
              </div>
            )}
          </>
        ) : <Card><Empty icon={LuListChecks} title="No habits yet" body="Start with one small thing you want to do most days." action={<Button icon={LuPlus} onClick={() => openSheet({ type: 'habit' })}>Create a habit</Button>} /></Card>}
      </Section>

      {habits.length > 0 && (
        <Section title="This week">
          <Card className="p-4 overflow-x-auto">
            <table className="w-full min-w-[320px] table-fixed text-left border-separate border-spacing-y-1">
              <thead>
                <tr>
                  <th className="label font-medium pb-1 w-[30%]">Habit</th>
                  {week.map((k) => <th key={k} className={cx('text-center text-[11px] font-medium pb-1', k === today ? 'text-brand' : 'text-muted')}>{DOW[fromKey(k).getDay()].slice(0, 2)}<div className="num text-faint font-normal">{fromKey(k).getDate()}</div></th>)}
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => (
                  <tr key={h.id}>
                    <td className="text-[13px] pr-2 truncate">{h.name}</td>
                    {week.map((k) => {
                      const due = isWeekly(h) ? k >= h.startDate : scheduledOn(h, k);
                      const done = habitDone(state.habitLogs, h, k);
                      const part = !done && h.type !== 'boolean' && habitValue(state.habitLogs, h, k) > 0;
                      const future = k > today;
                      return (
                        <td key={k} className="text-center">
                          <WeekCell h={h} k={k} due={due} done={done} part={part} future={future} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      {habits.length > 0 && (
        <Section title="Monthly streak calendar">
          <div className="scroll-x -mx-1 px-1"><div className="flex gap-1.5 w-max">
            {[{ id: 'all', name: 'All habits', color: 4 }, ...habits].map((h) => (
              <button key={h.id} type="button" aria-pressed={calHabit === h.id} onClick={() => setCalHabit(h.id)}
                className={cx('h-8 px-3 rounded-full text-[13px] font-medium border transition whitespace-nowrap inline-flex items-center gap-1.5', calHabit === h.id ? 'bg-brand text-onbrand border-transparent' : 'hairline text-muted hover:text-ink')}>
                <span className="w-2 h-2 rounded-full" style={{ background: col(h.color) }} />{h.name}
              </button>
            ))}
          </div></div>
          <Card className="p-4 md:p-5">
            <TrackerCalendar kind="habits" habitId={calHabit} month={calMonth} onMonth={setCalMonth}
              onDay={(k) => {
                const h = habits.find((x) => x.id === calHabit);
                if (!h) return;
                if (h.type === 'boolean') actions.setHabitValue(h.id, k, habitDone(state.habitLogs, h, k) ? 0 : 1);
                else openSheet({ type: 'habitValue', habit: h, date: k });
              }} />
            <div className="text-[11px] text-muted mt-2">{calHabit === 'all' ? 'Filled days had every due habit done; lighter days were partly done. Pick a habit to edit its days.' : 'Tap a day to mark it. Dashed days were due and missed.'}</div>
          </Card>
        </Section>
      )}

      {habits.length > 0 && (
        <Section title="Year in habits">
          <Card className="p-4 md:p-5">
            <div className="text-[13px] text-muted mb-3">Share of due habits completed each day</div>
            <Heatmap from={addDays(today, -364)} to={today} color="var(--c4)" valueOf={(k) => dayRate[k]} ariaLabel="Habit heatmap"
              tip={(k) => (dayRate[k] == null ? `${fmtShort(k)} · nothing due` : `${fmtShort(k)} · ${pct(dayRate[k])} done`)} />
          </Card>
        </Section>
      )}
    </div>
  );
}

function WeekCell({ h, k, due, done, part, future }) {
  const { actions, openSheet } = useApp();
  if (!due) return <span className="inline-block w-1.5 h-1.5 rounded-full bg-line" aria-label="Not scheduled" />;
  return (
    <button type="button" disabled={future} aria-label={`${h.name} on ${fmtShort(k)}: ${done ? 'done' : 'not done'}`}
      onClick={() => (h.type === 'boolean' ? actions.setHabitValue(h.id, k, done ? 0 : 1) : openSheet({ type: 'habitValue', habit: h, date: k }))}
      className={cx('w-7 h-7 rounded-lg inline-grid place-items-center transition disabled:opacity-30', !done && 'border hairline')}
      style={done ? { background: col(h.color), color: 'rgb(var(--surface))' } : part ? { background: tint(h.color, 0.22) } : undefined}>
      {done && <LuCheck className="w-3.5 h-3.5" />}
    </button>
  );
}

export function HabitDetail({ id }) {
  const { state, today, openSheet, actions } = useApp();
  const h = state.habits.find((x) => x.id === id);
  const [month, setMonth] = useState(today);
  if (!h) return <Empty icon={LuListChecks} title="This habit was removed" />;
  const logs = state.habitLogs;
  const cur = habitStreak(logs, h, today);
  const long = habitLongest(logs, h, today);
  const r30 = habitRate(logs, h, addDays(today, -29), today, today);
  const rAll = habitRate(logs, h, h.startDate, today, today);
  const total = Object.keys(logs[h.id] || {}).filter((k) => habitDone(logs, h, k)).length;
  const last30 = eachDay(addDays(today, -29), today);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <HabitIcon habit={h} size={52} />
          <div className="flex-1 min-w-0">
            <h1 className="serif text-[26px] leading-tight">{h.name}</h1>
            <div className="text-[13px] text-muted mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>{h.category}</span><span>{freqText(h)}</span>{targetText(h) && <span>Target {targetText(h)}</span>}
              {h.reminder && <span className="inline-flex items-center gap-1"><LuBell className="w-3 h-3" />{fmtTime(h.reminder)}</span>}
              <span>Since {fmtShort(h.startDate)}</span>
            </div>
          </div>
          <Button size="sm" variant="ghost" icon={LuPencil} onClick={() => openSheet({ type: 'habit', habit: h })}>Edit</Button>
        </div>
        {(isWeekly(h) || scheduledOn(h, today)) && (
          <div className="mt-4 pt-4 border-t hairline flex items-center justify-between gap-3">
            <div className="text-[14px]">{isWeekly(h) ? `${weekDoneCount(logs, h, startOfWeek(today))} of ${h.freq.times} this week` : 'Today'}</div>
            <HabitControl h={h} date={today} />
          </div>
        )}
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><Stat label="Current streak" value={fmtStreak(cur)} /></Card>
        <Card className="p-4"><Stat label="Longest streak" value={fmtStreak(long)} /></Card>
        <Card className="p-4"><Stat label="Last 30 days" value={r30 == null ? '—' : pct(r30)} sub="completion" /></Card>
        <Card className="p-4"><Stat label="All time" value={rAll == null ? '—' : pct(rAll)} sub={`${plural(total, 'check-in')}`} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 md:p-5">
          <TrackerCalendar kind="habits" habitId={h.id} month={month} onMonth={setMonth}
            onDay={(k) => { if (k < h.startDate) return; h.type === 'boolean' ? actions.setHabitValue(h.id, k, habitDone(logs, h, k) ? 0 : 1) : openSheet({ type: 'habitValue', habit: h, date: k }); }} />
          <div className="text-[11px] text-muted mt-3">Tap a day to {h.type === 'boolean' ? 'mark or unmark it' : 'change its amount'}. Dashed days were due and missed.</div>
        </Card>
        <Card className="p-4 md:p-5">
          {h.type === 'boolean' ? (
            <>
              <div className="text-[13px] text-muted mb-3">Completions per week</div>
              <BarChart data={Array.from({ length: 12 }, (_, i) => {
                const wk = addDays(startOfWeek(today), -7 * (11 - i));
                const c = weekDoneCount(logs, h, wk);
                return { key: wk, label: fmtShort(wk).split(' ')[0], value: c, tip: `Week of ${fmtShort(wk)}: ${c} days` };
              })} color={col(h.color)} labelEvery={2} goal={isWeekly(h) ? h.freq.times : undefined} format={(v) => Math.round(v)} ariaLabel="Completions per week" />
            </>
          ) : (
            <>
              <div className="text-[13px] text-muted mb-3">Last 30 days ({h.unit})</div>
              <BarChart data={last30.map((k) => ({ key: k, label: fmtShort(k).split(' ')[0], value: habitValue(logs, h, k), tip: `${fmtShort(k)}: ${num(habitValue(logs, h, k))} ${h.unit}` }))}
                color={col(h.color)} goal={h.target} labelEvery={6} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : num(v))} ariaLabel="Daily amounts" />
            </>
          )}
        </Card>
      </div>
      <Card className="p-4 md:p-5">
        <div className="text-[13px] text-muted mb-3">Last 12 months</div>
        <Heatmap from={addDays(today, -364)} to={today} color={`var(--c${h.color})`} ariaLabel={`${h.name} heatmap`}
          valueOf={(k) => (k < h.startDate ? null : !isWeekly(h) && !scheduledOn(h, k) ? (habitDone(logs, h, k) ? 1 : null) : h.type === 'boolean' ? (habitDone(logs, h, k) ? 1 : 0) : Math.min(1, habitValue(logs, h, k) / h.target))}
          tip={(k) => `${fmtShort(k)} · ${h.type === 'boolean' ? (habitDone(logs, h, k) ? 'done' : 'not done') : `${num(habitValue(logs, h, k))} ${h.unit}`}`} />
      </Card>
    </div>
  );
}
