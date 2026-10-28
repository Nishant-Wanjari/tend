import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LuHouse, LuLayoutGrid, LuPlus, LuChartColumn, LuUserRound, LuChevronLeft, LuBookOpen, LuWallet, LuDumbbell,
  LuListChecks, LuShare2, LuMegaphone, LuArrowUpRight, LuArrowDownLeft, LuScale, LuTarget, LuLibrary, LuSprout,
} from 'react-icons/lu';
import { AppCtx } from './ctx.js';
import { useAppState, makeActions } from './lib/store.js';
import { fetchMissingCovers } from './lib/covers.js';
import { todayKey } from './lib/date.js';
import { ToastProvider, useToast, Sheet, Button, cx, col, tint } from './ui.jsx';
import {
  ReadingLogSheet, BookSheet, TxSheet, GoalSheet, ContributeSheet, WorkoutSheet, WeightSheet, HabitSheet, HabitValueSheet, FinanceDaySheet,
} from './forms.jsx';
import Home from './screens/Home.jsx';
import Trackers from './screens/Trackers.jsx';
import Reading, { BookDetail } from './screens/Reading.jsx';
import Finance from './screens/Finance.jsx';
import Gym from './screens/Gym.jsx';
import Habits, { HabitDetail } from './screens/Habits.jsx';
import Analytics from './screens/Analytics.jsx';
import Profile from './screens/Profile.jsx';
import Share from './screens/Share.jsx';
import Bookshelf from './screens/Bookshelf.jsx';
import { SponsorStrip, AdvertiseSheet } from './sponsorView.jsx';

const TABS = ['home', 'trackers', 'analytics', 'profile'];
const TITLES = { home: 'Home', trackers: 'Trackers', analytics: 'Analytics', profile: 'Profile', reading: 'Reading', finance: 'Finance', gym: 'Fitness', habits: 'Habits', share: 'Share progress', bookshelf: 'Bookshelf' };
const hostTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;

