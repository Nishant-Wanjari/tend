import React, { useMemo, useState } from 'react';
import { LuBookOpen, LuWallet, LuDumbbell, LuListChecks, LuFlame } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Segmented, Section, Stat, BarChart, Heatmap, Progress, col, tint, TRACKER } from '../ui.jsx';
import { addDays, eachDay, fmtShort, fmtDow, monthOf, fmtMonthShort, startOfWeek, diffDays } from '../lib/date.js';
import { dayItems, readingStats, financeStats, gymStats, habitRate, habitLongest, monthsBack, isSpend, pagesByDay } from '../lib/stats.js';
import { pct, inr, inrCompact, num, plural } from '../lib/format.js';

export default function Analytics() {
  const { state, today, nav } = useApp();
  const [period, setPeriod] = useState('week');

  const yearRates = useMemo(() => {
    const m = {};
    for (const k of eachDay(addDays(today, -364), today)) m[k] = dayItems(state, k, today);
    return m;
  }, [state, today]);

  const a = useMemo(() => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const from = addDays(today, -(days - 1));
    const keys = eachDay(from, today);
    const pbd = pagesByDay(state.readingSessions);
    const spendBy = {};
    let income = 0, spending = 0;
    for (const t of state.transactions) {
      if (t.date < from || t.date > today) continue;
      if (t.type === 'income') income += t.amount;
      else if (isSpend(t)) { spending += t.amount; spendBy[t.date] = (spendBy[t.date] || 0) + t.amount; }
    }
    const woBy = {};
    for (const w of state.workouts) if (w.completed && w.date >= from) woBy[w.date] = (woBy[w.date] || 0) + 1;
    const habits = state.habits.filter((h) => !h.archived);
    const habitDay = (k) => {
      const items = yearRates[k]?.items.filter((i) => i.kind === 'habit') || [];
      return items.length ? items.filter((i) => i.done).length / items.length : null;
    };
    // buckets: days for week/month, months for year
    let buckets;
    if (period === 'year') {
      buckets = monthsBack(today, 12).map((m) => {
        const ks = keys.filter((k) => k.startsWith(m));
        return { key: m, label: fmtMonthShort(m + '-01').slice(0, 1), name: fmtMonthShort(m + '-01'), ks };
      });
    } else {
      buckets = keys.map((k) => ({ key: k, label: period === 'week' ? fmtDow(k).slice(0, 2) : fmtShort(k).split(' ')[0], name: fmtShort(k), ks: [k] }));
    }
    const avg = (arr) => { const v = arr.filter((x) => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
    const completion = buckets.map((b) => { const v = avg(b.ks.map((k) => yearRates[k]?.total ? yearRates[k].rate : null)); return { key: b.key, label: b.label, value: v == null ? 0 : v * 100, tip: `${b.name}: ${v == null ? 'nothing due' : pct(v)}` }; });
    const reading = buckets.map((b) => { const v = b.ks.reduce((s, k) => s + (pbd[k] || 0), 0); return { key: b.key, label: b.label, value: v, tip: `${b.name}: ${v} pages` }; });
    const spend = buckets.map((b) => { const v = b.ks.reduce((s, k) => s + (spendBy[k] || 0), 0); return { key: b.key, label: b.label, value: v, tip: `${b.name}: ${inr(v)} spent` }; });
    const workouts = buckets.map((b) => { const v = b.ks.reduce((s, k) => s + (woBy[k] || 0), 0); return { key: b.key, label: b.label, value: v, tip: `${b.name}: ${plural(v, 'workout')}` }; });
    const habitsS = buckets.map((b) => { const v = avg(b.ks.map(habitDay)); return { key: b.key, label: b.label, value: v == null ? 0 : v * 100, tip: `${b.name}: ${v == null ? 'nothing due' : pct(v)} of habits` }; });

    const overall = avg(keys.map((k) => (yearRates[k]?.total ? yearRates[k].rate : null))) || 0;
    const habitRates = habits.map((h) => habitRate(state.habitLogs, h, from, today, today)).filter((x) => x != null);
    const rs = readingStats(state, today);
    const gs = gymStats(state, today);
    const fs = financeStats(state, today);
    const longestHabit = habits.map((h) => ({ h, s: habitLongest(state.habitLogs, h, today) })).filter((x) => x.s.unit === 'day').sort((p, q) => q.s.count - p.s.count)[0];
    const longest = [
      { label: 'Reading', n: rs.longest, unit: 'day' },
      longestHabit && { label: longestHabit.h.name, n: longestHabit.s.count, unit: 'day' },
    ].filter(Boolean).sort((p, q) => q.n - p.n)[0];
    // weekly consistency: share of days in each of the last weeks where ≥ 80% of activities got done
    const weeks = Array.from({ length: period === 'year' ? 12 : period === 'month' ? 5 : 1 }, (_, i) => addDays(startOfWeek(today), -7 * i));
    const strong = weeks.map((wk) => eachDay(wk, addDays(wk, 6)).filter((k) => k <= today && yearRates[k]?.total && yearRates[k].rate >= 0.8).length);
    const wkCount = keys.filter((k) => woBy[k]).length;
    return {
      completion, reading, spend, workouts, habitsS, overall,
      habitAvg: habitRates.length ? habitRates.reduce((p, q) => p + q, 0) / habitRates.length : 0,
      pages: reading.reduce((s, b) => s + b.value, 0), income, spending, saved: income - spending,
      workoutTotal: Object.values(woBy).reduce((s, v) => s + v, 0), perWeek: (Object.entries(woBy).filter(([k]) => k >= from).reduce((s, [, v]) => s + v, 0)) / Math.max(1, days / 7),
      longest, rs, gs, fs, strongDays: strong[0], wkCount,
      every: period === 'month' ? 5 : 1,
    };
  }, [state, today, period, yearRates]);

  const label = { week: 'last 7 days', month: 'last 30 days', year: 'last 12 months' }[period];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[14px] text-muted">Everything you track, side by side · {label}</p>
        <Segmented value={period} onChange={setPeriod} label="Period" options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-3">
        <Card className="p-4 col-span-2 md:col-span-1 lg:col-span-2 flex items-center gap-4">
          <div className="min-w-0">
            <div className="label">Overall completion</div>
            <div className="serif text-[44px] leading-none num mt-2">{Math.round(a.overall * 100)}<span className="text-[20px] text-muted">%</span></div>
            <div className="text-[12px] text-muted mt-1.5">of planned activities done</div>
          </div>
        </Card>
        <Card className="p-4"><Stat label="Longest streak" value={a.longest ? plural(a.longest.n, 'day') : '—'} sub={a.longest?.label} /></Card>
        <Card className="p-4"><Stat label="Pages read" value={num(a.pages)} sub={`${a.rs.finishedThisYear.length}/${a.rs.yearGoal} books this year`} /></Card>
        <Card className="p-4"><Stat label="Saved" value={inrCompact(a.saved)} sub={a.income ? `${pct(a.saved / a.income)} of income` : 'No income logged'} /></Card>
        <Card className="p-4"><Stat label="Workouts" value={a.workoutTotal} sub={`${a.perWeek.toFixed(1)} a week avg`} /></Card>
      </div>

      <Card className="p-4 md:p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div className="text-[13px] text-muted">Daily completion {period === 'year' ? '(monthly average)' : ''}</div>
          <div className="text-[12px] text-muted text-right">This week <b className="text-ink num">{a.strongDays}/7</b> days at 80%+</div>
        </div>
        <BarChart data={a.completion} format={(v) => `${Math.round(v)}%`} labelEvery={a.every} ariaLabel="Completion over time" height={160} />
      </Card>

      <Section title="By tracker">
        <div className="grid gap-4 sm:grid-cols-2">
          <Mini kind="reading" icon={LuBookOpen} title="Reading" value={`${num(a.pages)} pages`} sub={`Streak ${plural(a.rs.streak, 'day')}`} onOpen={() => nav('reading')}>
            <BarChart data={a.reading} color={col(1)} height={110} labelEvery={a.every} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v))} ariaLabel="Pages read" />
          </Mini>
          <Mini kind="finance" icon={LuWallet} title="Spending" value={inrCompact(a.spending)} sub={`${inrCompact(a.income)} income · ${pct(a.fs.goalProgress)} of goals saved`} onOpen={() => nav('finance')}>
            <BarChart data={a.spend} color={col(2)} height={110} labelEvery={a.every} format={(v) => inrCompact(v)} ariaLabel="Spending" />
          </Mini>
          <Mini kind="gym" icon={LuDumbbell} title="Workouts" value={plural(a.workoutTotal, 'session')} sub={`Streak ${plural(a.gs.streak, 'week')} · target ${a.gs.target}/week`} onOpen={() => nav('gym')}>
            <BarChart data={a.workouts} color={col(3)} height={110} labelEvery={a.every} format={(v) => Math.round(v)} ariaLabel="Workouts" />
          </Mini>
          <Mini kind="habits" icon={LuListChecks} title="Habits" value={pct(a.habitAvg)} sub="average completion" onOpen={() => nav('habits')}>
            <BarChart data={a.habitsS} color={col(4)} height={110} labelEvery={a.every} format={(v) => `${Math.round(v)}%`} ariaLabel="Habit completion" />
          </Mini>
        </div>
      </Section>

      <Section title="Progress">
        <Card className="p-4 md:p-5 grid gap-5 sm:grid-cols-2">
          <Bar label="Books this year" value={a.rs.finishedThisYear.length / a.rs.yearGoal} detail={`${a.rs.finishedThisYear.length} of ${a.rs.yearGoal}`} c={1} />
          <Bar label="Savings goals" value={a.fs.goalProgress} detail={pct(a.fs.goalProgress)} c={2} />
          <Bar label="Workouts this week" value={a.gs.thisWeek / a.gs.target} detail={`${a.gs.thisWeek} of ${a.gs.target}`} c={3} />
          <Bar label="Habit completion" value={a.habitAvg} detail={pct(a.habitAvg)} c={4} />
        </Card>
      </Section>

      <Section title="Consistency over the year">
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-3">Share of each day's planned activities you completed</div>
          <Heatmap from={addDays(today, -364)} to={today} color="var(--brand)" ariaLabel="Overall consistency heatmap"
            valueOf={(k) => (yearRates[k]?.total ? yearRates[k].rate : null)}
            tip={(k) => (yearRates[k]?.total ? `${fmtShort(k)} · ${yearRates[k].done}/${yearRates[k].total} done` : `${fmtShort(k)} · nothing planned`)} />
        </Card>
      </Section>
    </div>
  );
}

function Mini({ kind, icon: Icon, title, value, sub, children, onOpen }) {
  const c = TRACKER[kind].c;
  return (
    <Card className="p-4 md:p-5">
      <button type="button" onClick={onOpen} className="flex items-center gap-2.5 mb-3 text-left w-full group">
        <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: tint(c, 0.13), color: col(c) }}><Icon className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] text-muted">{title}</span>
          <span className="block text-[17px] font-semibold num leading-tight truncate group-hover:underline underline-offset-2">{value}</span>
        </span>
      </button>
      {children}
      <div className="text-[12px] text-muted mt-2 truncate">{sub}</div>
    </Card>
  );
}
function Bar({ label, value, detail, c }) {
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1.5 gap-2"><span>{label}</span><span className="text-muted num">{detail}</span></div>
      <Progress value={value} color={col(c)} height={6} label={label} />
    </div>
  );
}
