import React, { useEffect, useRef, useState } from 'react';
import { LuSun, LuMoon, LuMonitor, LuDownload, LuUpload, LuRotateCcw, LuTrash2, LuShare2, LuCloud, LuHardDrive, LuCopy, LuChevronRight } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Button, Segmented, Field, Toggle, Section, cx } from '../ui.jsx';
import { DOW, DOW_MON, todayKey } from '../lib/date.js';
import { saveFile, isNative } from '../lib/files.js';
import { useSponsors } from '../lib/sponsors.js';
import { validateBackup } from '../lib/store.js';

function NumField({ id, label, value, onSave, suffix, min = 0, hint }) {
  const [v, setV] = useState(String(value ?? ''));
  const [err, setErr] = useState('');
  const commit = () => {
    const n = Number(v);
    if (v === '' || !(n >= min)) { setErr(`Enter a number${min ? ` of at least ${min}` : ''}.`); return; }
    setErr('');
    if (n !== value) onSave(n);
  };
  return (
    <Field label={label} htmlFor={id} error={err} hint={hint}>
      <div className="relative">
        <input id={id} className="field num pr-12" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-invalid={!!err} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span>}
      </div>
    </Field>
  );
}

export default function Profile() {
  const { state, actions, toast, nav, sync, openSheet } = useApp();
  const sponsorFeed = useSponsors();
  const s = state.settings;
  const rem = s.reminders || {};
  const fileRef = useRef(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [armed, setArmed] = useState(null);
  const setRem = (patch) => actions.settings({ reminders: { ...rem, ...patch } });
  const [canInstall, setCanInstall] = useState(() => !!window.__tendInstall);
  useEffect(() => {
    const on = () => setCanInstall(true);
    window.addEventListener('tend-installable', on);
    return () => window.removeEventListener('tend-installable', on);
  }, []);
  const install = async () => {
    const e = window.__tendInstall;
    if (!e) return;
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    window.__tendInstall = null;
    setCanInstall(false);
    if (r?.outcome === 'accepted') toast('Tend is installed');
  };

  const backup = () => JSON.stringify({ app: 'tend', version: 1, exportedAt: new Date().toISOString(), data: { ...state } }, null, 2);
  const download = async () => {
    const out = await saveFile(`tend-backup-${todayKey()}.json`, backup());
    if (out === 'saved' || out === 'fallback') toast(isNative() ? 'Backup saved to Downloads › Tend' : 'Backup saved');
    else if (out === 'declined') toast('Backup cancelled');
    else toast("Downloads aren't available here. Use Copy backup instead.");
  };
  const copyBackup = async () => {
    try { await navigator.clipboard.writeText(backup()); toast('Backup copied. Paste it into a note to keep it.'); }
    catch { setShowPaste(true); setPaste(backup()); toast('Copy blocked here. Select the text below and copy it.'); }
  };
  const restoreText = (text) => {
    let obj;
    try { obj = JSON.parse(text); } catch { toast("That isn't valid backup text."); return; }
    const err = validateBackup(obj);
    if (err) { toast(err); return; }
    actions.restore(obj.app === 'tend' ? obj.data : obj);
    setPaste(''); setShowPaste(false);
    toast('Backup restored');
  };
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => restoreText(String(r.result));
    r.onerror = () => toast("Couldn't read that file.");
    r.readAsText(f);
    e.target.value = '';
  };
  const twoStep = (key, run) => {
    if (armed === key) { run(); setArmed(null); } else { setArmed(key); setTimeout(() => setArmed((a) => (a === key ? null : a)), 3500); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[720px]">
      <Card className="p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brandsoft text-brand serif text-[26px] grid place-items-center shrink-0">{(s.name || 'Y').slice(0, 1).toUpperCase()}</div>
        <Field label="Your name" htmlFor="pf-name" className="flex-1">
          <input id="pf-name" className="field" defaultValue={s.name} maxLength={40} placeholder="Name used in greetings and share cards"
            onBlur={(e) => e.target.value.trim() !== s.name && (actions.settings({ name: e.target.value.trim() }), toast('Name saved'))} />
        </Field>
      </Card>

      {canInstall && (
        <Card className="p-5 flex items-center gap-4">
          <div className="flex-1 min-w-0"><div className="font-medium">Install Tend</div><div className="text-[13px] text-muted">Open it from your home screen like an app. Works offline.</div></div>
          <Button onClick={install}>Install</Button>
        </Card>
      )}

      <Section title="Appearance">
        <Card className="p-5">
          <Segmented value={s.theme} onChange={(v) => actions.settings({ theme: v })} label="Theme"
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Card>
      </Section>

      <Section title="Goals">
        <Card className="p-5 grid gap-4 sm:grid-cols-2">
          <NumField id="g-pages" label="Reading per day" suffix="pages" min={1} value={s.readingDailyPages} onSave={(v) => actions.settings({ readingDailyPages: v })} />
          <NumField id="g-books" label="Books this year" suffix="books" min={1} value={s.readingYearGoal} onSave={(v) => actions.settings({ readingYearGoal: v })} />
          <NumField id="g-budget" label="Monthly spending budget" suffix="₹" value={s.monthlyBudget} onSave={(v) => actions.settings({ monthlyBudget: v })} hint="Investments don't count towards it" />
          <NumField id="g-open" label="Opening balance" suffix="₹" value={s.openingBalance} onSave={(v) => actions.settings({ openingBalance: v })} hint="Your balance before the first transaction" />
          <NumField id="g-wk" label="Workouts per week" min={1} value={s.workoutsPerWeek} onSave={(v) => actions.settings({ workoutsPerWeek: Math.min(7, Math.round(v)) })} />
          <NumField id="g-mo" label="Workouts per month" min={1} value={s.monthlyWorkoutTarget} onSave={(v) => actions.settings({ monthlyWorkoutTarget: Math.round(v) })} />
          <NumField id="g-weight" label="Target body weight" suffix="kg" value={s.targetWeight} onSave={(v) => actions.settings({ targetWeight: v })} hint="0 to turn off" />
          <NumField id="g-steps" label="Daily walking target" suffix="steps" min={1} value={s.dailySteps} onSave={(v) => actions.settings({ dailySteps: Math.round(v) })} />
          <Field label="Training days" className="sm:col-span-2" hint="Days a workout counts as planned on your home screen">
            <div className="flex gap-1.5">
              {DOW_MON.map((d) => {
                const on = (s.workoutDays || []).includes(d);
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => actions.settings({ workoutDays: on ? s.workoutDays.filter((x) => x !== d) : [...(s.workoutDays || []), d] })}
                    className={cx('flex-1 h-10 rounded-xl text-[13px] font-medium transition', on ? 'bg-brand text-onbrand' : 'bg-surface2 text-muted')}>{DOW[d].slice(0, 2)}</button>
                );
              })}
            </div>
          </Field>
        </Card>
      </Section>

      <Section title="Reminders">
        <Card className="p-5 flex flex-col gap-1">
          <Toggle label="In-app reminders" sub={isNative() ? 'Due items appear on your home screen while Tend is open.' : "Due items appear on your home screen while Tend is open. This page can't send phone notifications."} checked={!!rem.enabled} onChange={(v) => setRem({ enabled: v })} />
          {rem.enabled && (
            <>
              <Toggle label="Habit reminders" sub="Uses each habit's reminder time" checked={!!rem.habits} onChange={(v) => setRem({ habits: v })} />
              <div className="flex items-center gap-3">
                <div className="flex-1"><Toggle label="Reading goal" checked={!!rem.reading} onChange={(v) => setRem({ reading: v })} /></div>
                <input aria-label="Reading reminder time" type="time" className="field !w-[130px]" value={rem.readingTime} disabled={!rem.reading} onChange={(e) => setRem({ readingTime: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1"><Toggle label="Training days" checked={!!rem.workout} onChange={(v) => setRem({ workout: v })} /></div>
                <input aria-label="Workout reminder time" type="time" className="field !w-[130px]" value={rem.workoutTime} disabled={!rem.workout} onChange={(e) => setRem({ workoutTime: e.target.value })} />
              </div>
            </>
          )}
        </Card>
      </Section>

      <Section title="Share">
        <Card as="button" type="button" onClick={() => nav('share')} className="p-5 flex items-center gap-4 text-left">
          <span className="w-10 h-10 rounded-xl bg-brand text-onbrand grid place-items-center"><LuShare2 className="w-5 h-5" /></span>
          <span className="flex-1"><span className="block font-medium">Export progress cards</span><span className="block text-[13px] text-muted">Reading, money, training and habit cards as PNG</span></span>
          <LuChevronRight className="w-5 h-5 text-faint" />
        </Card>
      </Section>

      <Section title="Tend">
        <Card className="divide-y hairline overflow-hidden">
          <button type="button" onClick={() => openSheet({ type: 'advertise', placement: 'home' })} className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface2/60">
            <span className="flex-1"><span className="block font-medium">Advertise with Tend</span><span className="block text-[13px] text-muted">Logo slots on the home screen and trackers. No tracking, no pop-ups.</span></span>
            <LuChevronRight className="w-5 h-5 text-faint" />
          </button>
          {sponsorFeed.booking?.supportLink && (
            <a href={sponsorFeed.booking.supportLink} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-4 p-4 hover:bg-surface2/60">
              <span className="flex-1"><span className="block font-medium">Support Tend</span><span className="block text-[13px] text-muted">Chip in to keep it free and ad-light</span></span>
              <LuChevronRight className="w-5 h-5 text-faint" />
            </a>
          )}
        </Card>
      </Section>

      <Section title="Your data">
        <Card className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 text-[13px]">
            {sync.status === 'synced' || sync.status === 'syncing' ? <LuCloud className="w-4 h-4 text-good" /> : <LuHardDrive className="w-4 h-4 text-muted" />}
            <span className="text-muted">{sync.detail}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={LuDownload} onClick={download}>Download backup</Button>
            <Button variant="secondary" icon={LuCopy} onClick={copyBackup}>Copy backup</Button>
            <Button variant="secondary" icon={LuUpload} onClick={() => fileRef.current?.click()}>Restore from file</Button>
            <Button variant="ghost" onClick={() => setShowPaste((x) => !x)}>Paste backup</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Backup file" />
          </div>
          {showPaste && (
            <div className="flex flex-col gap-2">
              <textarea aria-label="Backup text" className="field min-h-[120px] mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the text of a Tend backup here" />
              <div><Button size="sm" onClick={() => restoreText(paste)} disabled={!paste.trim()}>Restore this backup</Button></div>
            </div>
          )}
          <div className="border-t hairline pt-4 flex flex-wrap gap-2">
            <Button variant="outline" icon={LuRotateCcw} onClick={() => twoStep('reset', () => { actions.reset(); toast('Sample data restored'); })}>
              {armed === 'reset' ? 'Tap again to replace your data' : 'Reset demo data'}
            </Button>
            <Button variant="danger" icon={LuTrash2} onClick={() => twoStep('clear', () => { actions.clearAll(); toast('All tracking data cleared. Your goals and settings stay.'); })}>
              {armed === 'clear' ? 'Tap again to erase everything' : 'Clear all data'}
            </Button>
          </div>
          <p className="text-[12px] text-faint">Reset demo data replaces everything with the sample set. Clear all data keeps your name, goals and settings. Download a backup first if you might want your entries back.</p>
        </Card>
      </Section>
    </div>
  );
}
