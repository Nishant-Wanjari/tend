// Share-card data + canvas renderer. The preview on screen IS this canvas,
// scaled down with CSS, so the exported PNG matches it pixel for pixel.
import { addDays, eachDay, fmt, fmtShort, todayKey, startOfWeek, diffDays, monthOf, yearOf } from './date.js';
import {
  readingStats, financeStats, gymStats, monthFinance, habitStreak, habitLongest, habitRate, habitDone, scheduledOn,
  workoutVolume, isSpend, pagesByDay, dayStreak,
} from './stats.js';
import { inr, inrCompact, num } from './format.js';
import { monthGrid, coverSrc, HEX as HEX_SLOTS } from './calendar.js';

export const SIZES = {
  story: { w: 1080, h: 1920, label: 'Story 9:16' },
  post: { w: 1080, h: 1080, label: 'Post 1:1' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 4:5' },
};

export const TEMPLATES = {
  editorial: { label: 'Editorial', bg: '#F3EFE6', ink: '#1A1A17', muted: '#6E6A60', accent: '#174D3A', rule: true },
  minimal: { label: 'Minimal', bg: '#FFFFFF', ink: '#171717', muted: '#8A8A8A', accent: '#174D3A' },
  modern: { label: 'Modern', bg: '#174D3A', ink: '#F4F7F2', muted: '#A9C3B4', accent: '#C9E2B8', tiles: true },
  dark: { label: 'Dark', bg: '#0E1311', ink: '#EDF1EC', muted: '#8A958E', accent: '#7FD1A5', tiles: true, glow: true },
  nature: { label: 'Nature', bg: '#DDE7DF', ink: '#163828', muted: '#55705F', accent: '#174D3A', organic: true },
};
export const BG_SWATCHES = ['#F3EFE6', '#FFFFFF', '#FAF9F6', '#DDE7DF', '#174D3A', '#0E1311', '#2B3A55', '#E9D9C4', '#F2DCD5'];
export const FONTS = {
  serif: { label: 'Serif', family: 'Newsreader', fallback: 'Georgia, serif', weight: 500 },
  sans: { label: 'Sans', family: 'Geist', fallback: 'Helvetica, Arial, sans-serif', weight: 600 },
  mono: { label: 'Mono', family: 'Geist Mono', fallback: 'Menlo, monospace', weight: 500 },
};
const BODY = '"Geist", Helvetica, Arial, sans-serif';

export const STAT_OPTIONS = {
  reading: [
    ['streak', 'Reading streak'], ['books', 'Books finished'], ['pages', 'Pages read'], ['hours', 'Reading hours'],
    ['goal', 'Yearly goal'], ['covers', 'Cover collage'],
  ],
  finance: [
    ['rate', 'Savings rate'], ['streak', 'Saving streak'], ['goals', 'Goal progress'], ['budget', 'Budget performance'], ['summary', 'Income & spending'],
  ],
  gym: [
    ['count', 'Workouts'], ['streak', 'Workout streak'], ['hours', 'Training hours'], ['consistency', 'Weekly consistency'], ['prs', 'Personal records'], ['bars', 'Weekly chart'],
  ],
  habits: [
    ['rate', 'Completion'], ['streak', 'Current streak'], ['longest', 'Longest streak'], ['checkins', 'Check-ins'], ['heatmap', 'Heatmap'],
  ],
};
export const DEFAULT_STATS = {
  reading: ['streak', 'books', 'pages', 'hours', 'goal', 'covers'],
  finance: ['rate', 'streak', 'goals', 'budget'],
  gym: ['count', 'streak', 'hours', 'consistency', 'prs', 'bars'],
  habits: ['rate', 'streak', 'longest', 'checkins', 'heatmap'],
};
const KIND_LABEL = { reading: 'Reading', finance: 'Money', gym: 'Training', habits: 'Habits' };

export function resolveRange(range, custom, today = todayKey()) {
  if (range === 'week') return { from: addDays(today, -6), to: today, label: 'This week', noun: 'week' };
  if (range === 'month') return { from: addDays(today, -29), to: today, label: 'Last 30 days', noun: 'month' };
  if (range === 'year') return { from: addDays(today, -364), to: today, label: `${fmt(addDays(today, -364), { month: 'short', year: 'numeric' })} – ${fmt(today, { month: 'short', year: 'numeric' })}`, noun: 'year' };
  const from = custom?.from && custom.from <= today ? custom.from : addDays(today, -13);
  const to = custom?.to && custom.to >= from && custom.to <= today ? custom.to : today;
  return { from, to, label: `${fmtShort(from)} – ${fmtShort(to)}${yearOf(to) !== yearOf(today) ? ` ${yearOf(to)}` : ''}`, noun: 'stretch' };
}

/* ───────────────────────── data ───────────────────────── */

export function cardData(state, kind, r, opts = {}) {
  const today = todayKey();
  const inRange = (k) => k >= r.from && k <= r.to;
  const days = diffDays(r.to, r.from) + 1;
  if (kind === 'reading') {
    const rs = readingStats(state, today);
    const sess = state.readingSessions.filter((s) => inRange(s.date));
    const pages = sess.reduce((a, s) => a + s.pages, 0);
    const minutes = sess.reduce((a, s) => a + s.minutes, 0);
    const finished = state.books.filter((b) => b.status === 'completed' && b.finishedAt && inRange(b.finishedAt));
    const readIds = [...new Set(sess.sort((a, b) => b.date.localeCompare(a.date)).map((s) => s.bookId))];
    const covers = readIds.map((id) => state.books.find((b) => b.id === id)).filter(Boolean).slice(0, 5);
    return {
      headline: { week: 'A week between pages', month: 'A month of steady reading', year: 'A year in books', stretch: 'Time well read' }[r.noun],
      hero: { streak: { value: String(rs.streak), unit: rs.streak === 1 ? 'day streak' : 'day streak' }, pages: { value: num(pages), unit: 'pages read' } },
      stats: {
        streak: { value: `${rs.streak}`, label: 'day streak' },
        books: { value: `${finished.length}`, label: finished.length === 1 ? 'book finished' : 'books finished' },
        pages: { value: num(pages), label: 'pages read' },
        hours: { value: (minutes / 60).toFixed(minutes >= 600 ? 0 : 1), label: 'hours reading' },
        goal: { value: `${rs.finishedThisYear.length}/${rs.yearGoal}`, label: `${yearOf(today)} book goal`, progress: rs.finishedThisYear.length / rs.yearGoal },
      },
      heroOrder: ['streak', 'pages'],
      visual: { covers },
    };
  }
  if (kind === 'finance') {
    const fs = financeStats(state, today);
    let income = 0, spending = 0;
    for (const t of state.transactions) {
      if (!inRange(t.date)) continue;
      if (t.type === 'income') income += t.amount;
      else if (isSpend(t)) spending += t.amount;
    }
    const rate = income ? (income - spending) / income : 0;
    const budget = (state.settings.monthlyBudget || 0) * (days / 30.4);
    const under = budget ? 1 - spending / budget : 0;
    const hide = opts.hideAmounts;
    return {
      headline: { week: 'A careful week with money', month: 'A month of mindful money', year: 'A year of saving well', stretch: 'Money, minded' }[r.noun],
      hero: { rate: { value: `${Math.round(rate * 100)}%`, unit: 'of income saved' } },
      stats: {
        rate: { value: `${Math.round(rate * 100)}%`, label: 'savings rate' },
        streak: { value: `${fs.savingsStreak}`, label: fs.savingsStreak === 1 ? 'month saving' : 'months saving' },
        goals: { value: `${Math.round(fs.goalProgress * 100)}%`, label: 'of savings goals', progress: fs.goalProgress },
        budget: { value: budget ? `${Math.abs(Math.round(under * 100))}%` : '—', label: budget ? (under >= 0 ? 'under budget' : 'over budget') : 'no budget set' },
        summary: { value: hide ? '••••' : inrCompact(income - spending), label: hide ? 'saved (hidden)' : `saved · ${inrCompact(income)} in` },
      },
      heroOrder: ['rate'],
      visual: { goals: state.goals.slice(0, 3).map((g) => ({ name: g.name, p: g.saved / g.target, text: hide ? `${Math.round((g.saved / g.target) * 100)}%` : `${inrCompact(g.saved)} / ${inrCompact(g.target)}` })) },
    };
  }
  if (kind === 'gym') {
    const gs = gymStats(state, today);
    const ws = state.workouts.filter((w) => w.completed && inRange(w.date));
    const minutes = ws.reduce((a, w) => a + w.duration, 0);
    const weeks = [];
    for (let wk = startOfWeek(r.from); wk <= r.to; wk = addDays(wk, 7)) weeks.push(wk);
    const counts = weeks.map((wk) => ws.filter((w) => startOfWeek(w.date) === wk).length);
    const judged = weeks.filter((wk) => addDays(wk, 6) <= today || counts[weeks.indexOf(wk)] >= gs.target);
    const met = judged.filter((wk) => counts[weeks.indexOf(wk)] >= gs.target).length;
    const prs = gs.prs.filter((p) => inRange(p.date)).slice(0, 3);
    return {
      headline: { week: 'A week of showing up', month: 'A month under the bar', year: 'A year of training', stretch: 'Stronger, on schedule' }[r.noun],
      hero: { count: { value: String(ws.length), unit: ws.length === 1 ? 'workout' : 'workouts' } },
      stats: {
        count: { value: String(ws.length), label: 'workouts' },
        streak: { value: String(gs.streak), label: gs.streak === 1 ? 'week streak' : 'week streak' },
        hours: { value: (minutes / 60).toFixed(minutes >= 600 ? 0 : 1), label: 'hours training' },
        consistency: { value: judged.length ? `${Math.round((met / judged.length) * 100)}%` : '—', label: `weeks at ${gs.target}+` },
      },
      heroOrder: ['count'],
      visual: { prs: prs.length ? prs : gs.prs.slice(0, 3), bars: weeks.slice(-12).map((wk, i) => counts[weeks.length - Math.min(12, weeks.length) + i]), target: gs.target },
    };
  }
  // habits
  const habits = state.habits.filter((h) => !h.archived);
  const rates = habits.map((h) => habitRate(state.habitLogs, h, r.from, r.to, today)).filter((x) => x != null);
  const rate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const cur = habits.map((h) => ({ h, s: habitStreak(state.habitLogs, h, today) })).filter((x) => x.s.unit === 'day').sort((a, b) => b.s.count - a.s.count)[0];
  const long = habits.map((h) => ({ h, s: habitLongest(state.habitLogs, h, today) })).filter((x) => x.s.unit === 'day').sort((a, b) => b.s.count - a.s.count)[0];
  let checkins = 0;
  const dayRates = {};
  for (const k of eachDay(r.from, r.to)) {
    const due = habits.filter((h) => scheduledOn(h, k));
    const d = habits.filter((h) => habitDone(state.habitLogs, h, k)).length;
    checkins += d;
    dayRates[k] = due.length ? Math.min(1, due.filter((h) => habitDone(state.habitLogs, h, k)).length / due.length) : null;
  }
  return {
    headline: { week: 'Seven days of small wins', month: 'A month of keeping promises', year: 'A year of daily practice', stretch: 'Small steps, big changes' }[r.noun],
    hero: { rate: { value: `${Math.round(rate * 100)}%`, unit: 'of habits completed' } },
    stats: {
      rate: { value: `${Math.round(rate * 100)}%`, label: 'completion' },
      streak: { value: String(cur?.s.count || 0), label: cur ? `day streak · ${cur.h.name}` : 'day streak' },
      longest: { value: String(long?.s.count || 0), label: 'longest streak' },
      checkins: { value: num(checkins), label: 'check-ins' },
    },
    heroOrder: ['rate'],
    visual: { heat: dayRates, from: r.from, to: r.to },
  };
}

/* ───────────────────────── drawing ───────────────────────── */

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lum = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

function palette(t, bg) {
  const base = TEMPLATES[t];
  if (!bg || bg === base.bg) return { ...base };
  const dark = lum(bg) < 0.5;
  return {
    ...base, bg,
    ink: dark ? '#F2F4EF' : '#171717',
    muted: dark ? rgba('#F2F4EF', 0.62) : rgba('#171717', 0.55),
    accent: dark ? '#9FD3B4' : '#174D3A',
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrap(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function spaced(ctx, text, x, y, spacing, align = 'left') {
  const chars = [...text];
  const w = chars.reduce((a, c) => a + ctx.measureText(c).width + spacing, -spacing);
  let cx0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.textAlign = 'left';
  for (const c of chars) { ctx.fillText(c, cx0, y); cx0 += ctx.measureText(c).width + spacing; }
  return w;
}

export async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load('500 120px "Newsreader"'), document.fonts.load('italic 500 80px "Newsreader"'),
      document.fonts.load('600 100px "Geist"'), document.fonts.load('400 30px "Geist"'),
      document.fonts.load('500 100px "Geist Mono"'),
    ]);
  } catch { /* fallbacks are fine */ }
}

