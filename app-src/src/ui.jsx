import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  LuX, LuCheck, LuDroplet, LuLeaf, LuMoon, LuGraduationCap, LuPhoneOff, LuFootprints, LuChefHat, LuBrain,
  LuBike, LuHeartPulse, LuCoffee, LuMusic, LuPenLine, LuBookOpen, LuCode, LuLanguages, LuSunrise, LuBed,
  LuSalad, LuPill, LuBan, LuSprout, LuWind, LuDumbbell, LuUtensils, LuShoppingBag, LuBus, LuHouse, LuReceipt,
  LuFilm, LuStethoscope, LuLightbulb, LuTrendingUp, LuCircleEllipsis, LuTrash2, LuChevronLeft, LuChevronRight,
} from 'react-icons/lu';
import { coverSrc } from './lib/calendar.js';
import { addDays, eachDay, fromKey, startOfWeek, startOfMonth, endOfMonth, todayKey, fmtShort, fmtMonth, toKey, DOW } from './lib/date.js';

export const col = (i) => `rgb(var(--c${i}))`;
export const tint = (i, a) => `rgb(var(--c${i}) / ${a})`;
export const TRACKER = {
  reading: { c: 1, label: 'Reading' },
  finance: { c: 2, label: 'Finance' },
  gym: { c: 3, label: 'Fitness' },
  habits: { c: 4, label: 'Habits' },
};

export const HABIT_ICONS = {
  droplet: LuDroplet, leaf: LuLeaf, moon: LuMoon, graduation: LuGraduationCap, phoneoff: LuPhoneOff,
  footprints: LuFootprints, chef: LuChefHat, brain: LuBrain, bike: LuBike, heart: LuHeartPulse, coffee: LuCoffee,
  music: LuMusic, pen: LuPenLine, book: LuBookOpen, code: LuCode, languages: LuLanguages, sunrise: LuSunrise,
  bed: LuBed, salad: LuSalad, pill: LuPill, ban: LuBan, sprout: LuSprout, wind: LuWind, dumbbell: LuDumbbell,
};
export const CATEGORIES = ['Food', 'Shopping', 'Transport', 'Rent', 'Bills', 'Entertainment', 'Health', 'Education', 'Investment', 'Other'];
export const CAT_ICONS = {
  Food: LuUtensils, Shopping: LuShoppingBag, Transport: LuBus, Rent: LuHouse, Bills: LuReceipt, Entertainment: LuFilm,
  Health: LuStethoscope, Education: LuLightbulb, Investment: LuTrendingUp, Other: LuCircleEllipsis,
};

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ───────────── basics ───────────── */

export function Card({ as: As = 'div', className = '', children, ...p }) {
  return <As className={cx('card', className)} {...p}>{children}</As>;
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, className = '', children, ...p }) {
  const v = {
    primary: 'bg-brand text-onbrand hover:opacity-90',
    secondary: 'bg-surface2 text-ink hover:bg-line/70',
    ghost: 'text-ink hover:bg-surface2',
    danger: 'bg-bad/10 text-bad hover:bg-bad/15',
    outline: 'border hairline text-ink hover:bg-surface2',
  }[variant];
  const s = size === 'sm' ? 'h-9 px-3 text-[13px] gap-1.5 rounded-xl' : size === 'lg' ? 'h-12 px-5 text-[15px] gap-2 rounded-2xl' : 'h-11 px-4 text-[14px] gap-2 rounded-xl';
  return (
    <button type="button" className={cx('inline-flex items-center justify-center font-medium transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap', v, s, className)} {...p}>
      {Icon && <Icon aria-hidden className={size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className = '', size = 40, ...p }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-flex items-center justify-center rounded-full text-ink hover:bg-surface2 transition shrink-0', className)} style={{ width: size, height: size }} {...p}>
      <Icon aria-hidden className="w-[18px] h-[18px]" />
    </button>
  );
}

export function Ring({ value = 0, size = 64, stroke = 6, color = 'rgb(var(--brand))', track = 'rgb(var(--surface-2))', children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} className="ring-anim -rotate-90 absolute inset-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle className="val" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <div className="relative text-center leading-none">{children}</div>
    </div>
  );
}

