// Digital bookshelf: data model, auto-arrangement and a canvas renderer.
// The editor preview and the exported PNG are the same canvas drawing, so
// what you arrange is exactly what you share.
import { SIZES, FONTS } from './share.js';
import { coverSrc } from './calendar.js';
import { todayKey, yearOf } from './date.js';
import { uid } from './format.js';

export const SPINE_COLORS = ['#2E3B6E', '#7A2E3A', '#C8643B', '#E7B7A8', '#B9A6E0', '#D9B44A', '#E8E2D0', '#3B6E5A', '#1F1F24', '#8FA8C8', '#9A5A34', '#5B4B8A'];
export const PATTERNS = [
  ['plain', 'Plain'], ['bands', 'Bands'], ['label', 'Label'], ['diamonds', 'Diamonds'], ['dots', 'Dots'], ['arch', 'Arch'],
];
export const ORIENTS = [['up', 'Upright'], ['leanL', 'Lean left'], ['leanR', 'Lean right'], ['flat', 'Lie flat'], ['face', 'Cover out']];
export const DECOR = {
  cactus: 'Cactus', pilea: 'Leafy plant', trailing: 'Trailing plant', mug: 'Mug', candle: 'Candle',
  globe: 'Globe', cat: 'Cat', frame: 'Picture', hourglass: 'Hourglass', bookend: 'Bookend',
};
export const POT_COLORS = ['#C8643B', '#E7B7A8', '#F1EDE4', '#9CB8A4', '#2F3432', '#D9B44A', '#8FA8C8'];
export const BACKGROUNDS = {
  paper: { label: 'Paper', color: '#F3EFE6' }, linen: { label: 'Linen', color: '#FBF8F2' }, sage: { label: 'Sage', color: '#DCE6DC' },
  blush: { label: 'Blush', color: '#F4E1DA' }, sky: { label: 'Sky', color: '#DCE7F2' }, night: { label: 'Night', color: '#1B2220' },
};
export const WOODS = {
  walnut: { label: 'Walnut', color: '#7A4A2E' }, oak: { label: 'Oak', color: '#B07A4A' }, clay: { label: 'Clay', color: '#B9614A' },
  white: { label: 'White', color: '#E6E0D4' }, black: { label: 'Black', color: '#2B2B2B' },
};