export function drawCard(canvas, { kind, template, bg, font, size, name, stats, data, range, images = new Map() }) {
  const S = SIZES[size];
  const W = S.w, H = S.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const P = palette(template, bg);
  const F = FONTS[font];
  const disp = (wt, px, italic = false) => `${italic ? 'italic ' : ''}${wt} ${px}px "${F.family}", ${F.fallback}`;
  const body = (wt, px) => `${wt} ${px}px ${BODY}`;
  const M = size === 'post' ? 76 : 88;
  const compact = size === 'post';
  const on = (k) => stats.includes(k);

  // background
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
  if (P.glow) {
    const g = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 0.9);
    g.addColorStop(0, rgba(P.accent, 0.22)); g.addColorStop(1, rgba(P.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P.organic) {
    ctx.fillStyle = rgba(P.accent, 0.08);
    ctx.beginPath(); ctx.arc(W * 0.92, H * 0.06, W * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(P.accent, 0.06);
    ctx.beginPath(); ctx.arc(W * 0.04, H * 0.97, W * 0.42, 0, Math.PI * 2); ctx.fill();
  }
  if (template === 'modern') {
    ctx.fillStyle = rgba('#FFFFFF', 0.05);
    ctx.beginPath(); ctx.arc(W, 0, W * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textBaseline = 'alphabetic';
  // masthead
  let y = M + 26;
  ctx.fillStyle = P.ink;
  ctx.font = body(600, 24);
  spaced(ctx, 'TEND', M, y, 7);
  ctx.fillStyle = P.muted;
  ctx.font = body(500, 24);
  ctx.textAlign = 'right';
  ctx.fillText(range.label, W - M, y);
  ctx.textAlign = 'left';
  if (P.rule) { ctx.fillStyle = rgba(P.ink, 0.8); ctx.fillRect(M, y + 26, W - 2 * M, 2); ctx.fillRect(M, y + 32, W - 2 * M, 1); }

  // pick blocks
  const heroKey = data.heroOrder.find((k) => on(k)) || null;
  const hero = heroKey ? data.hero[heroKey] : null;
  const gridKeys = Object.keys(data.stats).filter((k) => on(k) && k !== heroKey);
  const visualKind = kind === 'reading' && on('covers') && data.visual.covers.length ? 'covers'
    : kind === 'finance' && on('goals') && data.visual.goals.length ? 'goals'
      : kind === 'gym' && on('prs') && data.visual.prs.length && !(on('bars') && size === 'story') ? 'prs'
        : kind === 'gym' && on('bars') ? 'bars'
          : kind === 'habits' && on('heatmap') ? 'heat' : null;
  const extraVisual = kind === 'gym' && size === 'story' && on('prs') && on('bars') && data.visual.prs.length ? 'prs' : null;

  // title
  const titleSize = compact ? 66 : size === 'portrait' ? 84 : 96;
  ctx.font = disp(F.weight, titleSize, font === 'serif' && template === 'editorial');
  const titleLines = wrap(ctx, data.headline, W - 2 * M).slice(0, 2);
  const kicker = `${name ? `${name.toUpperCase()}'S ` : ''}${KIND_LABEL[kind].toUpperCase()}`;

  const heroSize = compact ? 190 : size === 'portrait' ? 240 : 300;
  const cols = compact ? 3 : 2;
  const rowH = compact ? 132 : 184;
  const rows = Math.ceil(gridKeys.length / cols);
  const visualH = visualKind ? (compact ? 200 : size === 'portrait' ? 270 : visualKind === 'covers' ? 360 : 330) : 0;
  const extraH = extraVisual ? 250 : 0;
  const titleH = 50 + titleLines.length * titleSize * 1.05;
  const heroH = hero ? heroSize * 0.82 + 64 : 0;
  const footerH = 64;
  const top = y + 70;
  const bottom = H - M - footerH;
  let blocks = [
    { k: 'title', h: titleH }, hero && { k: 'hero', h: heroH }, visualKind && { k: 'visual', h: visualH },
    extraVisual && { k: 'extra', h: extraH }, rows && { k: 'grid', h: rows * rowH },
  ].filter(Boolean);
  const need = () => blocks.reduce((a, b) => a + b.h, 0) + 36 * blocks.length;
  if (need() > bottom - top) blocks = blocks.filter((b) => b.k !== 'extra');
  if (need() > bottom - top) blocks = blocks.filter((b) => b.k !== 'visual');
  const used = blocks.reduce((a, b) => a + b.h, 0);
  const gap = Math.max(36, (bottom - top - used) / Math.max(1, blocks.length));
  let cy = top + Math.min(gap, 90) * 0.5;

  for (const b of blocks) {
    if (b.k === 'title') {
      ctx.fillStyle = P.accent;
      ctx.font = body(600, 24);
      spaced(ctx, kicker, M, cy + 24, 5);
      ctx.fillStyle = P.ink;
      ctx.font = disp(F.weight, titleSize, font === 'serif' && template === 'editorial');
      titleLines.forEach((l, i) => ctx.fillText(l, M - 4, cy + 50 + titleSize * 0.92 + i * titleSize * 1.05));
    }
    if (b.k === 'hero') {
      ctx.fillStyle = template === 'minimal' || template === 'editorial' ? P.accent : P.ink;
      ctx.font = disp(F.weight === 600 ? 700 : 500, heroSize);
      const base = cy + heroSize * 0.8;
      ctx.fillText(hero.value, M - heroSize * 0.04, base);
      const hw = ctx.measureText(hero.value).width;
      ctx.fillStyle = P.muted;
      ctx.font = body(500, compact ? 34 : 42);
      const unitLines = wrap(ctx, hero.unit, Math.max(200, W - 2 * M - hw - 40));
      if (hw + 40 + ctx.measureText(hero.unit).width < W - 2 * M - 10 || unitLines.length <= 2) {
        unitLines.slice(0, 2).forEach((l, i) => ctx.fillText(l, M + hw + 28, base - (unitLines.length - 1 - i) * 44));
      } else {
        ctx.fillText(hero.unit, M, base + 56);
      }
    }
    if (b.k === 'visual' || b.k === 'extra') {
      const vk = b.k === 'extra' ? extraVisual : visualKind;
      drawVisual(ctx, vk, data.visual, { x: M, y: cy, w: W - 2 * M, h: b.h }, P, disp, body, images);
    }
    if (b.k === 'grid') {
      if (P.rule) { ctx.fillStyle = rgba(P.ink, 0.25); ctx.fillRect(M, cy - 8, W - 2 * M, 1); }
      const cw = (W - 2 * M - (P.tiles ? (cols - 1) * 20 : 0)) / cols;
      gridKeys.forEach((k, i) => {
        const s = data.stats[k];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = M + col * (cw + (P.tiles ? 20 : 0));
        const ty = cy + row * rowH;
        if (P.tiles) {
          ctx.fillStyle = rgba(P.ink, 0.07);
          rr(ctx, x, ty, cw, rowH - 20, 26); ctx.fill();
        }
        const ix = x + (P.tiles ? 28 : 0);
        ctx.fillStyle = P.ink;
        ctx.font = disp(F.weight, compact ? 56 : 80);
        ctx.fillText(s.value, ix, ty + (compact ? 64 : 88));
        ctx.fillStyle = P.muted;
        ctx.font = body(500, compact ? 23 : 28);
        const lab = wrap(ctx, s.label, cw - (P.tiles ? 56 : 24))[0];
        ctx.fillText(lab, ix, ty + (compact ? 98 : 128));
        if (s.progress != null && !compact) {
          const pw = cw - (P.tiles ? 56 : 40);
          ctx.fillStyle = rgba(P.ink, 0.12); rr(ctx, ix, ty + 146, pw, 8, 4); ctx.fill();
          ctx.fillStyle = P.accent; rr(ctx, ix, ty + 146, Math.max(8, pw * Math.min(1, s.progress)), 8, 4); ctx.fill();
        }
      });
    }
    cy += b.h + gap;
  }

  // footer
  const fy = H - M;
  ctx.fillStyle = rgba(P.ink, P.rule ? 0.8 : 0.15);
  ctx.fillRect(M, fy - 46, W - 2 * M, P.rule ? 2 : 1);
  ctx.fillStyle = P.muted;
  ctx.font = body(500, 22);
  ctx.fillText('Small steps, big changes.', M, fy);
  ctx.textAlign = 'right';
  ctx.fillText(fmt(todayKey(), { day: 'numeric', month: 'long', year: 'numeric' }), W - M, fy);
  ctx.textAlign = 'left';
}

function drawVisual(ctx, kind, v, box, P, disp, body, images) {
  const { x, y, w, h } = box;
  if (kind === 'covers') {
    const n = v.covers.length;
    const gap = 22;
    const cw = Math.min(176, (w - gap * (n - 1)) / n, (h - 10) / 1.5);
    const ch = cw * 1.5;
    v.covers.forEach((b, i) => {
      const cx0 = x + i * (cw + gap);
      const cy0 = y + (h - ch) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      ctx.fillStyle = b.cover || '#174D3A';
      rr(ctx, cx0, cy0, cw, ch, 8); ctx.fill();
      ctx.restore();
      const img = images.get(coverSrc(b));
      if (img) { ctx.save(); rr(ctx, cx0, cy0, cw, ch, 8); ctx.clip(); drawImageCover(ctx, img, cx0, cy0, cw, ch); ctx.restore(); return; }
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(cx0, cy0 + 4, cw * 0.06, ch - 8);
      const light = lum(b.cover || '#174D3A') > 0.62;
      ctx.fillStyle = light ? '#1B1B1B' : '#F6F3EA';
      let fs = Math.max(18, Math.round(cw / 6.6));
      ctx.font = `600 ${fs}px "Newsreader", Georgia, serif`;
      const longest = Math.max(...String(b.title).split(' ').map((wd) => ctx.measureText(wd).width));
      if (longest > cw * 0.76) { fs = Math.max(13, Math.floor(fs * (cw * 0.76) / longest)); ctx.font = `600 ${fs}px "Newsreader", Georgia, serif`; }
      wrap(ctx, b.title, cw - cw * 0.24).slice(0, 4).forEach((l, li) => ctx.fillText(l, cx0 + cw * 0.14, cy0 + cw * 0.18 + fs + li * fs * 1.08));
      ctx.globalAlpha = 0.75;
      ctx.font = `500 ${Math.max(14, fs - 6)}px "Geist", Helvetica, sans-serif`;
      ctx.fillText((b.author || '').split(' ').slice(-1)[0], cx0 + cw * 0.14, cy0 + ch - cw * 0.14);
      ctx.globalAlpha = 1;
    });
  }
  if (kind === 'goals') {
    const items = v.goals;
    const rowH = Math.min(100, h / items.length);
    items.forEach((g, i) => {
      const ty = y + i * rowH + 30;
      ctx.fillStyle = P.ink; ctx.font = body(500, 28);
      ctx.fillText(g.name, x, ty);
      ctx.fillStyle = P.muted; ctx.textAlign = 'right'; ctx.font = body(500, 26);
      ctx.fillText(g.text, x + w, ty); ctx.textAlign = 'left';
      ctx.fillStyle = rgba(P.ink, 0.12); rr(ctx, x, ty + 20, w, 14, 7); ctx.fill();
      ctx.fillStyle = P.accent; rr(ctx, x, ty + 20, Math.max(14, w * Math.min(1, g.p)), 14, 7); ctx.fill();
    });
  }
  if (kind === 'prs') {
    ctx.fillStyle = P.muted; ctx.font = body(600, 22);
    spaced(ctx, 'PERSONAL RECORDS', x, y + 22, 4);
    v.prs.slice(0, 3).forEach((p, i) => {
      const ty = y + 82 + i * 62;
      ctx.fillStyle = P.ink; ctx.font = body(500, 32);
      ctx.fillText(p.name, x, ty);
      ctx.textAlign = 'right'; ctx.font = disp(500, 38);
      ctx.fillText(`${p.weight} kg × ${p.reps}`, x + w, ty);
      ctx.textAlign = 'left';
      if (i < 2) { ctx.fillStyle = rgba(P.ink, 0.12); ctx.fillRect(x, ty + 22, w, 1); }
    });
  }
  if (kind === 'bars') {
    const vals = v.bars;
    const max = Math.max(v.target, ...vals, 1);
    const n = vals.length;
    const bw = Math.min(48, (w / n) * 0.6);
    const step = w / n;
    const ch = h - 50;
    const ty = (val) => y + ch - (val / max) * ch;
    ctx.strokeStyle = rgba(P.ink, 0.35); ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, ty(v.target)); ctx.lineTo(x + w, ty(v.target)); ctx.stroke(); ctx.setLineDash([]);
    vals.forEach((val, i) => {
      const bh = Math.max(val ? 8 : 0, (val / max) * ch);
      ctx.fillStyle = i === n - 1 ? P.accent : rgba(P.accent, 0.55);
      rr(ctx, x + i * step + (step - bw) / 2, y + ch - bh, bw, bh, Math.min(8, bw / 2)); ctx.fill();
    });
    ctx.fillStyle = P.muted; ctx.font = body(500, 22);
    ctx.fillText(`Workouts per week · dashed line is your target of ${v.target}`, x, y + h - 4);
  }
  if (kind === 'heat' && Math.ceil((diffDays(v.to, startOfWeek(v.from)) + 1) / 7) <= 6) {
    // short ranges read better as a calendar: 7 columns, one row per week
    const start = startOfWeek(v.from);
    const daysAll = eachDay(start, addDays(startOfWeek(v.to), 6));
    const weeks = daysAll.length / 7;
    const gap = 14;
    const cell = Math.min((w - gap * 6) / 7, (h - 40 - gap * (weeks - 1)) / weeks, 120);
    const gw = 7 * cell + 6 * gap;
    const ox = x + (w - gw) / 2;
    ctx.fillStyle = P.muted; ctx.font = body(500, 22); ctx.textAlign = 'center';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => ctx.fillText(d, ox + i * (cell + gap) + cell / 2, y + 22));
    ctx.textAlign = 'left';
    daysAll.forEach((k, i) => {
      const cx1 = ox + (i % 7) * (cell + gap), cy1 = y + 40 + Math.floor(i / 7) * (cell + gap);
      if (k < v.from || k > v.to) { ctx.strokeStyle = rgba(P.ink, 0.08); ctx.lineWidth = 2; rr(ctx, cx1 + 1, cy1 + 1, cell - 2, cell - 2, Math.min(18, cell * 0.24)); ctx.stroke(); return; }
      const val = v.heat[k];
      ctx.fillStyle = val == null ? rgba(P.ink, 0.04) : val <= 0 ? rgba(P.ink, 0.09) : rgba(P.accent, 0.25 + 0.75 * val);
      rr(ctx, cx1, cy1, cell, cell, Math.min(18, cell * 0.24)); ctx.fill();
    });
    return;
  }
  if (kind === 'heat') {
    const from = v.from, to = v.to;
    const start = startOfWeek(from);
    const daysAll = eachDay(start, to);
    const weeks = Math.ceil(daysAll.length / 7);
    const gap = weeks > 30 ? 4 : 8;
    const cell = Math.min((w - gap * (weeks - 1)) / weeks, (h - gap * 6) / 7, 96);
    const gw = weeks * cell + (weeks - 1) * gap;
    const ox = x + (w - gw) / 2;
    daysAll.forEach((k, i) => {
      if (k < from) return;
      const col = Math.floor(i / 7), row = i % 7;
      const val = v.heat[k];
      ctx.fillStyle = val == null ? rgba(P.ink, 0.04) : val <= 0 ? rgba(P.ink, 0.09) : rgba(P.accent, 0.25 + 0.75 * val);
      rr(ctx, ox + col * (cell + gap), y + row * (cell + gap), cell, cell, Math.min(10, cell * 0.22)); ctx.fill();
    });
  }
}

/* ───────────────────────── calendar cards ───────────────────────── */

function drawImageCover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function drawGeneratedCover(ctx, b, x, y, w, h, topPad, bare = false) {
  ctx.fillStyle = b.cover || '#174D3A';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(x, y, Math.max(3, w * 0.06), h);
  if (bare) return;
  const light = lum(b.cover || '#174D3A') > 0.62;
  ctx.fillStyle = light ? '#1B1B1B' : '#F6F3EA';
  let fs = Math.max(11, Math.round(w / 6.2));
  ctx.font = `600 ${fs}px "Newsreader", Georgia, serif`;
  const longest = Math.max(...String(b.title).split(' ').map((wd) => ctx.measureText(wd).width));
  if (longest > w * 0.82) { fs = Math.max(9, Math.floor(fs * (w * 0.82) / longest)); ctx.font = `600 ${fs}px "Newsreader", Georgia, serif`; }
  const lines = wrap(ctx, b.title, w * 0.84).slice(0, Math.max(1, Math.floor((h - topPad - 8) / (fs * 1.08))));
  lines.forEach((l, i) => ctx.fillText(l, x + w * 0.1, y + topPad + fs + i * fs * 1.08));
}

export function drawCalendarCard(canvas, { template, bg, font, size, name, data, images = new Map(), hideAmounts }) {
  const S = SIZES[size];
  const W = S.w, H = S.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const P = palette(template, bg);
  const F = FONTS[font];
  const darkCard = lum(P.bg) < 0.5;
  const hex = HEX_SLOTS[darkCard ? 'dark' : 'light'];
  const disp = (wt, px, italic = false) => `${italic ? 'italic ' : ''}${wt} ${px}px "${F.family}", ${F.fallback}`;
  const body = (wt, px) => `${wt} ${px}px ${BODY}`;
  const post = size === 'post';
  const M = post ? 64 : size === 'portrait' ? 72 : 80;

  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
  if (P.glow) {
    const g = ctx.createRadialGradient(W * 0.85, H * 0.06, 0, W * 0.85, H * 0.06, W * 0.9);
    g.addColorStop(0, rgba(P.accent, 0.2)); g.addColorStop(1, rgba(P.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P.organic) {
    ctx.fillStyle = rgba(P.accent, 0.07);
    ctx.beginPath(); ctx.arc(W * 0.95, H * 0.04, W * 0.32, 0, Math.PI * 2); ctx.fill();
  }

  // masthead
  let y = M + 24;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink; ctx.font = body(600, 24);
  spaced(ctx, 'TEND', M, y, 7);
  ctx.fillStyle = P.muted; ctx.font = body(500, 24); ctx.textAlign = 'right';
  ctx.fillText(data.label, W - M, y); ctx.textAlign = 'left';
  if (P.rule) { ctx.fillStyle = rgba(P.ink, 0.8); ctx.fillRect(M, y + 24, W - 2 * M, 2); ctx.fillRect(M, y + 30, W - 2 * M, 1); }

  // measure everything first, then centre the block between masthead and footer
  const kick = { reading: 'READING', gym: 'TRAINING', finance: 'MONEY', habits: 'HABITS' }[data.kind];
  const ts = post ? 58 : size === 'portrait' ? 70 : 84;
  ctx.font = disp(F.weight, ts, font === 'serif' && template === 'editorial');
  const title = data.kind === 'habits' && data.habit ? data.habit.name : data.title;
  const tl = wrap(ctx, title, W - 2 * M).slice(0, 2);
  const titleH = 18 + ts * 1.04 * tl.length + (post ? 22 : 40);
  const footerH = 64;
  const summaryH = post ? 112 : size === 'portrait' ? 140 : 168;
  const legendH = data.legend?.length ? 52 : 0;
  const top = y + (post ? 46 : 60);
  const { first, last, cells, rows } = monthGrid(data.month);
  const gap = post ? 9 : 14;
  const dowH = 38;
  const cw = (W - 2 * M - gap * 6) / 7;
  const SP = post ? 26 : 50;
  const room = H - M - footerH - top - titleH - summaryH - legendH - SP - 10;
  const ch = Math.max(40, Math.min(cw * (size === 'story' ? 1.6 : 1.42), (room - dowH - gap * (rows - 1)) / rows));
  const gridH = dowH + rows * ch + (rows - 1) * gap;
  const blockH = titleH + gridH + legendH + summaryH + SP;
  y = top + Math.max(0, (H - M - footerH - 10 - top - blockH) / 2);

  ctx.fillStyle = P.accent; ctx.font = body(600, 23);
  spaced(ctx, `${name ? `${name.toUpperCase()}'S ` : ''}${kick}`, M, y, 5);
  ctx.fillStyle = P.ink; ctx.font = disp(F.weight, ts, font === 'serif' && template === 'editorial');
  tl.forEach((l, i) => ctx.fillText(l, M - 3, y + 18 + ts * 0.9 + i * ts * 1.04));
  y += titleH;

  const gw = cw * 7 + gap * 6;
  const ox = M + (W - 2 * M - gw) / 2;
  ctx.fillStyle = P.muted; ctx.font = body(500, post ? 20 : 23); ctx.textAlign = 'center';
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d, i) => ctx.fillText(d, ox + i * (cw + gap) + cw / 2, y + 24));
  ctx.textAlign = 'left';
  const gy = y + dowH;
  const rad = Math.min(18, cw * 0.16);
  const numSize = Math.max(18, Math.min(32, cw * 0.22));
  const today = todayKey();

  cells.forEach((k, i) => {
    const x = ox + (i % 7) * (cw + gap);
    const ty = gy + Math.floor(i / 7) * (ch + gap);
    const inMonth = k >= first && k <= last;
    if (!inMonth) return;
    const tile = data.tiles[k];
    let numColor = P.ink;
    const stroke = (a, dash) => {
      ctx.save(); ctx.strokeStyle = rgba(P.ink, a); ctx.lineWidth = 2; if (dash) ctx.setLineDash([7, 6]);
      rr(ctx, x + 1, ty + 1, cw - 2, ch - 2, rad); ctx.stroke(); ctx.restore();
    };
    if (data.kind === 'reading') {
      if (tile?.books?.length) {
        ctx.save(); rr(ctx, x, ty, cw, ch, rad); ctx.clip();
        const n = tile.books.length;
        tile.books.forEach((b, bi) => {
          const sx = x + (cw / n) * bi, sw = cw / n;
          ctx.save(); ctx.beginPath(); ctx.rect(sx, ty, sw, ch); ctx.clip();
          const img = images.get(coverSrc(b));
          if (img) drawImageCover(ctx, img, sx, ty, sw, ch);
          else drawGeneratedCover(ctx, b, sx, ty, sw, ch, numSize + 18, sw < 80);
          ctx.restore();
        });
        const g = ctx.createLinearGradient(0, ty, 0, ty + ch * 0.4);
        g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x, ty, cw, ch * 0.4);
        ctx.restore();
        numColor = '#FFFFFF';
      } else stroke(k > today ? 0.06 : 0.14);
    } else if (data.kind === 'gym') {
      if (tile) {
        ctx.fillStyle = hex[tile.color]; rr(ctx, x, ty, cw, ch, rad); ctx.fill();
        numColor = '#FFFFFF';
        ctx.fillStyle = '#FFFFFF'; ctx.font = body(700, Math.max(15, cw * 0.17)); ctx.textAlign = 'center';
        ctx.fillText(`${tile.label}${tile.more ? ` +${tile.more}` : ''}`, x + cw / 2, ty + ch - Math.max(12, ch * 0.12));
        ctx.textAlign = 'left';
      } else stroke(k > today ? 0.06 : 0.14);
    } else if (data.kind === 'finance') {
      if (tile) {
        if (tile.amount) { ctx.fillStyle = rgba(hex[2], 0.12 + tile.level * 0.82); rr(ctx, x, ty, cw, ch, rad); ctx.fill(); }
        else stroke(0.14);
        const strong = tile.level > 0.55;
        numColor = strong ? '#FFFFFF' : P.ink;
        if (!hideAmounts) {
          ctx.fillStyle = strong ? '#FFFFFF' : tile.amount ? P.ink : P.muted;
          ctx.font = body(600, Math.max(14, cw * 0.155)); ctx.textAlign = 'center';
          ctx.fillText(tile.text, x + cw / 2, ty + ch - Math.max(12, ch * 0.12));
          ctx.textAlign = 'left';
        }
      } else stroke(0.06);
    } else {
      const c = data.habit ? hex[data.color] : P.accent;
      const st = tile?.state || 'off';
      if (st === 'done') { ctx.fillStyle = c; rr(ctx, x, ty, cw, ch, rad); ctx.fill(); numColor = darkCard && !data.habit ? P.bg : '#FFFFFF'; }
      else if (st === 'part') { ctx.fillStyle = rgba(c, 0.18 + (tile.level || 0) * 0.45); rr(ctx, x, ty, cw, ch, rad); ctx.fill(); }
      else if (st === 'miss') stroke(0.32, true);
      else if (st === 'off') { ctx.fillStyle = rgba(P.ink, 0.045); rr(ctx, x, ty, cw, ch, rad); ctx.fill(); numColor = P.muted; }
      else stroke(st === 'future' ? 0.06 : 0.14);
    }
    ctx.fillStyle = numColor;
    ctx.font = body(600, numSize); ctx.textAlign = 'center';
    if (numColor === '#FFFFFF' && data.kind === 'reading') { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; }
    ctx.fillText(String(Number(k.slice(8))), x + cw / 2, ty + numSize + Math.max(8, ch * 0.07));
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    ctx.textAlign = 'left';
  });

  // legend
  let ly = gy + rows * ch + (rows - 1) * gap + (data.legend?.length ? 34 : 0);
  if (data.legend?.length) {
    let lx = M;
    ctx.font = body(500, 24);
    data.legend.forEach((l) => {
      ctx.fillStyle = hex[l.color]; rr(ctx, lx, ly - 18, 20, 20, 5); ctx.fill();
      ctx.fillStyle = P.muted; const t = `${l.label} ${l.count}`;
      ctx.fillText(t, lx + 30, ly); lx += 30 + ctx.measureText(t).width + 30;
    });
    ly += legendH - 10;
  }

  // summary
  const sy = ly + (data.legend?.length ? 4 : SP);
  if (P.rule) { ctx.fillStyle = rgba(P.ink, 0.25); ctx.fillRect(M, sy - 14, W - 2 * M, 1); }
  const colW = (W - 2 * M) / 3;
  data.summary.forEach((s, i) => {
    const x = M + i * colW;
    ctx.fillStyle = P.ink; ctx.font = disp(F.weight, post ? 50 : size === 'portrait' ? 62 : 74);
    ctx.fillText(s.value, x, sy + (post ? 52 : size === 'portrait' ? 64 : 76));
    ctx.fillStyle = P.muted; ctx.font = body(500, post ? 21 : 25);
    ctx.fillText(wrap(ctx, s.label, colW - 16)[0], x, sy + (post ? 86 : size === 'portrait' ? 102 : 118));
  });

  // footer
  const fy = H - M;
  ctx.fillStyle = rgba(P.ink, P.rule ? 0.8 : 0.15);
  ctx.fillRect(M, fy - 44, W - 2 * M, P.rule ? 2 : 1);
  ctx.fillStyle = P.muted; ctx.font = body(500, 22);
  ctx.fillText('Small steps, big changes.', M, fy);
  ctx.textAlign = 'right';
  ctx.fillText(fmt(todayKey(), { day: 'numeric', month: 'long', year: 'numeric' }), W - M, fy);
  ctx.textAlign = 'left';
}
