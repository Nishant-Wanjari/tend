import React from 'react';
import { LuBookOpen, LuWallet, LuDumbbell, LuListChecks, LuChevronRight, LuShare2, LuChartColumn, LuPlus } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Button, col, tint } from '../ui.jsx';
import { useOverview } from './Home.jsx';
import { inr, pct, plural } from '../lib/format.js';

export default function Trackers() {
  const { nav, openSheet } = useApp();
  const o = useOverview();
  const mods = [
    { id: 'reading', c: 1, icon: LuBookOpen, title: 'Reading', desc: 'Books, pages and reading sessions', stats: [[`${o.reading.pagesToday}/${o.reading.goal}`, 'pages today'], [plural(o.reading.streak, 'day'), 'streak'], [`${o.reading.finishedThisYear.length}/${o.reading.yearGoal}`, 'books this year']], add: () => openSheet({ type: 'reading' }), addLabel: 'Log pages' },
    { id: 'finance', c: 2, icon: LuWallet, title: 'Finance', desc: 'Income, spending, budgets and goals', stats: [[inr(o.finance.balance), 'balance'], [inr(o.finance.month.spending), 'spent this month'], [pct(o.finance.month.rate), 'saved']], add: () => openSheet({ type: 'tx', txType: 'expense' }), addLabel: 'Add expense' },
    { id: 'gym', c: 3, icon: LuDumbbell, title: 'Fitness', desc: 'Workouts, sets, body weight and records', stats: [[`${o.gym.thisWeek}/${o.gym.target}`, 'this week'], [plural(o.gym.streak, 'week'), 'streak'], [o.gym.weight != null ? `${o.gym.weight} kg` : '—', 'weight']], add: () => openSheet({ type: 'workout' }), addLabel: 'Record workout' },
    { id: 'habits', c: 4, icon: LuListChecks, title: 'Habits', desc: 'Daily, weekday and weekly habits', stats: [[`${o.habitsDone}/${o.due.length}`, 'done today'], [pct(o.consistency), '30-day consistency'], [o.bestHabit ? plural(o.bestHabit.s.count, 'day') : '—', 'best streak']], add: () => openSheet({ type: 'habit' }), addLabel: 'New habit' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {mods.map((m) => (
          <Card key={m.id} className="p-5 flex flex-col gap-4">
            <button type="button" onClick={() => nav(m.id)} className="flex items-start gap-3 text-left group">
              <span className="w-11 h-11 rounded-2xl grid place-items-center shrink-0" style={{ background: tint(m.c, 0.13), color: col(m.c) }}><m.icon className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[18px] font-semibold tracking-tight group-hover:underline underline-offset-4">{m.title}</span>
                <span className="block text-[13px] text-muted">{m.desc}</span>
              </span>
              <LuChevronRight className="w-5 h-5 text-faint mt-2" />
            </button>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t hairline">
              {m.stats.map(([v, l]) => (
                <div key={l} className="min-w-0"><div className="text-[16px] font-semibold num truncate">{v}</div><div className="text-[11px] text-muted truncate">{l}</div></div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={LuPlus} onClick={m.add}>{m.addLabel}</Button>
              <Button size="sm" variant="ghost" icon={LuShare2} onClick={() => nav('share', { kind: m.id })}>Share card</Button>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card as="button" type="button" onClick={() => nav('share')} className="p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition">
          <span className="w-11 h-11 rounded-2xl bg-brand text-onbrand grid place-items-center shrink-0"><LuShare2 className="w-5 h-5" /></span>
          <span className="flex-1"><span className="block font-semibold">Share progress</span><span className="block text-[13px] text-muted">Design a story or post card from your stats</span></span>
          <LuChevronRight className="w-5 h-5 text-faint" />
        </Card>
        <Card as="button" type="button" onClick={() => nav('analytics', null, true)} className="p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition">
          <span className="w-11 h-11 rounded-2xl bg-surface2 text-ink grid place-items-center shrink-0"><LuChartColumn className="w-5 h-5" /></span>
          <span className="flex-1"><span className="block font-semibold">Analytics</span><span className="block text-[13px] text-muted">All four trackers by week, month and year</span></span>
          <LuChevronRight className="w-5 h-5 text-faint" />
        </Card>
      </div>
    </div>
  );
}