function App() {
  const [state, update, sync, getState] = useAppState();
  const actions = useMemo(() => makeActions(update, getState), [update, getState]);
  const toast = useToast();
  const [today, setToday] = useState(todayKey());
  const [stack, setStack] = useState([{ name: 'home' }]);
  const [sheet, setSheet] = useState(null);
  const sheetKey = useRef(0);
  const route = stack[stack.length - 1];

  // Android app: fetch real covers once for books that don't have one yet
  useEffect(() => {
    if (!window.TendNative?.fetch || state.settings.autoCoversDone) return;
    if (!state.books.some((b) => !b.coverId && !b.coverData)) return;
    let live = true;
    fetchMissingCovers(state.books, actions.setCover)
      .then((r) => { if (live) { actions.settings({ autoCoversDone: true }); if (r.found) toast(`Added ${r.found} real book covers`); } })
      .catch(() => { /* offline: try again next launch */ });
    return () => { live = false; };
  }, []);

  // midnight rollover
  useEffect(() => {
    const tick = () => setToday((t) => (t === todayKey() ? t : todayKey()));
    const id = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);

  // theme
  useEffect(() => {
    const root = document.documentElement;
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
  }, [state.settings.theme]);

  const nav = useCallback((name, params = null, asTab = false) => {
    setStack((s) => (asTab || TABS.includes(name) ? [{ name, params }] : [...s, { name, params }]));
    window.scrollTo({ top: 0 });
  }, []);
  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.scrollTo({ top: 0 });
  }, []);
  const openSheet = useCallback((s) => { sheetKey.current++; setSheet(s); }, []);
  const closeSheet = useCallback(() => setSheet(null), []);

  // Android back button (the native shell calls window.tendBack and closes the app on false)
  useEffect(() => {
    window.tendBack = () => {
      if (sheet) { setSheet(null); return true; }
      if (stack.length > 1) { back(); return true; }
      if (stack[0].name !== 'home') { nav('home', null, true); return true; }
      return false;
    };
  }, [sheet, stack, back, nav]);

  // match the phone's status and navigation bars to the app theme
  useEffect(() => {
    if (!window.TendNative?.setBars) return;
    const paint = () => {
      const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg.match(/\d+/g) || [250, 249, 246];
      const hex = '#' + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('');
      const dark = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255 < 0.5;
      try { window.TendNative.setBars(hex, dark); } catch { /* older shell */ }
    };
    const t = setTimeout(paint, 30);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', paint);
    return () => { clearTimeout(t); mq.removeEventListener?.('change', paint); };
  }, [state.settings.theme]);

  const ctx = { state, actions, today, nav, back, openSheet, toast, sync };
  const activeTab = TABS.includes(stack[0].name) ? stack[0].name : 'trackers';
  const title = route.name === 'book' ? state.books.find((b) => b.id === route.params?.id)?.title || 'Book'
    : route.name === 'habit' ? state.habits.find((h) => h.id === route.params?.id)?.name || 'Habit' : TITLES[route.name];

  let screen;
  switch (route.name) {
    case 'home': screen = <Home />; break;
    case 'trackers': screen = <Trackers />; break;
    case 'analytics': screen = <Analytics />; break;
    case 'profile': screen = <Profile />; break;
    case 'reading': screen = <Reading />; break;
    case 'finance': screen = <Finance />; break;
    case 'gym': screen = <Gym />; break;
    case 'habits': screen = <Habits />; break;
    case 'book': screen = <BookDetail id={route.params?.id} />; break;
    case 'habit': screen = <HabitDetail id={route.params?.id} />; break;
    case 'share': screen = <Share {...(route.params || {})} />; break;
    case 'bookshelf': screen = <Bookshelf />; break;
    default: screen = <Home />;
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="md:flex min-h-full">
        <Sidebar active={activeTab} route={route.name} onQuick={() => openSheet({ type: 'quick' })} />
        <main className="flex-1 min-w-0 gutter md:!px-10 pb-[120px] md:pb-16">
          <div className="max-w-[1080px] mx-auto">
            {route.name !== 'home' && (
              <TopBar title={title} stack={stack} onBack={back} onCrumb={(i) => setStack((s) => s.slice(0, i + 1))} />
            )}
            <div key={stack.length + route.name + (route.params?.id || '')} className="screen-enter pt-3 md:pt-6">
              {screen}
              {['home', 'reading', 'finance', 'gym', 'habits'].includes(route.name) && (
                <SponsorStrip placement={route.name} title={route.name === 'home' ? 'Sponsored' : 'Partners'} compact={route.name !== 'home'} className="mt-8" />
              )}
            </div>
          </div>
        </main>
        <BottomNav active={activeTab} onQuick={() => openSheet({ type: 'quick' })} />
      </div>
      <SheetHost sheet={sheet} sheetKey={sheetKey.current} onClose={closeSheet} />
    </AppCtx.Provider>
  );
}