export function Progress({ value = 0, color = 'rgb(var(--brand))', height = 6, className = '', label }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cx('w-full rounded-full bg-surface2 overflow-hidden', className)} style={{ height }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="h-full rounded-full bar-anim" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function Segmented({ value, onChange, options, className = '', size = 'md', label }) {
  return (
    <div role="tablist" aria-label={label} className={cx('inline-flex p-1 rounded-xl bg-surface2 gap-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-[10px] font-medium transition whitespace-nowrap', size === 'sm' ? 'px-2.5 h-7 text-[12px]' : 'px-3 h-8 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange, multi = false, className = '' }) {
  const isOn = (v) => (multi ? value.includes(v) : value === v);
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} type="button" aria-pressed={isOn(v)}
            onClick={() => onChange(multi ? (isOn(v) ? value.filter((x) => x !== v) : [...value, v]) : v)}
            className={cx('h-8 px-3 rounded-full text-[13px] font-medium border transition', isOn(v) ? 'bg-brand text-onbrand border-transparent' : 'hairline text-muted hover:text-ink')}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-1.5 min-w-0', className)}>
      {label && <label htmlFor={htmlFor} className="text-[13px] font-medium text-muted">{label}</label>}
      {children}
      {error ? <p className="text-[12px] text-bad" role="alert">{error}</p> : hint ? <p className="text-[12px] text-faint">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id, sub }) {
  const auto = useId();
  const tid = id || auto;
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={tid} className="min-w-0">
        <span className="block text-[15px]">{label}</span>
        {sub && <span className="block text-[12px] text-muted">{sub}</span>}
      </label>
      <button id={tid} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative w-11 h-[26px] rounded-full transition shrink-0', checked ? 'bg-brand' : 'bg-line')}>
        <span className={cx('absolute top-[3px] w-5 h-5 rounded-full bg-surface shadow transition-all', checked ? 'left-[21px]' : 'left-[3px]')} />
      </button>
    </div>
  );
}

// Two-step delete (the artifact frame can't show confirm() dialogs)
export function ConfirmDelete({ onConfirm, label = 'Delete', className = '' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button variant="danger" icon={LuTrash2} className={className} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? 'Tap again to delete' : label}
    </Button>
  );
}

export function Stat({ label, value, sub, className = '' }) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="label truncate">{label}</div>
      <div className="mt-1 text-[22px] font-semibold num tracking-tight leading-tight truncate">{value}</div>
      {sub && <div className="text-[12px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = '', id }) {
  return (
    <section className={cx('flex flex-col gap-3', className)} aria-labelledby={id}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 min-h-[32px]">
          {title && <h2 id={id} className="text-[17px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-8 px-4">
      {Icon && <div className="w-11 h-11 rounded-2xl bg-surface2 grid place-items-center text-muted"><Icon className="w-5 h-5" /></div>}
      <div className="font-medium">{title}</div>
      {body && <p className="text-[13px] text-muted max-w-[34ch]">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Pill({ children, tone = 'neutral', className = '' }) {
  const t = {
    neutral: 'bg-surface2 text-muted',
    good: 'bg-good/10 text-good',
    warn: 'bg-warn/10 text-warn',
    bad: 'bg-bad/10 text-bad',
    brand: 'bg-brandsoft text-brand',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] font-medium whitespace-nowrap', t, className)}>{children}</span>;
}

/* ───────────── sheet (bottom sheet on phones, dialog on desktop) ───────────── */

export function Sheet({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const el = ref.current?.querySelector('input:not([type=hidden]), select, textarea, button[data-autofocus]');
      (el || ref.current)?.focus({ preventScroll: true });
    }, 30);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1}
        className={cx('relative sheet-in bg-surface w-full rounded-t-[26px] md:rounded-[26px] shadow-2xl flex flex-col max-h-[92vh] outline-none', wide ? 'md:max-w-[640px]' : 'md:max-w-[480px]')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-between gap-3 pt-3 pb-2 gutter">
          <div className="w-10" />
          <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 rounded-full bg-line" />
          <h2 className="text-[16px] font-semibold text-center truncate">{title}</h2>
          <IconButton icon={LuX} label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto gutter pb-4 flex-1 min-h-0">{children}</div>
        {footer && <div className="gutter py-3 border-t hairline flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────────── toasts ───────────── */

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, opts = {}) => {
    const id = Math.random();
    setItems((a) => [...a.slice(-2), { id, msg, ...opts }]);
    setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), opts.duration || 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none gutter"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto sheet-in bg-ink text-bg rounded-2xl px-4 py-3 text-[14px] shadow-xl flex items-center gap-3 max-w-[420px]">
            <span className="min-w-0">{t.msg}</span>
            {t.action && <button type="button" className="font-semibold underline underline-offset-2 shrink-0" onClick={t.action.run}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───────────── charts ───────────── */

export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return s * p;
}

function Tooltip({ x, w, children }) {
  const left = Math.max(4, Math.min(w - 4, x));
  return (
    <div className="absolute top-0 z-10 pointer-events-none -translate-x-1/2 -translate-y-[calc(100%+6px)] bg-ink text-bg text-[12px] rounded-lg px-2 py-1 whitespace-nowrap num shadow-lg"
      style={{ left: Math.max(60, Math.min(w - 60, left)) }}>
      {children}
    </div>
  );
}

// Single-series bars. data: [{ key, label, value, tip }]
export function BarChart({ data, height = 140, color = 'rgb(var(--brand))', format = (v) => v, goal, labelEvery = 1, ariaLabel, highlightLast = true }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const padL = 34, padB = 22, padT = 8;
  const max = niceMax(Math.max(goal || 0, ...data.map((d) => d.value)) * 1.05);
  const iw = Math.max(0, w - padL);
  const ih = height - padB - padT;
  const step = data.length ? iw / data.length : 0;
  const bw = Math.max(2, Math.min(28, step * 0.62));
  const y = (v) => padT + ih - (v / max) * ih;
  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }} onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={padL} x2={w} y1={y(max * t)} y2={y(max * t)} stroke="rgb(var(--line))" strokeDasharray={t ? '2 4' : ''} />
              <text x={padL - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--faint))" className="num">{format(max * t, true)}</text>
            </g>
          ))}
          {goal > 0 && (
            <line x1={padL} x2={w} y1={y(goal)} y2={y(goal)} stroke="rgb(var(--ink) / .35)" strokeDasharray="4 3" />
          )}
          {data.map((d, i) => {
            const x = padL + i * step + (step - bw) / 2;
            const h = Math.max(d.value > 0 ? 2 : 0, padT + ih - y(d.value));
            const last = highlightLast && i === data.length - 1;
            const op = hover == null ? (last || !highlightLast ? 1 : 0.55) : hover === i ? 1 : 0.4;
            return (
              <g key={d.key ?? i}>
                <path d={roundedTop(x, padT + ih - h, bw, h, Math.min(4, bw / 2))} fill={color} opacity={op} />
                {i % labelEvery === 0 && (
                  <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{d.label}</text>
                )}
                <rect x={padL + i * step} y={0} width={step} height={height} fill="transparent"
                  onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip x={padL + hover * step + step / 2} w={w}>{data[hover].tip || `${data[hover].label}: ${format(data[hover].value)}`}</Tooltip>
      )}
    </div>
  );
}

function roundedTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// Two series side by side. data: [{ key, label, a, b }]
export function GroupedBars({ data, series, height = 160, format = (v) => v, ariaLabel }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const padL = 40, padB = 22, padT = 8;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.a, d.b])) * 1.05);
  const iw = Math.max(0, w - padL);
  const ih = height - padB - padT;
  const step = data.length ? iw / data.length : 0;
  const bw = Math.max(3, Math.min(16, step * 0.3));
  const y = (v) => padT + ih - (v / max) * ih;
  return (
    <div>
      <div className="flex gap-4 mb-2">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[12px] text-muted"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
      <div ref={ref} className="relative w-full select-none" style={{ height }} onPointerLeave={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={height} role="img" aria-label={ariaLabel}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={padL} x2={w} y1={y(max * t)} y2={y(max * t)} stroke="rgb(var(--line))" strokeDasharray={t ? '2 4' : ''} />
                <text x={padL - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--faint))">{format(max * t, true)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cxm = padL + i * step + step / 2;
              const op = hover == null || hover === i ? 1 : 0.4;
              return (
                <g key={d.key ?? i} opacity={op}>
                  <path d={roundedTop(cxm - bw - 1, y(d.a), bw, padT + ih - y(d.a), 4)} fill={series[0].color} />
                  <path d={roundedTop(cxm + 1, y(d.b), bw, padT + ih - y(d.b), 4)} fill={series[1].color} />
                  <text x={cxm} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{d.label}</text>
                  <rect x={padL + i * step} y={0} width={step} height={height} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && data[hover] && (
          <Tooltip x={padL + hover * step + step / 2} w={w}>
            {data[hover].label} · {series[0].name} {format(data[hover].a)} · {series[1].name} {format(data[hover].b)}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// data: [{ key, label, value }] — value may be null for gaps
export function LineChart({ data, height = 150, color = 'rgb(var(--brand))', format = (v) => v, goal, area = true, ariaLabel, labelEvery = 1, zeroBase = false }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const gid = useId().replace(/:/g, '');
  const padL = 40, padB = 22, padT = 10, padR = 8;
  const vals = data.map((d) => d.value).filter((v) => v != null);
  if (goal != null) vals.push(goal);
  let lo = vals.length ? Math.min(...vals) : 0;
  let hi = vals.length ? Math.max(...vals) : 1;
  if (zeroBase) lo = Math.min(0, lo);
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.12;
  lo = zeroBase ? lo : lo - pad;
  hi += pad;
  const iw = Math.max(0, w - padL - padR);
  const ih = height - padB - padT;
  const x = (i) => padL + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const pts = data.map((d, i) => (d.value == null ? null : [x(i), y(d.value)])).filter(Boolean);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const lastIdx = data.map((d) => d.value != null).lastIndexOf(true);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - padL) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div ref={ref} className="relative w-full select-none touch-pan-y" style={{ height }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity=".18" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((t) => {
            const v = lo + (hi - lo) * t;
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeDasharray={t ? '2 4' : ''} />
                <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--faint))" className="num">{format(v, true)}</text>
              </g>
            );
          })}
          {goal != null && <line x1={padL} x2={w - padR} y1={y(goal)} y2={y(goal)} stroke="rgb(var(--ink) / .35)" strokeDasharray="4 3" />}
          {area && pts.length > 1 && <path d={`${line}L${pts[pts.length - 1][0]},${padT + ih}L${pts[0][0]},${padT + ih}Z`} fill={`url(#g${gid})`} />}
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => i % labelEvery === 0 && (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{d.label}</text>
          ))}
          {lastIdx >= 0 && hover == null && <circle cx={x(lastIdx)} cy={y(data[lastIdx].value)} r="4.5" fill={color} stroke="rgb(var(--surface))" strokeWidth="2" />}
          {hover != null && data[hover]?.value != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="rgb(var(--ink) / .2)" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r="4.5" fill={color} stroke="rgb(var(--surface))" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {hover != null && data[hover]?.value != null && <Tooltip x={x(hover)} w={w}>{data[hover].tip || `${data[hover].label}: ${format(data[hover].value)}`}</Tooltip>}
    </div>
  );
}

