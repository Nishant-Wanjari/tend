import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuDownload, LuCopy, LuShare2, LuPlus, LuMinus, LuTrash2, LuChevronLeft, LuChevronRight, LuChevronUp, LuChevronDown,
  LuWandSparkles, LuX, LuBookOpen, LuSprout,
} from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Button, Segmented, Field, Toggle, IconButton, BookCover, cx } from '../ui.jsx';
import {
  autoShelf, drawShelf, drawDecor, dropTarget, moveItem, spineColor, spinePattern,
  SPINE_COLORS, PATTERNS, ORIENTS, DECOR, POT_COLORS, BACKGROUNDS, WOODS,
} from '../lib/shelf.js';
import { SIZES, FONTS, ensureFonts } from '../lib/share.js';
import { coverSrc } from '../lib/calendar.js';
import { loadImage } from '../lib/covers.js';
import { saveFile, shareNative, isNative } from '../lib/files.js';
import { SponsorStrip } from '../sponsorView.jsx';
import { readingStats } from '../lib/stats.js';
import { num, uid } from '../lib/format.js';

function DecorThumb({ type, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 96; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 96, 96);
    const dims = { cactus: [44, 62], pilea: [56, 60], trailing: [44, 40], mug: [40, 30], candle: [26, 40], globe: [40, 64], cat: [44, 52], frame: [44, 56], hourglass: [26, 46], bookend: [24, 52] }[type] || [40, 40];
    const base = type === 'trailing' ? 50 : 84;
    drawDecor(ctx, type, (96 - dims[0]) / 2, base, dims[0], dims[1], color);
  }, [type, color]);
  return <canvas ref={ref} className="w-12 h-12" aria-hidden />;
}

