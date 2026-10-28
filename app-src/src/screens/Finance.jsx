import React, { useMemo, useState } from 'react';
import { LuPlus, LuSearch, LuChevronLeft, LuChevronRight, LuArrowDownLeft, LuArrowUpRight, LuPiggyBank, LuReceipt, LuPencil, LuTarget, LuX } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Progress, Pill, Button, IconButton, Segmented, Section, Stat, Empty, GroupedBars, LineChart, Donut, Chips, CAT_ICONS, CATEGORIES, col, tint, cx } from '../ui.jsx';
import { monthOf, addMonths, fmtMonth, fmtMonthShort, relDay, diffDays, fmtShort, startOfMonth, endOfMonth } from '../lib/date.js';
import { financeStats, monthFinance, monthsBack, isSpend } from '../lib/stats.js';
import { inr, inrCompact, pct } from '../lib/format.js';
import { INCOME_CATS } from '../forms.jsx';
import { TrackerCalendar } from '../calendarView.jsx';

export default function Finance() {
  const { state, today, openSheet } = useApp();
  const [month, setMonth] = useState(monthOf(today));
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [scope, setScope] = useState('month');
  const f = useMemo(() => financeStats(state, today), [state, today]);
  const m = useMemo(() => monthFinance(state.transactions, month), [state.transactions, month]);
  const budget = state.settings.monthlyBudget || 0;
  const isCur = month === monthOf(today);

  const months = monthsBack(today, 6);
  const series = useMemo(() => months.map((mk) => ({ mk, ...monthFinance(state.transactions, mk) })), [state.transactions, today]);

  const donut = useMemo(() => {
    const entries = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 5).map(([label, value], i) => ({ label, value, color: col(i + 1) }));
    const rest = entries.slice(5).reduce((a, [, v]) => a + v, 0);
    if (rest > 0) top.push({ label: 'Other', value: rest, color: col(8) });
    return top;
  }, [m]);
  const [hoverSeg, setHoverSeg] = useState(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.transactions.filter((t) => {
      if (scope === 'month' && monthOf(t.date) !== month) return false;
      if (cat !== 'All' && t.category !== cat) return false;
      if (needle && !(`${t.note} ${t.category} ${t.amount}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [state.transactions, q, cat, scope, month]);
  const grouped = useMemo(() => {
    const g = [];
    for (const t of list.slice(0, 150)) {
      if (!g.length || g[g.length - 1].date !== t.date) g.push({ date: t.date, items: [] });
      g[g.length - 1].items.push(t);
    }
    return g;
  }, [list]);
  const usedCats = ['All', ...CATEGORIES.filter((c) => state.transactions.some((t) => t.category === c)), ...INCOME_CATS.filter((c) => c !== 'Other' && state.transactions.some((t) => t.category === c))];

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label">Current balance</div>
            <div className="serif text-[40px] leading-none num tracking-tight mt-2">{inr(f.balance)}</div>
            <div className="text-[13px] text-muted mt-2 num">Spent today {inr(f.spentToday)} · {f.savingsStreak > 0 ? `${f.savingsStreak}-month saving streak` : 'No saving streak yet'}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button size="sm" icon={LuArrowUpRight} onClick={() => openSheet({ type: 'tx', txType: 'expense' })}>Add expense</Button>
          <Button size="sm" variant="secondary" icon={LuArrowDownLeft} onClick={() => openSheet({ type: 'tx', txType: 'income' })}>Add income</Button>
        </div>
      </Card>

      <Section title={fmtMonth(month + '-01')} action={
        <div className="flex gap-1">
          <IconButton icon={LuChevronLeft} label="Previous month" size={34} onClick={() => setMonth(monthOf(addMonths(month + '-01', -1)))} />
          <IconButton icon={LuChevronRight} label="Next month" size={34} disabled={isCur} className="disabled:opacity-30" onClick={() => setMonth(monthOf(addMonths(month + '-01', 1)))} />
        </div>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><Stat label="Income" value={inr(m.income)} /></Card>
          <Card className="p-4"><Stat label="Spending" value={inr(m.spending)} sub={m.invested ? `+ ${inr(m.invested)} invested` : ''} /></Card>
          <Card className="p-4"><Stat label="Saved" value={inr(m.saved)} sub={m.income ? `${pct(m.rate)} of income` : ''} /></Card>
          <Card className="p-4">
            <Stat label="Budget used" value={budget ? pct(m.spending / budget) : '—'} sub={budget ? `${inr(Math.max(0, budget - m.spending))} left of ${inrCompact(budget)}` : 'Set a budget in Profile'} />
            {budget > 0 && <Progress value={m.spending / budget} height={4} className="mt-2" color={m.spending > budget ? 'rgb(var(--bad))' : m.spending > budget * 0.85 ? 'rgb(var(--warn))' : col(2)} label="Budget used" />}
          </Card>
        </div>
        {budget > 0 && m.spending > budget && <div className="text-[13px] text-bad">Over budget by {inr(m.spending - budget)} this month.</div>}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-2">Spending by category</div>
          {donut.length ? (
            <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
              <Donut segments={donut} size={148} onHover={setHoverSeg}>
                <div>
                  <div className="text-[11px] text-muted">{hoverSeg != null ? donut[hoverSeg].label : 'Spent'}</div>
                  <div className="text-[16px] font-semibold num">{inrCompact(hoverSeg != null ? donut[hoverSeg].value : m.spending)}</div>
                </div>
              </Donut>
              <ul className="flex-1 min-w-[160px] flex flex-col gap-2">
                {donut.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.label}</span>
                    <span className="num text-muted">{pct(s.value / m.spending)}</span>
                    <span className="num font-medium w-[72px] text-right">{inrCompact(s.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <Empty icon={LuReceipt} title="No spending this month" />}
        </Card>
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-2">Income vs spending, last 6 months</div>
          <GroupedBars data={series.map((s) => ({ key: s.mk, label: fmtMonthShort(s.mk + '-01'), a: s.income, b: s.spending }))}
            series={[{ name: 'Income', color: col(1) }, { name: 'Spending', color: col(4) }]} format={(v) => inrCompact(v)} ariaLabel="Income versus spending" />
        </Card>
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-3">Monthly savings</div>
          <LineChart data={series.map((s) => ({ key: s.mk, label: fmtMonthShort(s.mk + '-01'), value: s.income || s.spending ? s.saved : null, tip: `${fmtMonthShort(s.mk + '-01')}: saved ${inr(s.saved)} (${pct(s.rate)})` }))}
            color={col(2)} format={(v) => inrCompact(v)} zeroBase ariaLabel="Monthly savings trend" />
        </Card>
        <Card className="p-4 md:p-5">
          <div className="text-[13px] text-muted mb-3">Category spending · {fmtMonthShort(month + '-01')}</div>
          <ul className="flex flex-col gap-3">
            {Object.entries(m.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
              const Icon = CAT_ICONS[c] || LuReceipt;
              const prev = monthFinance(state.transactions, monthOf(addMonths(month + '-01', -1))).byCat[c] || 0;
              const change = prev ? (v - prev) / prev : null;
              return (
                <li key={c} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[13px] gap-2"><span className="truncate">{c}</span><span className="num font-medium">{inr(v)}</span></div>
                    <Progress value={v / Math.max(...Object.values(m.byCat))} height={4} color={col(2)} className="mt-1" />
                  </div>
                  <span className={cx('text-[11px] num w-11 text-right', change == null ? 'text-faint' : change > 0.1 ? 'text-bad' : change < -0.1 ? 'text-good' : 'text-muted')}>
                    {change == null ? 'new' : `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`}
                  </span>
                </li>
              );
            })}
            {!Object.keys(m.byCat).length && <li className="text-[13px] text-muted">Nothing spent yet.</li>}
          </ul>
        </Card>
      </div>

      <Section title="Daily spending">
        <Card className="p-4 md:p-5">
          <TrackerCalendar kind="finance" month={month + '-01'} onMonth={(k) => setMonth(monthOf(k))} onDay={(k) => openSheet({ type: 'financeDay', date: k })} />
          <div className="text-[11px] text-muted mt-2">Darker days spent more. Investments aren't counted as spending. Tap a day to see or add its transactions.</div>
        </Card>
      </Section>

      <Section title="Savings goals" action={<Button size="sm" variant="secondary" icon={LuPlus} onClick={() => openSheet({ type: 'goal' })}>New goal</Button>}>
        {state.goals.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {state.goals.map((g) => {
              const p = g.saved / g.target;
              const daysLeft = g.deadline ? diffDays(g.deadline, today) : null;
              const monthsLeft = daysLeft != null ? Math.max(1, Math.ceil(daysLeft / 30.4)) : null;
              const perMonth = monthsLeft && g.saved < g.target ? (g.target - g.saved) / monthsLeft : 0;
              return (
                <Card key={g.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: tint(2, 0.13), color: col(2) }}><LuTarget className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-[12px] text-muted num">{g.deadline ? (daysLeft >= 0 ? `By ${fmtShort(g.deadline)} · ${daysLeft} days left` : `Deadline passed ${fmtShort(g.deadline)}`) : 'No deadline'}</div>
                    </div>
                    <IconButton icon={LuPencil} label={`Edit ${g.name}`} size={32} onClick={() => openSheet({ type: 'goal', goal: g })} />
                  </div>
                  <div className="flex items-baseline justify-between num"><span className="text-[18px] font-semibold">{inr(g.saved)}</span><span className="text-[12px] text-muted">of {inr(g.target)}</span></div>
                  <Progress value={p} color={p >= 1 ? 'rgb(var(--good))' : col(2)} label={`${g.name} progress`} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-muted num">{p >= 1 ? 'Goal reached' : perMonth ? `${inrCompact(perMonth)}/month to finish on time` : `${pct(p)} saved`}</span>
                    <Button size="sm" variant="secondary" onClick={() => openSheet({ type: 'contribute', goal: g })}>Add money</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : <Card><Empty icon={LuPiggyBank} title="No goals yet" body="Save towards an emergency fund, a laptop or a trip." action={<Button icon={LuPlus} onClick={() => openSheet({ type: 'goal' })}>Create a goal</Button>} /></Card>}
      </Section>

      <Section title="Transactions" action={<Segmented size="sm" value={scope} onChange={setScope} options={[{ value: 'month', label: fmtMonthShort(month + '-01') }, { value: 'all', label: 'All time' }]} label="Date range" />}>
        <div className="relative">
          <LuSearch className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input type="search" aria-label="Search transactions" className="field !pl-9" placeholder="Search notes, categories, amounts" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="scroll-x -mx-1 px-1"><div className="flex gap-1.5 w-max">
          {usedCats.map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
              className={cx('h-8 px-3 rounded-full text-[13px] font-medium border transition whitespace-nowrap', cat === c ? 'bg-brand text-onbrand border-transparent' : 'hairline text-muted hover:text-ink')}>{c}</button>
          ))}
        </div></div>
        {grouped.length ? (
          <Card className="overflow-hidden">
            {grouped.map((g) => {
              const net = g.items.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
              return (
                <div key={g.date}>
                  <div className="flex justify-between px-4 pt-3 pb-1 text-[12px] text-muted bg-surface2/50"><span>{relDay(g.date, today)}</span><span className="num">{net >= 0 ? '+' : '−'}{inr(Math.abs(net))}</span></div>
                  {g.items.map((t) => {
                    const Icon = CAT_ICONS[t.category] || (t.type === 'income' ? LuArrowDownLeft : LuReceipt);
                    return (
                      <button key={t.id} type="button" onClick={() => openSheet({ type: 'tx', tx: t })} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2/60 transition">
                        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: t.type === 'income' ? tint(1, 0.13) : 'rgb(var(--surface-2))', color: t.type === 'income' ? col(1) : 'rgb(var(--muted))' }}>
                          {t.type === 'income' ? <LuArrowDownLeft className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0"><div className="text-[14px] truncate">{t.note || t.category}</div><div className="text-[12px] text-muted">{t.category}</div></div>
                        <div className={cx('num font-semibold text-[14px]', t.type === 'income' ? 'text-good' : '')}>{t.type === 'income' ? '+' : '−'}{inr(t.amount)}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {list.length > 150 && <div className="px-4 py-3 text-[12px] text-muted">Showing the latest 150 of {list.length}. Search or filter to narrow down.</div>}
          </Card>
        ) : <Card><Empty icon={LuSearch} title="No matching transactions" body="Try another category, search term or month." /></Card>}
      </Section>
    </div>
  );
}
