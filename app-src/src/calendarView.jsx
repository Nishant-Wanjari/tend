import React, { useMemo } from 'react';
import { LuChevronLeft, LuChevronRight, LuShare2 } from 'react-icons/lu';
import { useApp } from './ctx.js';
import { IconButton, Button, BookCover, col, tint, cx } from './ui.jsx';
import { monthGrid, calendarData } from './lib/calendar.js';
import { addMonths, fromKey, fmtMonth, monthOf, startOfMonth, todayKey } from './lib/date.js';

const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** BookPine-style month calendar. kind decides how each day tile is drawn. */
export function TrackerCalendar({ kind, month, onMonth, habitId = 'all', onDay, shareParams, hideAmounts = false, title }) {
  const { state, today, nav } = useApp();
  const data = useMemo(() => calendarData(state, kind, month, { habitId, hideAmounts }), [state, kind, month, habitId, hideAmounts]);
  const { first, last, cells } = monthGrid(month);
  const atLatest = startOfMonth(today) <= first;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <IconButton icon={LuChevronLeft} label="Previous month" size={36} onClick={() => onMonth(addMonths(first, -1))} />
        <div className="text-center min-w-0">
          <div className="text-[15px] font-semibold">{fmtMonth(first)}</div>
          {title && <div className="text-[12px] text-muted truncate">{title}</div>}
        </div>
        <IconButton icon={LuChevronRight} label="Next month" size={36} disabled={atLatest} className="disabled:opacity-30" onClick={() => !atLatest && onMonth(addMonths(first, 1))} />
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DOWS.map((d) => <div key={d} className="text-center text-[11px] text-muted pb-1">{d}</div>)}
        {cells.map((k) => {
          const inMonth = k >= first && k <= last;
          if (!inMonth) return <div key={k} className="aspect-[3/4] rounded-xl border hairline opacity-25 grid place-items-start justify-center pt-1.5 text-[11px] text-faint num">{fromKey(k).getDate()}</div>;
          return (
            <button key={k} type="button" disabled={k > today} onClick={() => onDay?.(k)} aria-label={`${fromKey(k).toDateString()}`}
              className={cx('aspect-[3/4] rounded-xl relative overflow-hidden transition active:scale-95 disabled:opacity-35', k === today && 'ring-2 ring-brand ring-offset-1 ring-offset-surface')}>
              <Tile kind={kind} tile={data.tiles[k]} k={k} color={data.color} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <div className="flex gap-4">
          {data.summary.map((s) => (
            <div key={s.label} className="min-w-0"><div className="text-[17px] font-semibold num leading-tight">{s.value}</div><div className="text-[11px] text-muted">{s.label}</div></div>
          ))}
        </div>
        <Button size="sm" variant="secondary" icon={LuShare2} onClick={() => nav('share', { kind, mode: 'calendar', month: first, habitId, ...shareParams })}>Share calendar</Button>
      </div>
      {data.legend?.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-muted">
          {data.legend.map((l) => <span key={l.label} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: col(l.color) }} />{l.label} {l.count}</span>)}
        </div>
      )}
    </div>
  );
}

function DayNum({ k, light }) {
  return (
    <span className={cx('absolute top-1 left-0 right-0 text-center text-[12px] font-semibold num z-10', light ? 'text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]' : 'text-ink')}>
      {fromKey(k).getDate()}
    </span>
  );
}

function Tile({ kind, tile, k, color }) {
  if (kind === 'reading') {
    if (!tile) return <><Empty /><DayNum k={k} /></>;
    return (
      <>
        <div className="absolute inset-0 flex">
          {tile.books.map((b) => (
            <div key={b.id} className="h-full overflow-hidden relative" style={{ width: `${100 / tile.books.length}%` }}>
              <CoverFill book={b} bare={tile.books.length > 1} />
            </div>
          ))}
        </div>
        <DayNum k={k} light />
      </>
    );
  }
  if (kind === 'gym') {
    if (!tile) return <><Empty /><DayNum k={k} /></>;
    return (
      <>
        <div className="absolute inset-0" style={{ background: col(tile.color) }} />
        <DayNum k={k} light />
        <span className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] sm:text-[11px] font-semibold text-white leading-none">{tile.label}{tile.more ? ` +${tile.more}` : ''}</span>
      </>
    );
  }
  if (kind === 'finance') {
    if (!tile) return <><Empty /><DayNum k={k} /></>;
    const strong = tile.level > 0.55;
    return (
      <>
        <div className="absolute inset-0 rounded-xl border hairline" style={{ background: tile.amount ? tint(2, 0.1 + tile.level * 0.8) : 'transparent' }} />
        <DayNum k={k} light={strong} />
        <span className={cx('absolute bottom-1.5 left-0 right-0 text-center text-[10px] sm:text-[11px] font-semibold num leading-none', strong ? 'text-white' : tile.amount ? 'text-ink' : 'text-faint')}>{tile.text}</span>
      </>
    );
  }
  // habits
  const c = color || 4;
  const st = tile?.state || 'off';
  const bg = st === 'done' ? col(c) : st === 'part' ? tint(c, 0.15 + (tile.level || 0) * 0.45) : 'transparent';
  return (
    <>
      <div className={cx('absolute inset-0 rounded-xl', st === 'miss' ? 'border border-dashed border-faint' : st === 'off' ? 'bg-surface2' : st === 'done' || st === 'part' ? '' : 'border hairline')} style={{ background: st === 'off' ? undefined : bg }} />
      <DayNum k={k} light={st === 'done'} />
    </>
  );
}

const Empty = () => <div className="absolute inset-0 rounded-xl border hairline" />;

function CoverFill({ book, bare }) {
  return (
    <div className="absolute inset-0">
      <BookCover book={book} fill bare={bare} />
    </div>
  );
}