export default function Bookshelf() {
  const { state, actions, toast, today } = useApp();
  const [shelf, setShelfState] = useState(() => state.bookshelf || autoShelf(state));
  const [size, setSize] = useState('story');
  const [font, setFont] = useState('serif');
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState(null); // 'books' | 'decor' | 'style'
  const [drag, setDrag] = useState(null); // { id, x, y, drop }
  const [images, setImages] = useState(() => new Map());
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvas = useRef(null);
  const layout = useRef(null);
  const press = useRef(null);
  const name = state.settings.name || '';

  // persist edits (debounced) so the shelf survives refreshes
  const saveT = useRef(null);
  const setShelf = (next) => {
    setShelfState(next);
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => actions.setShelf(next), 400);
  };
  useEffect(() => { if (!state.bookshelf) actions.setShelf(shelf); }, []);
  useEffect(() => { ensureFonts().then(() => setFontsReady(true)); }, []);

  // drop items whose book was deleted
  const books = state.books;
  const placed = useMemo(() => new Set(shelf.shelves.flat().filter((i) => i.kind === 'book').map((i) => i.bookId)), [shelf]);
  const unplaced = books.filter((b) => !placed.has(b.id));
  const rs = useMemo(() => readingStats(state, today), [state, today]);
  const stats = { finished: rs.finishedThisYear.length, reading: rs.current.length, pages: num(rs.totalPages) };

  // cover photos for "cover out" books
  const srcs = useMemo(() => [...new Set(shelf.shelves.flat().filter((i) => i.orient === 'face').map((i) => coverSrc(books.find((b) => b.id === i.bookId))).filter(Boolean))], [shelf, books]);
  useEffect(() => {
    let live = true;
    const missing = srcs.filter((s) => !images.has(s));
    if (!missing.length) return;
    Promise.all(missing.map((s) => loadImage(s).then((img) => [s, img]))).then((pairs) => {
      if (live) setImages((m) => { const n = new Map(m); pairs.forEach(([s, img]) => img && n.set(s, img)); return n; });
    });
    return () => { live = false; };
  }, [srcs]);

  const draw = (extra = {}) => {
    if (!canvas.current) return;
    layout.current = drawShelf(canvas.current, shelf, books, { size, font, name, stats, images, selectedId: selected, ...extra });
  };
  useEffect(() => { draw(drag ? { dragId: drag.id, ghost: { x: drag.x, y: drag.y }, drop: drag.drop } : {}); });

  const toCard = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.current.width) / r.width, y: ((e.clientY - r.top) * canvas.current.height) / r.height };
  };
  const hit = (p) => {
    const L = layout.current;
    if (!L) return null;
    for (let i = L.boxes.length - 1; i >= 0; i--) {
      const b = L.boxes[i];
      const pad = 10;
      if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) return b;
    }
    return null;
  };
  const onDown = (e) => {
    const p = toCard(e);
    const b = hit(p);
    press.current = { p, id: b?.id || null, moved: false };
    if (b) canvas.current.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const pr = press.current;
    if (!pr?.id) return;
    const p = toCard(e);
    if (!pr.moved && Math.hypot(p.x - pr.p.x, p.y - pr.p.y) < 14) return;
    pr.moved = true;
    const drop = dropTarget(layout.current, shelf, p.x, p.y, pr.id);
    setDrag({ id: pr.id, x: p.x, y: p.y, drop });
  };
  const onUp = () => {
    const pr = press.current;
    press.current = null;
    if (!pr) return;
    if (pr.moved && drag) {
      setShelf(moveItem(shelf, drag.id, drag.drop.si, drag.drop.index));
      setSelected(drag.id);
      setDrag(null);
      return;
    }
    setDrag(null);
    setSelected(pr.id);
  };

  const sel = useMemo(() => {
    for (let si = 0; si < shelf.shelves.length; si++) {
      const ii = shelf.shelves[si].findIndex((x) => x.id === selected);
      if (ii >= 0) return { si, ii, item: shelf.shelves[si][ii] };
    }
    return null;
  }, [shelf, selected]);
  const selBook = sel?.item.kind === 'book' ? books.find((b) => b.id === sel.item.bookId) : null;
  const patch = (p) => setShelf({ ...shelf, shelves: shelf.shelves.map((r, si) => (si !== sel.si ? r : r.map((x) => (x.id === selected ? { ...x, ...p } : x)))) });
  const nudge = (dx) => setShelf(moveItem(shelf, selected, sel.si, sel.ii + dx));
  const toShelf = (dy) => {
    const si = sel.si + dy;
    if (si < 0 || si >= shelf.shelves.length) return;
    setShelf(moveItem(shelf, selected, si, shelf.shelves[si].length));
  };
  const remove = () => { setShelf({ ...shelf, shelves: shelf.shelves.map((r) => r.filter((x) => x.id !== selected)) }); setSelected(null); };
  const targetShelf = () => {
    // the emptiest shelf
    let best = 0;
    shelf.shelves.forEach((r, i) => { if (r.length < shelf.shelves[best].length) best = i; });
    return sel ? sel.si : best;
  };
  const addBook = (b) => {
    const it = { id: uid(), kind: 'book', bookId: b.id, orient: 'up' };
    const si = targetShelf();
    setShelf({ ...shelf, shelves: shelf.shelves.map((r, i) => (i === si ? [...r, it] : r)) });
    setSelected(it.id);
  };
  const addDecor = (type) => {
    const it = { id: uid(), kind: 'decor', type, color: POT_COLORS[Math.floor(Math.random() * POT_COLORS.length)], size: 1 };
    const si = targetShelf();
    setShelf({ ...shelf, shelves: shelf.shelves.map((r, i) => (i === si ? [...r, it] : r)) });
    setSelected(it.id);
    setPanel(null);
  };
  const setRows = (n) => {
    n = Math.max(1, Math.min(6, n));
    let shelves = shelf.shelves.map((r) => r.slice());
    if (n > shelves.length) while (shelves.length < n) shelves.push([]);
    else {
      const extra = shelves.slice(n).flat();
      shelves = shelves.slice(0, n);
      shelves[n - 1] = [...shelves[n - 1], ...extra];
    }
    setShelf({ ...shelf, shelves });
  };

  // export (selection outline hidden)
  const blob = () => new Promise((res, rej) => {
    const c = document.createElement('canvas');
    drawShelf(c, shelf, books, { size, font, name, stats, images, showSelection: false });
    c.toBlob((b) => (b ? res(b) : rej(new Error('blank'))), 'image/png');
  });
  const fileName = `tend-bookshelf-${today}.png`;
  const download = async () => {
    setBusy(true);
    try {
      const out = await saveFile(fileName, await blob());
      if (out === 'saved' || out === 'fallback') setSaved(true);
      toast(out === 'saved' ? (isNative() ? 'Saved to Pictures › Tend' : 'Bookshelf saved') : out === 'fallback' ? 'Bookshelf downloaded' : out === 'declined' ? 'Download cancelled' : "Downloads aren't available here. Try Copy image.");
    } catch { toast("Couldn't create the image."); } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('no');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })]);
      toast('Image copied');
    } catch { toast("This browser won't copy images. Use Download instead."); }
  };
  const share = async () => {
    if (isNative()) { if (!(await shareNative(fileName, await blob()))) toast("Couldn't open sharing. Try Download."); return; }
    try {
      const file = new File([await blob()], fileName, { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) throw new Error('no');
      await navigator.share({ files: [file], title: 'My bookshelf' });
    } catch (e) { if (e?.name !== 'AbortError') toast("Sharing isn't available here. Download the image, then share it."); }
  };

  const preview = SIZES[size];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] items-start">
      <div className="lg:sticky lg:top-6 flex flex-col items-center gap-3">
        <div className="w-full flex justify-center rounded-3xl bg-surface2 p-3 md:p-5">
          <canvas ref={canvas} role="img" aria-label="Your bookshelf. Tap a book or object to edit it; drag to move it."
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { press.current = null; setDrag(null); }}
            className="rounded-[18px] shadow-[0_18px_50px_-18px_rgb(0_0_0/0.45)] max-w-full h-auto touch-none cursor-pointer select-none"
            style={{ width: size === 'story' ? 'min(100%, 330px)' : size === 'portrait' ? 'min(100%, 370px)' : 'min(100%, 400px)', aspectRatio: `${preview.w} / ${preview.h}` }} />
        </div>
        <div className="text-[12px] text-muted text-center">Tap a book or object to edit it. Drag to move it, even to another shelf.</div>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button icon={LuDownload} onClick={download} disabled={busy}>Download PNG</Button>
          <Button variant="secondary" icon={LuCopy} onClick={copy}>Copy</Button>
          <Button variant="secondary" icon={LuShare2} onClick={share}>Share</Button>
        </div>
        {saved && <SponsorStrip placement="export" title="Your shelf is ready · Sponsored" compact className="w-full mt-2" />}
      </div>

      <div className="flex flex-col gap-4">
        {sel ? (
          <Card className="p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {selBook ? <BookCover book={selBook} w={36} /> : <div className="w-9 h-9 rounded-xl bg-surface2 grid place-items-center"><DecorThumb type={sel.item.type} color={sel.item.color} /></div>}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{selBook ? selBook.title : DECOR[sel.item.type]}</div>
                <div className="text-[12px] text-muted">Shelf {sel.si + 1} · position {sel.ii + 1}</div>
              </div>
              <IconButton icon={LuX} label="Done editing" onClick={() => setSelected(null)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <IconButton icon={LuChevronLeft} label="Move left" className="bg-surface2" onClick={() => nudge(-1)} />
              <IconButton icon={LuChevronRight} label="Move right" className="bg-surface2" onClick={() => nudge(1)} />
              <IconButton icon={LuChevronUp} label="Move to shelf above" className="bg-surface2 disabled:opacity-30" disabled={sel.si === 0} onClick={() => toShelf(-1)} />
              <IconButton icon={LuChevronDown} label="Move to shelf below" className="bg-surface2 disabled:opacity-30" disabled={sel.si === shelf.shelves.length - 1} onClick={() => toShelf(1)} />
              <div className="flex-1" />
              <Button size="sm" variant="danger" icon={LuTrash2} onClick={remove}>Remove</Button>
            </div>
            {selBook ? (
              <>
                <Field label="Orientation">
                  <div className="flex flex-wrap gap-1.5">
                    {ORIENTS.map(([v, l]) => (
                      <button key={v} type="button" aria-pressed={(sel.item.orient || 'up') === v} onClick={() => patch({ orient: v })}
                        className={cx('h-9 px-3 rounded-xl text-[13px] font-medium border transition', (sel.item.orient || 'up') === v ? 'bg-brand text-onbrand border-transparent' : 'hairline text-muted hover:text-ink')}>{l}</button>
                    ))}
                  </div>
                  {sel.item.orient === 'flat' && <p className="text-[12px] text-faint mt-1">Books lying flat next to each other form a stack.</p>}
                  {sel.item.orient === 'face' && !coverSrc(selBook) && <p className="text-[12px] text-faint mt-1">Add a cover photo to this book to show it here.</p>}
                </Field>
                {sel.item.orient !== 'face' && (
                  <>
                    <Field label="Spine colour">
                      <div className="flex flex-wrap gap-2">
                        {SPINE_COLORS.map((c) => (
                          <button key={c} type="button" aria-label={`Spine ${c}`} aria-pressed={spineColor(sel.item, selBook) === c} onClick={() => patch({ color: c })}
                            className={cx('w-8 h-8 rounded-lg border-2 transition', spineColor(sel.item, selBook) === c ? 'border-ink scale-110' : 'border-transparent')} style={{ background: c }} />
                        ))}
                      </div>
                    </Field>
                    <Field label="Spine design">
                      <div className="flex flex-wrap gap-1.5">
                        {PATTERNS.map(([v, l]) => (
                          <button key={v} type="button" aria-pressed={spinePattern(sel.item) === v} onClick={() => patch({ pattern: v })}
                            className={cx('h-8 px-3 rounded-full text-[13px] font-medium border transition', spinePattern(sel.item) === v ? 'bg-brand text-onbrand border-transparent' : 'hairline text-muted hover:text-ink')}>{l}</button>
                        ))}
                      </div>
                    </Field>
                  </>
                )}
                <Field label="Height" htmlFor="sh-h">
                  <input id="sh-h" type="range" min="0" max="1" step="0.05" value={sel.item.h ?? 0.6} onChange={(e) => patch({ h: Number(e.target.value) })} className="w-full accent-[rgb(var(--brand))]" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Object">
                  <div className="grid grid-cols-5 gap-1.5">
                    {Object.keys(DECOR).map((t) => (
                      <button key={t} type="button" aria-label={DECOR[t]} aria-pressed={sel.item.type === t} onClick={() => patch({ type: t })}
                        className={cx('rounded-xl grid place-items-center p-1 border-2 transition', sel.item.type === t ? 'border-brand bg-brandsoft' : 'border-transparent bg-surface2')}>
                        <DecorThumb type={t} color={sel.item.color} />
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Colour">
                  <div className="flex flex-wrap gap-2">
                    {POT_COLORS.map((c) => (
                      <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={sel.item.color === c} onClick={() => patch({ color: c })}
                        className={cx('w-8 h-8 rounded-full border-2 transition', sel.item.color === c ? 'border-ink scale-110' : 'border-line')} style={{ background: c }} />
                    ))}
                  </div>
                </Field>
                <Field label="Size">
                  <Segmented value={sel.item.size || 1} onChange={(v) => patch({ size: v })} options={[{ value: 0.75, label: 'Small' }, { value: 1, label: 'Medium' }, { value: 1.25, label: 'Large' }]} />
                </Field>
              </>
            )}
          </Card>
        ) : null}

        <Card className="p-4 flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={panel === 'books' ? 'primary' : 'secondary'} icon={LuBookOpen} onClick={() => setPanel(panel === 'books' ? null : 'books')}>Add books{unplaced.length ? ` · ${unplaced.length}` : ''}</Button>
            <Button size="sm" variant={panel === 'decor' ? 'primary' : 'secondary'} icon={LuSprout} onClick={() => setPanel(panel === 'decor' ? null : 'decor')}>Add objects</Button>
            <Button size="sm" variant="ghost" icon={LuWandSparkles} onClick={() => { setShelf(autoShelf(state, shelf)); setSelected(null); toast('Shelf rearranged from your library'); }}>Auto-arrange</Button>
          </div>
          {panel === 'books' && (
            unplaced.length ? (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {unplaced.map((b) => (
                  <button key={b.id} type="button" onClick={() => addBook(b)} className="flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-surface2 text-center min-w-0">
                    <BookCover book={b} w={44} />
                    <span className="text-[11px] leading-tight line-clamp-2">{b.title}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-[13px] text-muted">Every book in your library is on the shelf. Add more books in Reading.</p>
          )}
          {panel === 'decor' && (
            <div className="grid grid-cols-5 gap-2">
              {Object.keys(DECOR).map((t) => (
                <button key={t} type="button" onClick={() => addDecor(t)} className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl bg-surface2 hover:bg-line/60 min-w-0">
                  <DecorThumb type={t} color="#C8643B" />
                  <span className="text-[10px] text-muted truncate w-full text-center">{DECOR[t]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="text-[12px] text-faint">New items go on {sel ? 'the selected shelf' : 'the emptiest shelf'}.</div>
        </Card>

        <Card className="p-4 flex flex-col gap-4">
          <Field label="Title" htmlFor="sh-title">
            <input id="sh-title" className="field" value={shelf.title} maxLength={32} onChange={(e) => setShelf({ ...shelf, title: e.target.value })} placeholder="My bookshelf" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Shelves">
              <div className="flex items-center gap-2">
                <IconButton icon={LuMinus} label="Fewer shelves" className="bg-surface2 disabled:opacity-30" disabled={shelf.shelves.length <= 1} onClick={() => setRows(shelf.shelves.length - 1)} />
                <span className="num font-semibold w-6 text-center">{shelf.shelves.length}</span>
                <IconButton icon={LuPlus} label="More shelves" className="bg-surface2 disabled:opacity-30" disabled={shelf.shelves.length >= 6} onClick={() => setRows(shelf.shelves.length + 1)} />
              </div>
            </Field>
            <Field label="Size">
              <Segmented size="sm" value={size} onChange={setSize} options={Object.entries(SIZES).map(([k, s]) => ({ value: k, label: s.label.split(' ')[0] }))} />
            </Field>
          </div>
          <Field label="Wall">
            <div className="flex flex-wrap gap-2">
              {Object.entries(BACKGROUNDS).map(([k, b]) => (
                <button key={k} type="button" aria-label={b.label} aria-pressed={shelf.bg === k} onClick={() => setShelf({ ...shelf, bg: k })}
                  className={cx('w-9 h-9 rounded-full border transition hairline', shelf.bg === k && 'ring-2 ring-offset-2 ring-brand ring-offset-surface')} style={{ background: b.color }} />
              ))}
            </div>
          </Field>
          <Field label="Shelf wood">
            <div className="flex flex-wrap gap-2">
              {Object.entries(WOODS).map(([k, b]) => (
                <button key={k} type="button" aria-pressed={shelf.wood === k} onClick={() => setShelf({ ...shelf, wood: k })}
                  className={cx('h-9 px-3 rounded-xl text-[13px] font-medium border transition inline-flex items-center gap-2', shelf.wood === k ? 'border-brand bg-brandsoft' : 'hairline')}>
                  <span className="w-4 h-4 rounded" style={{ background: b.color }} />{b.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Title font">
            <Segmented value={font} onChange={setFont} options={Object.entries(FONTS).map(([k, f]) => ({ value: k, label: f.label }))} />
          </Field>
          <Toggle label="Titles on spines" checked={shelf.showTitles} onChange={(v) => setShelf({ ...shelf, showTitles: v })} />
          <Toggle label="Reading stats at the bottom" checked={shelf.showStats} onChange={(v) => setShelf({ ...shelf, showStats: v })} />
        </Card>
      </div>
    </div>
  );
}