// segments: [{ label, value, color }]
export function Donut({ segments, size = 150, stroke = 18, children, onHover }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 2.5 : 0;
  let acc = 0;
  const [hover, setHover] = useState(null);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Spending breakdown">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={hover === i ? stroke + 4 : stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc}
              onPointerEnter={() => { setHover(i); onHover?.(i); }} onPointerLeave={() => { setHover(null); onHover?.(null); }}
              style={{ transition: 'stroke-width .15s' }} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">{children}</div>
    </div>
  );
}

// GitHub-style grid. valueOf(k) → 0..1, or null when the day doesn't count.
export function Heatmap({ from, to, valueOf, color = 'var(--brand)', cell = 11, gap = 3, onCell, tip, ariaLabel }) {
  const scroller = useRef(null);
  const [hover, setHover] = useState(null);
  const start = startOfWeek(from);
  const days = eachDay(start, to);
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [from, to]);
  const W = weeks.length * (cell + gap) + 22;
  const H = 7 * (cell + gap) + 16;
  const monthLabels = [];
  weeks.forEach((wk, i) => {
    const firstOfMonth = wk.find((k) => k.endsWith('-01'));
    if (firstOfMonth || i === 0) monthLabels.push({ i, k: firstOfMonth || wk[0] });
  });
  const level = (v) => (v == null ? null : v <= 0 ? 0 : v < 0.34 ? 0.3 : v < 0.67 ? 0.55 : v < 1 ? 0.78 : 1);
  return (
    <div className="relative">
      <div ref={scroller} className="scroll-x">
        <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block">
          {monthLabels.map(({ i, k }) => (i < weeks.length - 1 || weeks.length < 3) && (
            <text key={k} x={22 + i * (cell + gap)} y={9} fontSize="10" fill="rgb(var(--muted))">{fromKey(k).toLocaleString('en-IN', { month: 'short' })}</text>
          ))}
          {[1, 3, 5].map((r) => (
            <text key={r} x={0} y={16 + r * (cell + gap) + cell - 2} fontSize="9" fill="rgb(var(--faint))">{DOW[(r + 1) % 7].slice(0, 1)}</text>
          ))}
          {weeks.map((wk, i) => wk.map((k, j) => {
            if (k < from || k > to) return null;
            const lv = level(valueOf(k));
            const fill = lv == null ? 'transparent' : lv === 0 ? 'rgb(var(--heat-0))' : `rgb(${color} / ${lv})`;
            return (
              <rect key={k} x={22 + i * (cell + gap)} y={16 + j * (cell + gap)} width={cell} height={cell} rx={3}
                fill={fill} stroke={lv == null ? 'rgb(var(--line))' : hover === k ? 'rgb(var(--ink))' : 'none'} strokeDasharray={lv == null ? '2 2' : ''}
                onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)}
                onClick={onCell ? () => onCell(k) : undefined} style={{ cursor: onCell ? 'pointer' : 'default' }} />
            );
          }))}
        </svg>
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-muted gap-2">
        <span className="truncate num">{hover ? (tip ? tip(hover) : fmtShort(hover)) : 'Tap or hover a day'}</span>
        <span className="flex items-center gap-1 shrink-0">Less
          {[0, 0.3, 0.55, 0.78, 1].map((l) => <span key={l} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l ? `rgb(${color} / ${l})` : 'rgb(var(--heat-0))' }} />)}
        More</span>
      </div>
    </div>
  );
}

