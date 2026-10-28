import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuDownload, LuCopy, LuShare2, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useApp } from '../ctx.js';
import { Card, Button, Segmented, Field, Toggle, Chips, IconButton, col, cx } from '../ui.jsx';
import { SIZES, TEMPLATES, BG_SWATCHES, FONTS, STAT_OPTIONS, DEFAULT_STATS, resolveRange, cardData, drawCard, drawCalendarCard, ensureFonts } from '../lib/share.js';
import { calendarData, coverSrc } from '../lib/calendar.js';
import { loadImage } from '../lib/covers.js';
import { saveFile, shareNative, isNative } from '../lib/files.js';
import { SponsorStrip } from '../sponsorView.jsx';
import { addDays, addMonths, startOfMonth, fmtMonth } from '../lib/date.js';

export default function Share({ kind: initialKind, mode: initialMode, month: initialMonth, habitId: initialHabit }) {
  const { state, toast, today, nav } = useApp();
  const [kind, setKind] = useState(initialKind || 'reading');
  const [mode, setMode] = useState(initialMode || 'stats');
  const [calMonth, setCalMonth] = useState(startOfMonth(initialMonth || today));
  const [habitId, setHabitId] = useState(initialHabit || 'all');
  const [template, setTemplate] = useState(initialMode === 'calendar' ? 'dark' : 'editorial');
  const [bg, setBg] = useState(null);
  const [font, setFont] = useState('serif');
  const [size, setSize] = useState('story');
  const [showName, setShowName] = useState(true);
  const [displayName, setDisplayName] = useState(state.settings.name || '');
  const [range, setRange] = useState('month');
  const [custom, setCustom] = useState({ from: addDays(today, -13), to: today });
  const [statsByKind, setStatsByKind] = useState(DEFAULT_STATS);
  const [hideAmounts, setHideAmounts] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const [images, setImages] = useState(() => new Map());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvas = useRef(null);
  const habits = state.habits.filter((h) => !h.archived);

  useEffect(() => { ensureFonts().then(() => setFontsReady(true)); }, []);
  const r = useMemo(() => resolveRange(range, custom, today), [range, custom, today]);
  const data = useMemo(() => cardData(state, kind, r, { hideAmounts }), [state, kind, r, hideAmounts]);
  const cal = useMemo(() => calendarData(state, kind, calMonth, { habitId, hideAmounts }), [state, kind, calMonth, habitId, hideAmounts]);
  const stats = statsByKind[kind];
  const name = showName ? displayName.trim() : '';

  // load the cover photos this card needs, then redraw
  const srcs = useMemo(() => {
    if (kind !== 'reading') return [];
    const books = mode === 'calendar' ? Object.values(cal.tiles).flatMap((t) => t.books || []) : data.visual.covers || [];
    return [...new Set(books.map(coverSrc).filter(Boolean))];
  }, [kind, mode, cal, data]);
  useEffect(() => {
    let live = true;
    const missing = srcs.filter((s) => !images.has(s));
    if (!missing.length) return;
    Promise.all(missing.map((s) => loadImage(s).then((img) => [s, img]))).then((pairs) => {
      if (!live) return;
      setImages((m) => { const n = new Map(m); pairs.forEach(([s, img]) => img && n.set(s, img)); return n; });
    });
    return () => { live = false; };
  }, [srcs]);

  useEffect(() => {
    if (!canvas.current) return;
    if (mode === 'calendar') drawCalendarCard(canvas.current, { template, bg, font, size, name, data: cal, images, hideAmounts });
    else drawCard(canvas.current, { kind, template, bg, font, size, name, stats, data, range: r, images });
  }, [mode, kind, template, bg, font, size, name, stats, data, cal, r, fontsReady, images, hideAmounts]);

  const blob = () => new Promise((res, rej) => canvas.current.toBlob((b) => (b ? res(b) : rej(new Error('blank'))), 'image/png'));
  const fileName = `tend-${kind}-${mode === 'calendar' ? calMonth.slice(0, 7) : today}.png`;

  const download = async () => {
    setBusy(true);
    try {
      const b = await blob();
      const out = await saveFile(fileName, b);
      if (out === 'saved' || out === 'fallback') setSaved(true);
      if (out === 'saved') toast(isNative() ? 'Saved to Pictures › Tend' : 'Card saved');
      else if (out === 'declined') toast('Download cancelled');
      else if (out === 'unavailable') toast("Downloads aren't available in this view. Try Copy image.");
      else if (out === 'fallback') toast('Card downloaded');
      else toast("Couldn't save the card. Try again.");
    } catch {
      toast("Couldn't create the image. Try another template.");
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('no');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })]);
      toast('Image copied');
    } catch {
      toast("This browser won't copy images. Use Download instead.");
    }
  };
  const share = async () => {
    if (isNative()) {
      if (!(await shareNative(fileName, await blob()))) toast("Couldn't open sharing. Try Download.");
      return;
    }
    try {
      const file = new File([await blob()], fileName, { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) throw new Error('no');
      await navigator.share({ files: [file], title: 'My progress on Tend' });
    } catch (e) {
      if (e?.name !== 'AbortError') toast("Sharing isn't available here. Download the card, then share it from your gallery.");
    }
  };

  const T = TEMPLATES[template];
  const preview = SIZES[size];
  const atLatest = calMonth >= startOfMonth(today);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
      <div className="lg:sticky lg:top-6 flex flex-col items-center gap-3">
        <div className="w-full flex justify-center rounded-3xl bg-surface2 p-4 md:p-6">
          <canvas ref={canvas} aria-label="Share card preview" role="img"
            className="rounded-[18px] shadow-[0_18px_50px_-18px_rgb(0_0_0/0.45)] max-w-full h-auto"
            style={{ width: size === 'story' ? 'min(100%, 300px)' : size === 'portrait' ? 'min(100%, 340px)' : 'min(100%, 360px)', aspectRatio: `${preview.w} / ${preview.h}` }} />
        </div>
        <div className="text-[12px] text-muted num">{preview.w} × {preview.h} px PNG · matches the preview exactly</div>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button icon={LuDownload} onClick={download} disabled={busy}>Download PNG</Button>
          <Button variant="secondary" icon={LuCopy} onClick={copy}>Copy image</Button>
          <Button variant="secondary" icon={LuShare2} onClick={share}>Share</Button>
        </div>
        {saved && <SponsorStrip placement="export" title="Your card is ready · Sponsored" compact className="w-full mt-2" />}
      </div>

      <Card className="p-5 flex flex-col gap-5">
        <button type="button" onClick={() => nav('bookshelf')} className="flex items-center gap-3 p-3 -m-1 rounded-2xl bg-brandsoft text-left">
          <span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold text-brand">Bookshelf card</span><span className="block text-[12px] text-muted">Arrange your books and objects on shelves and share it</span></span>
          <LuChevronRight className="w-5 h-5 text-brand" />
        </button>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Card">
            <Segmented value={kind} onChange={setKind} label="Card type" options={[{ value: 'reading', label: 'Reading' }, { value: 'finance', label: 'Money' }, { value: 'gym', label: 'Fitness' }, { value: 'habits', label: 'Habits' }]} />
          </Field>
          <Field label="Layout">
            <Segmented value={mode} onChange={setMode} label="Layout" options={[{ value: 'stats', label: 'Stats' }, { value: 'calendar', label: 'Calendar' }]} />
          </Field>
        </div>

        {mode === 'calendar' && (
          <Field label="Month">
            <div className="flex items-center gap-2">
              <IconButton icon={LuChevronLeft} label="Previous month" size={36} onClick={() => setCalMonth(addMonths(calMonth, -1))} />
              <div className="text-[15px] font-medium min-w-[140px] text-center">{fmtMonth(calMonth)}</div>
              <IconButton icon={LuChevronRight} label="Next month" size={36} disabled={atLatest} className="disabled:opacity-30" onClick={() => !atLatest && setCalMonth(addMonths(calMonth, 1))} />
            </div>
          </Field>
        )}
        {mode === 'calendar' && kind === 'habits' && (
          <Field label="Habit">
            <div className="flex flex-wrap gap-1.5">
              {[{ id: 'all', name: 'All habits', color: 4 }, ...habits].map((h) => (
                <button key={h.id} type="button" aria-pressed={habitId === h.id} onClick={() => setHabitId(h.id)}
                  className={cx('h-8 px-3 rounded-full text-[13px] font-medium border transition inline-flex items-center gap-1.5', habitId === h.id ? 'bg-brand text-onbrand border-transparent' : 'hairline text-muted hover:text-ink')}>
                  <span className="w-2 h-2 rounded-full" style={{ background: col(h.color) }} />{h.name}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Template">
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button key={k} type="button" aria-pressed={template === k} onClick={() => { setTemplate(k); setBg(null); }}
                className={cx('flex flex-col items-center gap-1.5 p-1.5 rounded-2xl border-2 transition', template === k ? 'border-brand' : 'border-transparent hover:bg-surface2')}>
                <span className="w-full aspect-[3/4] rounded-xl relative overflow-hidden border hairline" style={{ background: t.bg }}>
                  <span className="absolute left-[14%] top-[18%] w-[50%] h-[8%] rounded-sm" style={{ background: t.ink, opacity: 0.85 }} />
                  <span className="absolute left-[14%] top-[36%] w-[34%] h-[18%] rounded-sm" style={{ background: t.accent }} />
                  <span className="absolute left-[14%] bottom-[16%] w-[72%] h-[4%] rounded-sm" style={{ background: t.muted, opacity: 0.7 }} />
                </span>
                <span className="text-[11px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Background">
          <div className="flex flex-wrap gap-2">
            {[T.bg, ...BG_SWATCHES.filter((c) => c !== T.bg)].slice(0, 9).map((c) => (
              <button key={c} type="button" aria-label={`Background ${c}`} aria-pressed={(bg || T.bg) === c} onClick={() => setBg(c === T.bg ? null : c)}
                className={cx('w-8 h-8 rounded-full border transition hairline', (bg || T.bg) === c && 'ring-2 ring-offset-2 ring-brand ring-offset-surface')} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Display font">
            <Segmented value={font} onChange={setFont} label="Font" options={Object.entries(FONTS).map(([k, f]) => ({ value: k, label: f.label }))} />
          </Field>
          <Field label="Size">
            <Segmented value={size} onChange={setSize} label="Size" options={Object.entries(SIZES).map(([k, s]) => ({ value: k, label: s.label.split(' ')[0] }))} />
          </Field>
        </div>
        {mode === 'stats' && (
          <>
            <Field label="Date range">
              <Segmented value={range} onChange={setRange} label="Date range" options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'custom', label: 'Custom' }]} />
              {range === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <input aria-label="From" type="date" className="field" max={today} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                  <input aria-label="To" type="date" className="field" max={today} min={custom.from} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
                </div>
              )}
            </Field>
            <Field label="Show on card">
              <Chips multi value={stats} onChange={(v) => setStatsByKind((s) => ({ ...s, [kind]: v }))} options={STAT_OPTIONS[kind].map(([value, label]) => ({ value, label }))} />
            </Field>
          </>
        )}
        {kind === 'finance' && (
          <Toggle label="Hide amounts" sub={mode === 'calendar' ? 'Days keep their shading; rupee figures stay private' : 'Show percentages only; rupee figures stay private'} checked={hideAmounts} onChange={setHideAmounts} />
        )}
        <div className="flex flex-col gap-2">
          <Toggle label="Show my name" sub={showName ? undefined : 'Card is anonymous'} checked={showName} onChange={setShowName} />
          {showName && <input aria-label="Name on card" className="field" value={displayName} maxLength={24} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />}
        </div>
      </Card>
    </div>
  );
}