function TopBar({ title, stack, onBack, onCrumb }) {
  const crumbs = stack.slice(0, -1);
  return (
    <div className="sticky z-30 bg-bg/90 backdrop-blur-md -mx-4 px-4 md:-mx-10 md:px-10 pt-3 pb-2 md:pt-6" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-2 max-w-[1080px] mx-auto">
        {stack.length > 1 && (
          <button type="button" onClick={onBack} aria-label="Back" className="w-9 h-9 -ml-2 rounded-full grid place-items-center hover:bg-surface2 shrink-0"><LuChevronLeft className="w-5 h-5" /></button>
        )}
        <div className="min-w-0">
          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="text-[12px] text-muted flex items-center gap-1 truncate">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  <button type="button" className="hover:text-ink truncate" onClick={() => onCrumb(i)}>{TITLES[c.name] || '…'}</button>
                  <span aria-hidden>/</span>
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight leading-tight truncate">{title}</h1>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { id: 'home', label: 'Home', icon: LuHouse },
  { id: 'trackers', label: 'Trackers', icon: LuLayoutGrid },
  { id: 'add' },
  { id: 'analytics', label: 'Analytics', icon: LuChartColumn },
  { id: 'profile', label: 'Profile', icon: LuUserRound },
];

function BottomNav({ active, onQuick }) {
  const { nav } = React.useContext(AppCtx);
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t hairline gutter"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="grid grid-cols-5 h-[64px] items-center max-w-[520px] mx-auto">
        {NAV.map((n) => n.id === 'add' ? (
          <div key="add" className="flex justify-center">
            <button type="button" onClick={onQuick} aria-label="Quick add" className="w-12 h-12 -mt-5 rounded-2xl bg-brand text-onbrand grid place-items-center shadow-[0_10px_24px_-8px_rgb(var(--brand)/0.7)] active:scale-95 transition">
              <LuPlus className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <button key={n.id} type="button" onClick={() => nav(n.id, null, true)} aria-current={active === n.id ? 'page' : undefined}
            className={cx('flex flex-col items-center gap-1 text-[11px] font-medium h-full justify-center transition', active === n.id ? 'text-brand' : 'text-muted')}>
            <n.icon className="w-[22px] h-[22px]" strokeWidth={active === n.id ? 2.3 : 1.8} />
            {n.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Sidebar({ active, route, onQuick }) {
  const { nav, openSheet } = React.useContext(AppCtx);
  const onAdvertise = () => openSheet({ type: 'advertise', placement: 'home' });
  const item = (id, label, Icon, isActive, onClick, c) => (
    <button key={id} type="button" onClick={onClick} aria-current={isActive ? 'page' : undefined}
      className={cx('w-full flex items-center gap-3 h-10 px-3 rounded-xl text-[14px] transition', isActive ? 'bg-surface text-ink font-medium shadow-sm' : 'text-muted hover:text-ink hover:bg-surface/60')}>
      <Icon className="w-[18px] h-[18px]" style={c ? { color: col(c) } : undefined} />{label}
    </button>
  );
  return (
    <aside className="hidden md:flex flex-col w-[232px] shrink-0 sticky top-0 h-screen py-6 px-4 border-r hairline gap-6">
      <div className="px-3 flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-brand text-onbrand grid place-items-center"><LuSprout className="w-[18px] h-[18px]" /></span>
        <span className="serif text-[24px] tracking-tight">Tend</span>
      </div>
      <Button icon={LuPlus} onClick={onQuick} className="mx-1">Quick add</Button>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {item('home', 'Home', LuHouse, active === 'home', () => nav('home', null, true))}
        {item('trackers', 'Trackers', LuLayoutGrid, active === 'trackers' && route === 'trackers', () => nav('trackers', null, true))}
        {item('analytics', 'Analytics', LuChartColumn, active === 'analytics', () => nav('analytics', null, true))}
        {item('profile', 'Profile', LuUserRound, active === 'profile', () => nav('profile', null, true))}
      </nav>
      <div className="flex flex-col gap-1">
        <div className="label px-3 mb-1">Trackers</div>
        {item('reading', 'Reading', LuBookOpen, route === 'reading' || route === 'book', () => nav('reading', null, true), 1)}
        {item('finance', 'Finance', LuWallet, route === 'finance', () => nav('finance', null, true), 2)}
        {item('gym', 'Fitness', LuDumbbell, route === 'gym', () => nav('gym', null, true), 3)}
        {item('habits', 'Habits', LuListChecks, route === 'habits' || route === 'habit', () => nav('habits', null, true), 4)}
        {item('share', 'Share progress', LuShare2, route === 'share', () => nav('share', null, true))}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        {item('advertise', 'Advertise with Tend', LuMegaphone, false, () => onAdvertise())}
      </div>
    </aside>
  );
}

function SheetHost({ sheet, sheetKey, onClose }) {
  if (!sheet) return null;
  const p = { open: true, onClose, key: sheetKey };
  switch (sheet.type) {
    case 'quick': return <QuickAdd {...p} />;
    case 'reading': return <ReadingLogSheet {...p} bookId={sheet.bookId} date={sheet.date} />;
    case 'book': return <BookSheet {...p} book={sheet.book} />;
    case 'tx': return <TxSheet {...p} tx={sheet.tx} type={sheet.txType} date={sheet.date} />;
    case 'financeDay': return <FinanceDaySheet {...p} date={sheet.date} />;
    case 'goal': return <GoalSheet {...p} goal={sheet.goal} />;
    case 'contribute': return <ContributeSheet {...p} goal={sheet.goal} />;
    case 'workout': return <WorkoutSheet {...p} workout={sheet.workout} date={sheet.date} />;
    case 'weight': return <WeightSheet {...p} />;
    case 'habit': return <HabitSheet {...p} habit={sheet.habit} />;
    case 'habitValue': return <HabitValueSheet {...p} habit={sheet.habit} date={sheet.date} />;
    case 'startFresh': return <StartFresh {...p} />;
    case 'advertise': return <AdvertiseSheet {...p} placement={sheet.placement} slot={sheet.slot} />;
    default: return null;
  }
}

function QuickAdd({ open, onClose }) {
  const { openSheet, nav } = React.useContext(AppCtx);
  const go = (s) => () => { onClose(); setTimeout(() => openSheet(s), 10); };
  const items = [
    { label: 'Log reading', sub: 'Pages and minutes', icon: LuBookOpen, c: 1, run: go({ type: 'reading' }) },
    { label: 'Add expense', sub: 'Money out', icon: LuArrowUpRight, c: 2, run: go({ type: 'tx', txType: 'expense' }) },
    { label: 'Record workout', sub: 'Sets, reps, kg', icon: LuDumbbell, c: 3, run: go({ type: 'workout' }) },
    { label: 'Add habit', sub: 'Something to repeat', icon: LuListChecks, c: 4, run: go({ type: 'habit' }) },
    { label: 'Add income', sub: 'Money in', icon: LuArrowDownLeft, c: 1, run: go({ type: 'tx', txType: 'income' }) },
    { label: 'Log weight', sub: 'Body weight in kg', icon: LuScale, c: 3, run: go({ type: 'weight' }) },
    { label: 'Add book', sub: 'To your library', icon: LuLibrary, c: 1, run: go({ type: 'book' }) },
    { label: 'Savings goal', sub: 'Target and deadline', icon: LuTarget, c: 2, run: go({ type: 'goal' }) },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Quick add">
      <div className="grid grid-cols-2 gap-2 pb-2">
        {items.map((it, i) => (
          <button key={it.label} type="button" onClick={it.run} data-autofocus={i === 0 ? '' : undefined}
            className="flex items-center gap-3 p-3 rounded-2xl bg-surface2 hover:bg-line/60 text-left transition">
            <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: tint(it.c, 0.14), color: col(it.c) }}><it.icon className="w-5 h-5" /></span>
            <span className="min-w-0"><span className="block text-[14px] font-medium truncate">{it.label}</span><span className="block text-[12px] text-muted truncate">{it.sub}</span></span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => { onClose(); nav('habits', null, true); }} className="w-full mt-2 h-11 rounded-xl text-[14px] font-medium text-brand hover:bg-surface2">Check off today's habits</button>
    </Sheet>
  );
}

function StartFresh({ open, onClose }) {
  const { actions, toast } = React.useContext(AppCtx);
  return (
    <Sheet open={open} onClose={onClose} title="Start fresh"
      footer={<><div className="flex-1" /><Button variant="secondary" onClick={() => { actions.dismissSample(); onClose(); }}>Keep the samples</Button>
        <Button onClick={() => { actions.clearAll(); onClose(); toast('Sample data cleared. Add your first entry with +'); }}>Clear sample data</Button></>}>
      <p className="text-[15px] text-muted leading-relaxed">
        This removes the sample books, transactions, workouts and habits so every number on screen is yours. Your name, goals and settings stay.
        You can bring the samples back any time from Profile.
      </p>
    </Sheet>
  );
}

// Hosted web app: work offline and ask the browser to keep our data
if (typeof window !== 'undefined' && /^https?:$/.test(location.protocol) && !window.TendNative && !(window.claude && typeof window.claude.use === 'function')) {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  try { navigator.storage?.persist?.(); } catch { /* optional */ }
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__tendInstall = e; window.dispatchEvent(new Event('tend-installable')); });

createRoot(document.getElementById('root')).render(<ToastProvider><App /></ToastProvider>);