// Month grid starting Monday. renderDay(k) returns content; dayClass(k) styles cell.
export function MonthCalendar({ month, onMonth, renderDay, onSelect, selected, maxMonth }) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const gridStart = startOfWeek(first);
  const cells = eachDay(gridStart, addDays(startOfWeek(last), 6));
  const today = todayKey();
  const canNext = !maxMonth || first < startOfMonth(maxMonth);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <IconButton icon={LuChevronLeft} label="Previous month" onClick={() => onMonth(addDays(first, -1))} size={34} />
        <div className="text-[14px] font-medium">{fmtMonth(first)}</div>
        <IconButton icon={LuChevronRight} label="Next month" disabled={!canNext} className="disabled:opacity-30" onClick={() => canNext && onMonth(addDays(last, 1))} size={34} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-[11px] text-faint py-1">{d}</div>)}
        {cells.map((k) => {
          const inMonth = k >= first && k <= last;
          return (
            <button key={k} type="button" disabled={!inMonth || k > today} onClick={() => onSelect?.(k)}
              aria-label={fromKey(k).toDateString()}
              className={cx('aspect-square rounded-xl text-[12px] num relative grid place-items-center transition', !inMonth && 'opacity-0 pointer-events-none',
                k > today && 'opacity-35', selected === k && 'ring-2 ring-brand', k === today && 'font-semibold')}>
              {renderDay(k)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sparkline({ values, color = 'rgb(var(--brand))', width = 96, height = 28 }) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return <svg width={width} height={height} />;
  const lo = Math.min(...v), hi = Math.max(...v);
  const x = (i) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (val) => height - 3 - ((val - lo) / (hi - lo || 1)) * (height - 6);
  const d = values.map((val, i) => (val == null ? '' : `${i ? 'L' : 'M'}${x(i)},${y(val)}`)).join('');
  const li = values.length - 1;
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(li)} cy={y(values[li] ?? v[v.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

export function BookCover({ book, w = 56, className = '', fill = false, bare = false }) {
  const src = coverSrc(book);
  const [broken, setBroken] = useState(false);
  const h = Math.round(w * 1.5);
  const light = isLight(book.cover || '#174D3A');
  const fs = fill ? 9 : Math.max(7, Math.round(w / 7.5));
  const box = fill ? { width: '100%', height: '100%' } : { width: w, height: h };
  if (src && !broken) {
    return (
      <div className={cx('relative overflow-hidden shrink-0 bg-surface2', !fill && 'rounded-[6px] shadow-[0_2px_8px_rgb(0_0_0/0.18)]', className)} style={box} aria-hidden>
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} loading="lazy" />
      </div>
    );
  }
  return (
    <div className={cx('relative overflow-hidden shrink-0', !fill && 'rounded-[6px] shadow-[0_2px_8px_rgb(0_0_0/0.18)]', className)}
      style={{ ...box, background: book.cover || '#174D3A', color: light ? '#1b1b1b' : '#f6f3ea' }} aria-hidden>
      <div className="absolute inset-y-0 left-0 w-[6%] bg-black/15" />
      <div className="absolute inset-0 flex flex-col justify-between" style={{ padding: fill ? '18px 4px 4px 6px' : Math.max(4, w * 0.1) }}>
        {!bare && <div className="serif font-semibold leading-[1.05] overflow-hidden" style={{ fontSize: fs, display: '-webkit-box', WebkitLineClamp: fill ? 3 : 4, WebkitBoxOrient: 'vertical' }}>{book.title}</div>}
        {!bare && (w >= 48 || fill) && <div className="leading-tight opacity-75 truncate" style={{ fontSize: Math.max(6, fs - 2) }}>{book.author?.split(' ').slice(-1)[0]}</div>}
      </div>
    </div>
  );
}
export function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

export function HabitIcon({ habit, size = 36 }) {
  const Icon = HABIT_ICONS[habit.icon] || LuSprout;
  return (
    <div className="rounded-xl grid place-items-center shrink-0" style={{ width: size, height: size, background: tint(habit.color, 0.14), color: col(habit.color) }}>
      <Icon className="w-[18px] h-[18px]" aria-hidden />
    </div>
  );
}

export { LuCheck };
