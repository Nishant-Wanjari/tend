import React, { useMemo, useState } from 'react';
import { LuPlus, LuDumbbell, LuTrophy, LuScale, LuFootprints, LuFlame, LuClock, LuPencil, LuChevronDown } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Progress, Pill, Button, Section, Stat, Empty, BarChart, LineChart, Heatmap, MonthCalendar, Sparkline, col, tint, cx } from '../ui.jsx';
import { addDays, startOfWeek, fmtShort, relDay, monthOf, fromKey, DOW, weekday } from '../lib/date.js';
import { gymStats, workoutVolume } from '../lib/stats.js';
import { TrackerCalendar } from '../calendarView.jsx';
import { hoursMin, pct, plural, num } from '../lib/format.js';

const TYPE_COLOR = { Push: 3, Pull: 5, Legs: 1, 'Upper Body': 3, 'Lower Body': 1, Cardio: 4, 'Full Body': 2, Custom: 6 };

export default function Gym() {
  const { state, today, openSheet } = useApp();
  const g = useMemo(() => gymStats(state, today), [state, today]);
  const [calMonth, setCalMonth] = useState(today);
  const [showAll, setShowAll] = useState(false);
  const s = state.settings;
  const done = state.workouts.filter((w) => w.completed);
  const todayDone = g.todays.find((w) => w.completed);
  const todayPlanned = g.todays.find((w) => !w.completed);

  const weekly = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const wk = addDays(startOfWeek(today), -7 * (11 - i));
    const ws = done.filter((w) => startOfWeek(w.date) === wk);
    return { key: wk, label: fmtShort(wk).split(' ')[0], value: ws.length, vol: ws.reduce((a, w) => a + workoutVolume(w), 0), tip: `Week of ${fmtShort(wk)}: ${plural(ws.length, 'workout')}` };
  }), [state.workouts, today]);

  const weights = useMemo(() => [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-16), [state.weights]);
  const byDate = useMemo(() => {
    const m = {};
    for (const w of state.workouts) (m[w.date] ||= []).push(w);
    return m;
  }, [state.workouts]);
  const stepsHabit = state.habits.find((h) => /steps?/i.test(h.unit || ''));
  const stepsToday = stepsHabit ? state.habitLogs[stepsHabit.id]?.[today] || 0 : null;
  const toTarget = g.weight != null && s.targetWeight ? g.weight - s.targetWeight : null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="label">Today · {DOW[weekday(today)]}</div>
            <h2 className="serif text-[26px] leading-tight mt-1.5">
              {todayDone ? todayDone.name : todayPlanned ? todayPlanned.name : g.planned ? 'Training day' : 'Rest day'}
            </h2>
            <div className="text-[13px] text-muted mt-1">
              {todayDone ? `${hoursMin(todayDone.duration)} · ${plural(todayDone.exercises.length, 'exercise')}${todayDone.calories ? ` · ${todayDone.calories} kcal` : ''}`
                : g.planned ? `Planned in your ${plural(s.workoutsPerWeek, 'day')}-a-week split` : 'Recovery counts too. Log a walk in Habits.'}
            </div>
          </div>
          <Pill tone={todayDone ? 'good' : g.planned ? 'warn' : 'neutral'}>{todayDone ? 'Completed' : g.planned ? 'To do' : 'Rest'}</Pill>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {todayDone ? <Button size="sm" variant="secondary" icon={LuPencil} onClick={() => openSheet({ type: 'workout', workout: todayDone })}>Edit workout</Button>
            : <Button size="sm" icon={LuPlus} onClick={() => openSheet({ type: 'workout', workout: todayPlanned })}>{todayPlanned ? 'Complete workout' : 'Record workout'}</Button>}
          <Button size="sm" variant="secondary" icon={LuScale} onClick={() => openSheet({ type: 'weight' })}>Log weight</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><Stat label="Streak" value={plural(g.streak, 'week')} sub={`${g.target}+ workouts each week · best ${g.longest}`} /></Card>
        <Card className="p-4">
          <Stat label="This week" value={`${g.thisWeek} / ${g.target}`} sub={g.thisWeek >= g.target ? 'Target met' : `${g.target - g.thisWeek} to go`} />
          <Progress value={g.thisWeek / g.target} color={col(3)} height={4} className="mt-2" />
        </Card>
        <Card className="p-4">
          <Stat label="This month" value={`${g.monthCount} / ${g.monthTarget}`} sub={`${hoursMin(g.monthMinutes)} training`} />
          <Progress value={g.monthCount / g.monthTarget} color={col(3)} height={4} className="mt-2" />
        </Card>
        <Card className="p-4"><Stat label="Calories" value={g.caloriesLogged ? num(g.monthCalories) : '—'} sub={g.caloriesLogged ? 'kcal recorded this month' : 'Add when you measure them'} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="label">Body weight</div>
              <div className="text-[28px] font-semibold num tracking-tight mt-1">{g.weight != null ? `${g.weight} kg` : '—'}</div>
              {g.weight != null && <div className="text-[12px] text-muted num">{g.weightChange <= 0 ? '−' : '+'}{Math.abs(g.weightChange).toFixed(1)} kg since {fmtShort(g.weightSince)}</div>}
            </div>
            <Button size="sm" variant="secondary" onClick={() => openSheet({ type: 'weight' })}>Log</Button>
          </div>
          {weights.length > 1 ? (
            <LineChart data={weights.map((w) => ({ key: w.id, label: fmtShort(w.date).split(' ')[0], value: w.kg, tip: `${fmtShort(w.date)}: ${w.kg} kg` }))}
              color={col(3)} goal={s.targetWeight || undefined} format={(v, axis) => (axis ? Math.round(v) : `${v} kg`)} labelEvery={Math.ceil(weights.length / 6)} ariaLabel="Weight trend" />
          ) : <Empty icon={LuScale} title="Log your weight twice to see a trend" />}
          {s.targetWeight > 0 && <div className="text-[12px] text-muted mt-2">Dashed line: target {s.targetWeight} kg{toTarget != null ? ` · ${Math.abs(toTarget).toFixed(1)} kg ${toTarget > 0 ? 'to lose' : 'to gain'}` : ''}</div>}
        </Card>

        <Card className="p-4 md:p-5 flex flex-col gap-4">
          <div className="label">Targets</div>
          <Target label={`${s.workoutsPerWeek} workouts a week`} value={g.thisWeek / g.target} detail={`${g.thisWeek}/${g.target} this week`} />
          <Target label={`${s.monthlyWorkoutTarget} workouts a month`} value={g.monthCount / g.monthTarget} detail={`${g.monthCount}/${g.monthTarget}`} />
          {s.targetWeight > 0 && g.weight != null && (
            <Target label={`Reach ${s.targetWeight} kg`} detail={toTarget > 0 ? `${toTarget.toFixed(1)} kg to go` : 'Reached'}
              value={(() => { const start = weights[0]?.kg ?? g.weight; return start === s.targetWeight ? 1 : (start - g.weight) / (start - s.targetWeight); })()} />
          )}
          <Target label={`Walk ${num(s.dailySteps)} steps a day`} value={stepsToday != null ? stepsToday / s.dailySteps : 0}
            detail={stepsToday != null ? `${num(stepsToday)} today` : 'Track steps as a habit'} />
        </Card>
      </div>

      <Section title="Activity">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 md:p-5">
            <div className="text-[13px] text-muted mb-3">Workouts per week</div>
            <BarChart data={weekly} color={col(3)} goal={g.target} labelEvery={2} format={(v) => Math.round(v)} ariaLabel="Workouts per week" />
          </Card>
          <Card className="p-4 md:p-5">
            <div className="text-[13px] text-muted mb-3">Volume lifted per week (kg × reps)</div>
            <LineChart data={weekly.map((w) => ({ key: w.key, label: w.label, value: w.vol, tip: `Week of ${fmtShort(w.key)}: ${num(w.vol)} kg` }))}
              color={col(3)} labelEvery={2} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : Math.round(v))} zeroBase ariaLabel="Volume over time" />
          </Card>
          <Card className="p-4 md:p-5">
            <TrackerCalendar kind="gym" month={calMonth} onMonth={setCalMonth}
              onDay={(k) => { const w = byDate[k]?.[0]; openSheet({ type: 'workout', workout: w, date: k }); }} />
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex items-baseline justify-between mb-3 gap-3"><div className="text-[13px] text-muted">Consistency, last 6 months</div><div className="text-[12px] text-muted">Longest <b className="text-ink num">{plural(g.longest, 'week')}</b></div></div>
            <Heatmap from={addDays(today, -181)} to={today} color="var(--c3)" ariaLabel="Workout heatmap"
              valueOf={(k) => { const ws = (byDate[k] || []).filter((w) => w.completed); return ws.length ? Math.min(1, ws.reduce((a, w) => a + w.duration, 0) / 60) : 0; }}
              tip={(k) => { const ws = (byDate[k] || []).filter((w) => w.completed); return ws.length ? `${fmtShort(k)} · ${ws.map((w) => w.name).join(', ')}` : `${fmtShort(k)} · no workout`; }} />
          </Card>
        </div>
      </Section>

      <Section title="Personal records">
        {g.prs.length ? (
          <Card className="divide-y hairline">
            {g.prs.slice(0, 8).map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: i < 3 ? tint(2, 0.14) : 'rgb(var(--surface-2))', color: i < 3 ? col(2) : 'rgb(var(--muted))' }}><LuTrophy className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0"><div className="text-[14px] truncate">{p.name}</div><div className="text-[12px] text-muted">{relDay(p.date, today)}</div></div>
                <div className="num font-semibold">{p.weight} kg <span className="text-muted font-normal">× {p.reps}</span></div>
              </div>
            ))}
          </Card>
        ) : <Card><Empty icon={LuTrophy} title="No lifts recorded yet" body="Add sets with weights to track your best lifts." /></Card>}
      </Section>

      <Section title="History" action={<Button size="sm" variant="secondary" icon={LuPlus} onClick={() => openSheet({ type: 'workout' })}>Record</Button>}>
        {state.workouts.length ? (
          <Card className="divide-y hairline overflow-hidden">
            {(showAll ? state.workouts : state.workouts.slice(0, 10)).map((w) => (
              <button key={w.id} type="button" onClick={() => openSheet({ type: 'workout', workout: w })} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2/60 transition">
                <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: tint(TYPE_COLOR[w.type] || 3, 0.14), color: col(TYPE_COLOR[w.type] || 3) }}><LuDumbbell className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] truncate">{w.name}</div>
                  <div className="text-[12px] text-muted truncate">{relDay(w.date, today)} · {w.type} · {plural(w.exercises?.length || 0, 'exercise')}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] num font-medium">{hoursMin(w.duration)}</div>
                  {!w.completed && <Pill tone="warn">Planned</Pill>}
                </div>
              </button>
            ))}
            {state.workouts.length > 10 && (
              <button type="button" onClick={() => setShowAll(!showAll)} className="w-full py-3 text-[13px] font-medium text-brand flex items-center justify-center gap-1">
                {showAll ? 'Show fewer' : `Show all ${state.workouts.length}`}<LuChevronDown className={cx('w-4 h-4 transition', showAll && 'rotate-180')} />
              </button>
            )}
          </Card>
        ) : <Card><Empty icon={LuDumbbell} title="No workouts yet" action={<Button icon={LuPlus} onClick={() => openSheet({ type: 'workout' })}>Record a workout</Button>} /></Card>}
      </Section>
    </div>
  );
}

function Target({ label, value, detail }) {
  return (
    <div>
      <div className="flex justify-between gap-3 text-[13px] mb-1.5"><span className="truncate">{label}</span><span className="text-muted num shrink-0">{detail}</span></div>
      <Progress value={value} color={value >= 1 ? 'rgb(var(--good))' : col(3)} height={5} label={label} />
    </div>
  );
}