const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const lum = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const shade = (hex, amt) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export function spineColor(item, book) {
  if (item.color) return item.color;
  if (book?.cover && /^#[0-9a-f]{6}$/i.test(book.cover)) return book.cover;
  return SPINE_COLORS[hash(item.bookId || item.id) % SPINE_COLORS.length];
}
export function spinePattern(item) {
  if (item.pattern) return item.pattern;
  const opts = ['plain', 'bands', 'label', 'bands', 'plain', 'diamonds', 'dots', 'arch', 'label'];
  return opts[hash(item.bookId || item.id) % opts.length];
}
const heightOf = (item) => (item.h != null ? item.h : 0.35 + (hash(`${item.bookId}h`) % 60) / 100);

/* ───────────────────────── auto-arrange ───────────────────────── */

export function autoShelf(state, prev) {
  const rank = { reading: 0, completed: 1, paused: 2, want: 3 };
  const books = [...state.books].sort((a, b) => rank[a.status] - rank[b.status]
    || (b.finishedAt || b.lastReadAt || '').localeCompare(a.finishedAt || a.lastReadAt || ''));
  const n = Math.max(2, Math.min(5, Math.ceil(books.length / 4)));
  const rows = Array.from({ length: n }, () => []);
  books.forEach((b, i) => rows[i % n].push(b));
  const decorCycle = ['cactus', 'mug', 'pilea', 'globe', 'candle', 'cat', 'frame', 'trailing', 'hourglass'];
  let d = 0;
  const shelves = rows.map((row, ri) => {
    const items = row.map((b) => ({ id: uid(), kind: 'book', bookId: b.id, orient: 'up' }));
    const motif = ri % 4;
    if (motif === 0 && items.length >= 3) { items[0].orient = 'flat'; items[1].orient = 'flat'; }
    if (motif === 1 && items.length >= 2) items[items.length - 1].orient = 'leanR';
    if (motif === 2 && items.length >= 3) { items[items.length - 1].orient = 'flat'; items[items.length - 2].orient = 'flat'; }
    if (motif === 3 && items.length >= 2) items[0].orient = 'leanL';
    const deco = { id: uid(), kind: 'decor', type: decorCycle[d++ % decorCycle.length], color: POT_COLORS[ri % POT_COLORS.length], size: 1 };
    if (ri % 2 === 0) items.push(deco); else items.unshift(deco);
    if (row.length <= 1) items.push({ id: uid(), kind: 'decor', type: decorCycle[d++ % decorCycle.length], color: POT_COLORS[(ri + 3) % POT_COLORS.length], size: 1 });
    return items;
  });
  // the book you're reading faces out on the top shelf
  const cur = books.find((b) => b.status === 'reading');
  if (cur) {
    const it = shelves[0].find((x) => x.bookId === cur.id);
    if (it) it.orient = 'face';
  }
  return {
    title: prev?.title || 'My bookshelf',
    bg: prev?.bg || 'paper', wood: prev?.wood || 'walnut',
    showTitles: prev?.showTitles ?? true, showStats: prev?.showStats ?? true,
    shelves,
  };
}

/* ───────────────────────── geometry ───────────────────────── */

const LEAN = 0.2; // radians

function itemDims(item, book, U) {
  const k = 0.78 + 0.2 * heightOf(item);
  if (item.kind === 'decor') {
    const s = (item.size || 1) * U;
    const m = { cactus: [0.5, 0.64], pilea: [0.64, 0.64], trailing: [0.46, 0.4], mug: [0.4, 0.28], candle: [0.26, 0.36], globe: [0.42, 0.64], cat: [0.44, 0.5], frame: [0.5, 0.6], hourglass: [0.26, 0.44], bookend: [0.22, 0.5] }[item.type] || [0.4, 0.4];
    return { w: m[0] * s, h: Math.min(U * 1.02, m[1] * s) };
  }
  const pages = book?.totalPages || 300;
  const bw = U * (0.12 + Math.min(0.08, pages / 5000));
  const bh = U * k;
  if (item.orient === 'flat') return { w: bh * 0.78, h: bw * 0.85, bw, bh };
  if (item.orient === 'face') return { w: bh * 0.66, h: bh, bw, bh };
  if (item.orient === 'leanL' || item.orient === 'leanR') return { w: bw * Math.cos(LEAN) + bh * Math.sin(LEAN), h: bh * Math.cos(LEAN) + bw * Math.sin(LEAN), bw, bh };
  return { w: bw, h: bh, bw, bh };
}

/** Compute every item's box for a layout. Returns { units, boxes, frame } in card pixels. */
export function layoutShelf(shelf, books, size) {
  const S = SIZES[size];
  const W = S.w, H = S.h;
  const post = size === 'post';
  const M = post ? 64 : 76;
  const headH = post ? 170 : size === 'portrait' ? 210 : 270;
  const footH = shelf.showStats ? (post ? 90 : 120) : 60;
  const top = M + headH;
  const bottom = H - M - footH;
  const n = shelf.shelves.length;
  const pitch = (bottom - top) / n;
  const board = Math.max(14, Math.min(24, pitch * 0.07));
  const U = Math.min(pitch - board - (post ? 20 : 30), (W - 2 * M) * 0.5);
  const byId = Object.fromEntries(books.map((b) => [b.id, b]));
  const rows = [];
  const boxes = [];
  shelf.shelves.forEach((items, si) => {
    const baseY = top + pitch * (si + 1) - board;
    // group consecutive flat books into stacks
    const units = [];
    items.forEach((it, ii) => {
      const book = it.kind === 'book' ? byId[it.bookId] : null;
      if (it.kind === 'book' && !book) return;
      const d = itemDims(it, book, U);
      const last = units[units.length - 1];
      if (it.kind === 'book' && it.orient === 'flat' && last?.stack) last.parts.push({ it, ii, book, d });
      else if (it.kind === 'book' && it.orient === 'flat') units.push({ stack: true, parts: [{ it, ii, book, d }] });
      else units.push({ stack: false, parts: [{ it, ii, book, d }] });
    });
    const gapOf = (u, next) => (!next ? 0 : (u.parts[0].it.kind === 'decor' || next.parts[0].it.kind === 'decor' || u.stack || next.stack) ? U * 0.07 : U * 0.008);
    const widths = units.map((u) => (u.stack ? Math.max(...u.parts.map((p) => p.d.w)) : u.parts[0].d.w));
    const inner = W - 2 * M - 2 * U * 0.06;
    const natural = widths.reduce((a, b) => a + b, 0) + units.reduce((a, u, i) => a + gapOf(u, units[i + 1]), 0);
    const scale = natural > inner ? inner / natural : 1;
    // spread a sparse shelf out a little and centre it, so it looks arranged rather than pushed left
    const extra = Math.max(0, inner - natural * scale);
    const spread = units.length > 1 ? Math.min(extra / (units.length + 1), U * 0.22) : 0;
    let x = M + U * 0.06 + (extra - spread * (units.length - 1)) / 2;
    units.forEach((u, ui) => {
      const w = widths[ui] * scale;
      if (u.stack) {
        let y = baseY;
        u.parts.forEach((p, pi) => {
          const pw = p.d.w * scale, ph = p.d.h * scale;
          const jitter = ((hash(p.it.id) % 7) - 3) * U * 0.012 * scale;
          const px = x + (w - pw) / 2 + jitter;
          boxes.push({ id: p.it.id, si, ii: p.ii, x: px, y: y - ph, w: pw, h: ph, it: p.it, book: p.book, d: p.d, s: scale, stackPos: pi });
          y -= ph;
        });
      } else {
        const p = u.parts[0];
        const ph = p.d.h * scale;
        boxes.push({ id: p.it.id, si, ii: p.ii, x, y: baseY - ph, w, h: ph, it: p.it, book: p.book, d: p.d, s: scale });
      }
      x += w + gapOf(u, units[ui + 1]) * scale + spread;
    });
    rows.push({ si, baseY, top: baseY - pitch + board, bottom: baseY + board, x0: M, x1: W - M });
  });
  return { W, H, M, top, bottom, headH, footH, pitch, board, U, rows, boxes };
}

/* ───────────────────────── drawing ───────────────────────── */

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fitText(ctx, text, maxW, font, startPx, minPx = 10) {
  let px = startPx;
  ctx.font = font(px);
  while (px > minPx && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = font(px); }
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trim()}…`;
}

// A spine drawn in a local frame: (0,0) bottom-left, width w, height h, growing up.
function drawSpine(ctx, w, h, item, book, showTitles) {
  const c = spineColor(item, book);
  const dark = lum(c) < 0.55;
  const ink = dark ? '#F6F1E6' : '#2A2622';
  const accent = dark ? '#E2C27A' : shade(c, -0.45);
  const r = Math.min(4, w * 0.12);
  ctx.fillStyle = c;
  rr(ctx, 0, -h, w, h, r); ctx.fill();
  // soft edge shading
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(w * 0.82, -h + r, w * 0.18, h - 2 * r);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(w * 0.06, -h + r, w * 0.1, h - 2 * r);
  const pat = spinePattern(item);
  ctx.fillStyle = accent; ctx.strokeStyle = accent;
  const band = (y, t) => ctx.fillRect(w * 0.08, -y - t, w * 0.84, t);
  let textTop = h * 0.9, textBottom = h * 0.1;
  if (pat === 'bands') {
    band(h * 0.08, h * 0.018); band(h * 0.115, h * 0.008); band(h * 0.88, h * 0.018); band(h * 0.855, h * 0.008);
    textBottom = h * 0.15; textTop = h * 0.82;
  } else if (pat === 'label') {
    ctx.fillStyle = dark ? 'rgba(246,241,230,0.92)' : 'rgba(255,255,255,0.75)';
    rr(ctx, w * 0.16, -h * 0.82, w * 0.68, h * 0.62, Math.min(3, w * 0.1)); ctx.fill();
    ctx.fillStyle = accent; band(h * 0.06, h * 0.012);
    textBottom = h * 0.23; textTop = h * 0.79;
  } else if (pat === 'diamonds') {
    for (let i = 0; i < 4; i++) {
      const cy = -h * (0.32 + i * 0.12), s = Math.min(w * 0.28, h * 0.045);
      ctx.beginPath(); ctx.moveTo(w / 2, cy - s); ctx.lineTo(w / 2 + s, cy); ctx.lineTo(w / 2, cy + s); ctx.lineTo(w / 2 - s, cy); ctx.closePath(); ctx.fill();
    }
    band(h * 0.08, h * 0.012); band(h * 0.9, h * 0.012);
    textTop = 0;
  } else if (pat === 'dots') {
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(w / 2, -h * (0.26 + i * 0.09), Math.min(w * 0.13, h * 0.02), 0, Math.PI * 2); ctx.fill(); }
    textTop = 0;
  } else if (pat === 'arch') {
    const aw = w * 0.56, ah = h * 0.34, ax = (w - aw) / 2, ay = -h * 0.66;
    ctx.lineWidth = Math.max(1.5, w * 0.06);
    ctx.beginPath(); ctx.moveTo(ax, ay + ah); ctx.lineTo(ax, ay + aw / 2); ctx.arc(w / 2, ay + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.closePath(); ctx.stroke();
    band(h * 0.12, h * 0.01);
    textTop = 0;
  }
  if (showTitles && textTop > textBottom && book?.title && w > 14) {
    const len = textTop - textBottom;
    ctx.save();
    ctx.translate(w / 2, -textBottom);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = pat === 'label' ? '#2A2622' : ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const t = fitText(ctx, book.title, len, (px) => `600 ${px}px "Newsreader", Georgia, serif`, Math.min(w * 0.5, 30), 9);
    ctx.fillText(t, 0, w * 0.04);
    ctx.restore();
  }
}

function drawFlat(ctx, x, y, w, h, item, book, showTitles) {
  // book lying down: spine faces out, pages visible on the right end
  const pagesW = Math.min(w * 0.06, 10);
  ctx.fillStyle = '#F4EEE0';
  rr(ctx, x + w - pagesW - 3, y + h * 0.1, pagesW + 3, h * 0.8, 2); ctx.fill();
  ctx.save();
  // a spine of thickness h and length (w - pagesW), turned to lie along the shelf
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 2);
  // lying flat, the title is the point: decorative designs fall back to bands
  const flatItem = ['diamonds', 'dots', 'arch'].includes(spinePattern(item)) ? { ...item, pattern: 'bands' } : item;
  drawSpine(ctx, h, w - pagesW, flatItem, book, showTitles);
  ctx.restore();
}

function drawFace(ctx, x, y, w, h, item, book, images) {
  const img = images?.get(coverSrc(book));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.fillStyle = spineColor(item, book);
  rr(ctx, x, y, w, h, 6); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  rr(ctx, x, y, w, h, 6); ctx.clip();
  if (img) {
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    const c = spineColor(item, book);
    const ink = lum(c) < 0.55 ? '#F6F1E6' : '#2A2622';
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y, w * 0.06, h);
    ctx.fillStyle = ink;
    let fs = Math.max(12, w / 6.5);
    ctx.font = `600 ${fs}px "Newsreader", Georgia, serif`;
    const words = String(book.title).split(' ');
    const widest = Math.max(...words.map((wd) => ctx.measureText(wd).width));
    if (widest > w * 0.78) { fs = Math.max(10, fs * (w * 0.78) / widest); ctx.font = `600 ${fs}px "Newsreader", Georgia, serif`; }
    const lines = [];
    let line = '';
    for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (ctx.measureText(t).width > w * 0.8 && line) { lines.push(line); line = wd; } else line = t; }
    if (line) lines.push(line);
    lines.slice(0, 5).forEach((l, i) => ctx.fillText(l, x + w * 0.12, y + h * 0.14 + fs + i * fs * 1.08));
    ctx.globalAlpha = 0.75;
    ctx.font = `500 ${Math.max(10, fs * 0.6)}px "Geist", Helvetica, sans-serif`;
    ctx.fillText(String(book.author || '').split(' ').slice(-1)[0], x + w * 0.12, y + h * 0.9);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function pot(ctx, cx, baseY, w, h, color) {
  const top = baseY - h;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + h * 0.18); ctx.lineTo(cx + w / 2, top + h * 0.18);
  ctx.lineTo(cx + w * 0.38, baseY); ctx.lineTo(cx - w * 0.38, baseY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(color, -0.12);
  rr(ctx, cx - w * 0.54, top, w * 1.08, h * 0.22, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - w * 0.3, top + h * 0.3, w * 0.08, h * 0.55);
}

export function drawDecor(ctx, type, x, baseY, w, h, color = '#C8643B', dark = false) {
  const cx = x + w / 2;
  const green = '#5E7F4A', green2 = '#7E9B5C', leaf = '#6F8F55';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (type === 'cactus') {
    const ph = h * 0.32;
    const arm = (ax, ay, aw, ah) => { ctx.fillStyle = green; rr(ctx, ax - aw / 2, ay - ah, aw, ah, aw / 2); ctx.fill(); ctx.strokeStyle = green2; ctx.lineWidth = Math.max(1, aw * 0.08); ctx.beginPath(); ctx.moveTo(ax, ay - ah + aw * 0.4); ctx.lineTo(ax, ay - 2); ctx.stroke(); };
    arm(cx, baseY - ph * 0.8, w * 0.26, h * 0.68);
    arm(cx - w * 0.22, baseY - ph * 0.8, w * 0.18, h * 0.42);
    arm(cx + w * 0.22, baseY - ph * 0.8, w * 0.18, h * 0.5);
    pot(ctx, cx, baseY, w * 0.78, ph, color);
  } else if (type === 'pilea') {
    const ph = h * 0.34;
    ctx.strokeStyle = green; ctx.lineWidth = Math.max(1.5, w * 0.02);
    const leaves = [[-0.42, 0.78], [-0.25, 0.95], [0, 1], [0.24, 0.92], [0.4, 0.74], [-0.12, 0.66], [0.14, 0.62], [-0.36, 0.5], [0.36, 0.48]];
    leaves.forEach(([dx, dy]) => {
      const lx = cx + dx * w, ly = baseY - ph - (h - ph) * dy * 0.9;
      ctx.beginPath(); ctx.moveTo(cx, baseY - ph * 0.9); ctx.quadraticCurveTo(cx + dx * w * 0.3, ly + (h - ph) * 0.2, lx, ly); ctx.stroke();
    });
    leaves.forEach(([dx, dy], i) => {
      const lx = cx + dx * w, ly = baseY - ph - (h - ph) * dy * 0.9, r = w * (0.1 + (i % 3) * 0.015);
      ctx.fillStyle = i % 2 ? leaf : green; ctx.beginPath(); ctx.ellipse(lx, ly, r, r * 0.86, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(lx, ly, r * 0.18, 0, Math.PI * 2); ctx.fill();
    });
    pot(ctx, cx, baseY, w * 0.62, ph, color);
  } else if (type === 'trailing') {
    const ph = h * 0.55;
    ctx.strokeStyle = green; ctx.lineWidth = Math.max(1.5, w * 0.025);
    [[-0.32, 1.25], [-0.1, 1.6], [0.18, 1.1], [0.36, 1.45]].forEach(([dx, len], vi) => {
      const sx = cx + dx * w, sy = baseY - ph * 0.85;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + dx * w * 0.8, sy + h * 0.3, sx - dx * w * 0.2, sy + h * len * 0.6, sx + dx * w * 0.5, sy + h * len);
      ctx.stroke();
      for (let k = 1; k <= 5; k++) {
        const t = k / 6, py = sy + h * len * t, px = sx + dx * w * (0.4 + 0.3 * Math.sin(t * 3 + vi));
        ctx.fillStyle = k % 2 ? green : leaf;
        ctx.beginPath(); ctx.ellipse(px + (k % 2 ? 5 : -5), py, w * 0.07, w * 0.045, k % 2 ? 0.6 : -0.6, 0, Math.PI * 2); ctx.fill();
      }
    });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? leaf : green; ctx.beginPath(); ctx.ellipse(cx + (k - 2) * w * 0.14, baseY - ph * 1.02, w * 0.1, w * 0.065, (k - 2) * 0.4, 0, Math.PI * 2); ctx.fill(); }
    pot(ctx, cx, baseY, w * 0.82, ph, color);
  } else if (type === 'mug') {
    const mw = w * 0.74, mh = h;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, w * 0.09);
    ctx.beginPath(); ctx.ellipse(x + mw + w * 0.02, baseY - mh * 0.52, w * 0.16, mh * 0.24, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = color; rr(ctx, x, baseY - mh, mw, mh, mw * 0.14); ctx.fill();
    ctx.fillStyle = shade(color, -0.15); ctx.fillRect(x, baseY - mh, mw, mh * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + mw * 0.14, baseY - mh * 0.78, mw * 0.08, mh * 0.5);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'; ctx.lineWidth = Math.max(1.5, w * 0.03);
    [0.3, 0.55].forEach((f) => { ctx.beginPath(); ctx.moveTo(x + mw * f, baseY - mh * 1.12); ctx.bezierCurveTo(x + mw * f - 8, baseY - mh * 1.35, x + mw * f + 8, baseY - mh * 1.5, x + mw * f, baseY - mh * 1.7); ctx.stroke(); });
  } else if (type === 'candle') {
    const jw = w, jh = h * 0.7;
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, x, baseY - jh, jw, jh, jw * 0.18); ctx.fill();
    ctx.fillStyle = color; rr(ctx, x + jw * 0.08, baseY - jh * 0.78, jw * 0.84, jh * 0.74, jw * 0.12); ctx.fill();
    ctx.fillStyle = '#F2E6CE'; ctx.fillRect(x + jw * 0.08, baseY - jh * 0.78, jw * 0.84, jh * 0.1);
    ctx.strokeStyle = '#3A2E26'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, baseY - jh * 0.78); ctx.lineTo(cx, baseY - jh * 0.86); ctx.stroke();
    const fy = baseY - jh * 0.86;
    ctx.fillStyle = '#F5B841'; ctx.beginPath(); ctx.moveTo(cx, fy - h * 0.28); ctx.quadraticCurveTo(cx + jw * 0.2, fy - h * 0.08, cx, fy); ctx.quadraticCurveTo(cx - jw * 0.2, fy - h * 0.08, cx, fy - h * 0.28); ctx.fill();
    ctx.fillStyle = '#FBE3A0'; ctx.beginPath(); ctx.ellipse(cx, fy - h * 0.07, jw * 0.06, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'globe') {
    const r = Math.min(w * 0.46, h * 0.33), gy = baseY - h * 0.2 - r - h * 0.06;
    ctx.fillStyle = shade(color, -0.3); rr(ctx, cx - w * 0.3, baseY - h * 0.07, w * 0.6, h * 0.07, 4); ctx.fill();
    ctx.fillRect(cx - w * 0.03, gy + r, w * 0.06, baseY - h * 0.07 - gy - r);
    ctx.strokeStyle = shade(color, -0.3); ctx.lineWidth = Math.max(2, w * 0.04);
    ctx.beginPath(); ctx.arc(cx, gy, r * 1.14, Math.PI * 0.55, Math.PI * 1.45 + Math.PI); ctx.stroke();
    ctx.fillStyle = '#8FB8D8'; ctx.beginPath(); ctx.arc(cx, gy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9CB86E';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.3, gy - r * 0.25, r * 0.38, r * 0.26, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.35, gy + r * 0.3, r * 0.3, r * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, gy, r * 0.45, r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r, gy); ctx.lineTo(cx + r, gy); ctx.stroke();
  } else if (type === 'cat') {
    const body = dark ? '#E9E1D3' : '#2C2A29';
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(cx, baseY - h * 0.3, w * 0.36, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    const hr = w * 0.22, hy = baseY - h * 0.7;
    ctx.beginPath(); ctx.arc(cx - w * 0.05, hy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - w * 0.24, hy - hr * 0.5); ctx.lineTo(cx - w * 0.2, hy - hr * 1.55); ctx.lineTo(cx - w * 0.06, hy - hr * 0.9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + w * 0.14, hy - hr * 0.5); ctx.lineTo(cx + w * 0.1, hy - hr * 1.55); ctx.lineTo(cx - w * 0.02, hy - hr * 0.9); ctx.fill();
    ctx.strokeStyle = body; ctx.lineWidth = Math.max(3, w * 0.08);
    ctx.beginPath(); ctx.moveTo(cx + w * 0.3, baseY - h * 0.08); ctx.bezierCurveTo(cx + w * 0.62, baseY - h * 0.1, cx + w * 0.55, baseY - h * 0.5, cx + w * 0.4, baseY - h * 0.55); ctx.stroke();
    ctx.fillStyle = '#E8C547';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.12, hy, hr * 0.17, hr * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.03, hy, hr * 0.17, hr * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; rr(ctx, cx - w * 0.2, hy + hr * 0.75, w * 0.3, h * 0.04, 3); ctx.fill();
  } else if (type === 'frame') {
    ctx.save();
    ctx.translate(x + w * 0.1, baseY);
    ctx.rotate(-0.1);
    const fw = w * 0.86, fh = h * 0.96;
    ctx.fillStyle = color; rr(ctx, 0, -fh, fw, fh, 4); ctx.fill();
    const p = fw * 0.12;
    ctx.fillStyle = '#F6EFDF'; ctx.fillRect(p, -fh + p, fw - 2 * p, fh - 2 * p);
    ctx.fillStyle = '#F2B66B'; ctx.beginPath(); ctx.arc(fw * 0.66, -fh * 0.62, fw * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7E9B5C'; ctx.beginPath(); ctx.moveTo(p, -p); ctx.lineTo(fw * 0.4, -fh * 0.55); ctx.lineTo(fw * 0.62, -fh * 0.35); ctx.lineTo(fw * 0.78, -fh * 0.48); ctx.lineTo(fw - p, -fh * 0.3); ctx.lineTo(fw - p, -p); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (type === 'hourglass') {
    const fw = w, fh = h;
    ctx.fillStyle = shade(color, -0.25);
    rr(ctx, x, baseY - fh * 0.08, fw, fh * 0.08, 3); ctx.fill(); rr(ctx, x, baseY - fh, fw, fh * 0.08, 3); ctx.fill();
    ctx.fillRect(x + fw * 0.08, baseY - fh * 0.92, fw * 0.08, fh * 0.84); ctx.fillRect(x + fw * 0.84, baseY - fh * 0.92, fw * 0.08, fh * 0.84);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(x + fw * 0.2, baseY - fh * 0.92); ctx.lineTo(x + fw * 0.8, baseY - fh * 0.92); ctx.lineTo(cx + fw * 0.06, baseY - fh * 0.5); ctx.lineTo(x + fw * 0.8, baseY - fh * 0.08); ctx.lineTo(x + fw * 0.2, baseY - fh * 0.08); ctx.lineTo(cx - fw * 0.06, baseY - fh * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E2B65C';
    ctx.beginPath(); ctx.moveTo(x + fw * 0.3, baseY - fh * 0.8); ctx.lineTo(x + fw * 0.7, baseY - fh * 0.8); ctx.lineTo(cx, baseY - fh * 0.54); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + fw * 0.24, baseY - fh * 0.08); ctx.lineTo(x + fw * 0.76, baseY - fh * 0.08); ctx.lineTo(cx, baseY - fh * 0.3); ctx.closePath(); ctx.fill();
  } else if (type === 'bookend') {
    ctx.fillStyle = color;
    rr(ctx, x, baseY - h * 0.12, w, h * 0.12, 3); ctx.fill();
    rr(ctx, x + w * 0.55, baseY - h, w * 0.45, h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + w * 0.62, baseY - h * 0.9, w * 0.08, h * 0.7);
  }
  ctx.restore();
}

/**
 * Draw the whole shelf card. opts: { size, name, stats:{books, pages, year}, images, selectedId, dragId, ghost:{x,y} }
 * Returns the layout so the editor can hit-test taps.
 */
export function drawShelf(canvas, shelf, books, opts) {
  const L = layoutShelf(shelf, books, opts.size);
  canvas.width = L.W; canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const bg = BACKGROUNDS[shelf.bg]?.color || BACKGROUNDS.paper.color;
  const wood = WOODS[shelf.wood]?.color || WOODS.walnut.color;
  const darkBg = lum(bg) < 0.5;
  const ink = darkBg ? '#F1EEE6' : '#1E1C1A';
  const muted = darkBg ? 'rgba(241,238,230,0.6)' : 'rgba(30,28,26,0.55)';
  const F = FONTS[opts.font || 'serif'];

  ctx.fillStyle = bg; ctx.fillRect(0, 0, L.W, L.H);
  // gentle paper grain
  ctx.fillStyle = darkBg ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)';
  for (let i = 0; i < 260; i++) { const a = hash(`g${i}`); ctx.fillRect(a % L.W, (a >> 8) % L.H, 2, 2); }

  // header
  const post = opts.size === 'post';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = muted;
  ctx.font = `600 ${post ? 22 : 24}px "Geist", Helvetica, sans-serif`;
  const kicker = `${opts.name ? `${opts.name.toUpperCase()}'S ` : ''}SHELF · ${yearOf(todayKey())}`;
  let kx = 0; const chars = [...kicker]; const sp = 5;
  const kw = chars.reduce((a, c) => a + ctx.measureText(c).width + sp, -sp);
  kx = L.W / 2 - kw / 2; ctx.textAlign = 'left';
  for (const c of chars) { ctx.fillText(c, kx, L.M + 30); kx += ctx.measureText(c).width + sp; }
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  const ts = post ? 64 : opts.size === 'portrait' ? 78 : 92;
  const title = fitText(ctx, shelf.title || 'My bookshelf', L.W - 2 * L.M, (px) => `${F.weight} ${px}px "${F.family}", ${F.fallback}`, ts, 40);
  ctx.fillText(title, L.W / 2, L.M + 34 + (L.headH - 34) * 0.62);

  // shelves
  L.rows.forEach((r) => {
    const y = r.baseY;
    // back shadow line under board
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(r.x0 + 6, y + L.board, r.x1 - r.x0 - 12, L.board * 0.6);
    ctx.fillStyle = wood; rr(ctx, r.x0, y, r.x1 - r.x0, L.board, 4); ctx.fill();
    ctx.fillStyle = shade(wood, 0.16); ctx.fillRect(r.x0 + 2, y, r.x1 - r.x0 - 4, L.board * 0.28);
    ctx.fillStyle = shade(wood, -0.2); ctx.fillRect(r.x0 + 2, y + L.board * 0.82, r.x1 - r.x0 - 4, L.board * 0.18);
  });

  ctx.textAlign = 'left';
  // items (dragged one drawn last as a ghost)
  const sorted = [...L.boxes].sort((a, b) => (a.it.type === 'trailing') - (b.it.type === 'trailing'));
  for (const b of sorted) {
    if (b.id === opts.dragId) continue;
    drawItem(ctx, b, shelf, opts, darkBg);
  }
  const sel = L.boxes.find((b) => b.id === opts.selectedId);
  if (sel && !opts.dragId && opts.showSelection !== false) {
    ctx.save();
    ctx.strokeStyle = darkBg ? '#9FD3B4' : '#174D3A'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
    rr(ctx, sel.x - 8, sel.y - 8, sel.w + 16, sel.h + 16, 10); ctx.stroke();
    ctx.restore();
  }
  if (opts.dragId && opts.ghost) {
    const g = L.boxes.find((b) => b.id === opts.dragId);
    if (g) {
      ctx.save(); ctx.globalAlpha = 0.85;
      const gb = { ...g, x: opts.ghost.x - g.w / 2, y: opts.ghost.y - g.h / 2 };
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 24;
      drawItem(ctx, gb, shelf, opts, darkBg);
      ctx.restore();
    }
    if (opts.drop) {
      ctx.fillStyle = darkBg ? '#9FD3B4' : '#174D3A';
      rr(ctx, opts.drop.x - 3, opts.drop.y - opts.drop.h, 6, opts.drop.h, 3); ctx.fill();
    }
  }

  // footer
  const fy = L.H - L.M;
  ctx.textAlign = 'left';
  if (shelf.showStats && opts.stats) {
    ctx.fillStyle = ink;
    ctx.font = `${F.weight} ${post ? 40 : 48}px "${F.family}", ${F.fallback}`;
    const parts = [[opts.stats.finished, 'read this year'], [opts.stats.reading, 'reading now'], [opts.stats.pages, 'pages']];
    const colW = (L.W - 2 * L.M) / 3;
    parts.forEach(([v, l], i) => {
      ctx.fillStyle = ink; ctx.font = `${F.weight} ${post ? 40 : 50}px "${F.family}", ${F.fallback}`;
      ctx.fillText(String(v), L.M + i * colW, fy - (post ? 30 : 40));
      ctx.fillStyle = muted; ctx.font = `500 ${post ? 20 : 23}px "Geist", Helvetica, sans-serif`;
      ctx.fillText(l, L.M + i * colW, fy);
    });
  } else {
    ctx.fillStyle = muted; ctx.font = '500 22px "Geist", Helvetica, sans-serif';
    ctx.fillText('Small steps, big changes.', L.M, fy);
  }
  ctx.textAlign = 'right'; ctx.fillStyle = muted; ctx.font = '600 22px "Geist", Helvetica, sans-serif';
  ctx.fillText('TEND', L.W - L.M, fy);
  ctx.textAlign = 'left';
  return L;
}

function drawItem(ctx, b, shelf, opts, darkBg) {
  const { it, book } = b;
  if (it.kind === 'decor') {
    drawDecor(ctx, it.type, b.x, b.y + b.h, b.w, b.h, it.color, darkBg);
    return;
  }
  const s = b.s;
  if (it.orient === 'flat') { drawFlat(ctx, b.x, b.y, b.w, b.h, it, book, shelf.showTitles); return; }
  if (it.orient === 'face') { drawFace(ctx, b.x, b.y, b.w, b.h, it, book, opts.images); return; }
  const bw = b.d.bw * s, bh = b.d.bh * s;
  ctx.save();
  if (it.orient === 'leanR') {
    // pivot on the bottom-right corner and tip the top to the right
    ctx.translate(b.x + bw * Math.cos(LEAN), b.y + b.h);
    ctx.rotate(LEAN);
    ctx.translate(-bw, 0);
  } else if (it.orient === 'leanL') {
    // pivot on the bottom-left corner and tip the top to the left
    ctx.translate(b.x + b.w - bw * Math.cos(LEAN), b.y + b.h);
    ctx.rotate(-LEAN);
  } else {
    ctx.translate(b.x, b.y + b.h);
  }
  drawSpine(ctx, bw, bh, it, book, shelf.showTitles);
  ctx.restore();
}

/** Where would an item dropped at (x, y) land? Returns { si, index, x, y, h } for the insertion marker. */
export function dropTarget(L, shelf, x, y, dragId) {
  let row = L.rows.find((r) => y >= r.top && y <= r.bottom);
  if (!row) row = y < L.rows[0].top ? L.rows[0] : L.rows[L.rows.length - 1];
  const si = row.si;
  const items = shelf.shelves[si].filter((it) => it.id !== dragId);
  const boxes = L.boxes.filter((b) => b.si === si && b.id !== dragId);
  let index = items.length;
  let mx = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) + 6 : row.x0 + 30;
  for (const b of boxes) {
    if (x < b.x + b.w / 2) {
      index = items.findIndex((it) => it.id === b.id);
      mx = b.x - 4;
      break;
    }
  }
  return { si, index, x: mx, y: row.baseY, h: L.U * 0.9 };
}

export function moveItem(shelf, id, si, index) {
  const shelves = shelf.shelves.map((r) => r.slice());
  let item = null;
  shelves.forEach((r) => { const i = r.findIndex((x) => x.id === id); if (i >= 0) item = r.splice(i, 1)[0]; });
  if (!item) return shelf;
  shelves[si].splice(Math.max(0, Math.min(index, shelves[si].length)), 0, item);
  return { ...shelf, shelves };
}
