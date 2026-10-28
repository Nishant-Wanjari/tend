import React, { useMemo, useRef, useState } from 'react';
import { LuPlus, LuArrowUpRight, LuCopy, LuImagePlus, LuCheck, LuShieldCheck } from 'react-icons/lu';
import { useApp } from './ctx.js';
import { Sheet, Button, Field, cx } from './ui.jsx';
import { useSponsors, slotsFor, sponsorHref } from './lib/sponsors.js';

const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const hue = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function Logo({ sponsor, size = 36 }) {
  const [broken, setBroken] = useState(false);
  if (sponsor.logo && !broken) {
    return <img src={sponsor.logo} alt="" width={size} height={size} className="rounded-xl object-contain bg-white" style={{ width: size, height: size }} onError={() => setBroken(true)} />;
  }
  return (
    <span className="rounded-xl grid place-items-center text-[13px] font-semibold text-white" style={{ width: size, height: size, background: `hsl(${hue(sponsor.name)} 38% 42%)` }}>
      {initials(sponsor.name)}
    </span>
  );
}

/**
 * A row of sponsor tiles styled like the rest of the app. Paid slots link out
 * (marked sponsored, tagged ref=tend); open slots invite a booking.
 */
export function SponsorStrip({ placement, title = 'Sponsored', className = '', compact = false }) {
  const feed = useSponsors();
  const { openSheet } = useApp();
  const slots = slotsFor(feed, placement);
  if (!slots.length) return null;
  const cols = slots.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2';
  return (
    <section className={cx('flex flex-col gap-2', className)} aria-label={`${title}: ${feed.placements[placement]?.label || ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="label">{title}</span>
        <button type="button" onClick={() => openSheet({ type: 'advertise', placement })} className="text-[12px] text-muted hover:text-ink inline-flex items-center gap-0.5">
          Advertise here <LuArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className={cx('grid gap-2', cols)}>
        {slots.map(({ slot, sponsor }) => {
          if (sponsor) {
            const href = sponsorHref(sponsor.url);
            return (
              <a key={slot} href={href || undefined} target="_blank" rel="sponsored noopener noreferrer"
                className={cx('card flex items-center gap-3 px-3 transition hover:-translate-y-0.5', compact ? 'py-2.5' : 'py-3')}>
                <Logo sponsor={sponsor} size={compact ? 30 : 36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{sponsor.name}</span>
                  {sponsor.tagline && <span className="block text-[11px] text-muted truncate">{sponsor.tagline}</span>}
                </span>
              </a>
            );
          }
          return (
            <button key={slot} type="button" onClick={() => openSheet({ type: 'advertise', placement, slot })}
              className={cx('rounded-[20px] border border-dashed hairline flex items-center gap-3 px-3 text-left text-muted hover:text-ink hover:border-faint transition', compact ? 'py-2.5' : 'py-3')}>
              <span className={cx('rounded-xl bg-surface2 grid place-items-center shrink-0', compact ? 'w-[30px] h-[30px]' : 'w-9 h-9')}><LuPlus className="w-4 h-4" /></span>
              <span className="min-w-0"><span className="block text-[13px] font-medium">Your logo</span><span className="block text-[11px] truncate">Slot {slot} is open</span></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const fmtPrice = (feed, n) => `${feed.currency || '₹'}${Number(n || 0).toLocaleString('en-IN')}`;

export function AdvertiseSheet({ open, onClose, placement: initialPlacement = 'home', slot: initialSlot }) {
  const feed = useSponsors();
  const { toast } = useApp();
  const keys = Object.keys(feed.placements);
  const [placement, setPlacement] = useState(keys.includes(initialPlacement) ? initialPlacement : keys[0]);
  const slots = slotsFor(feed, placement);
  const firstOpen = slots.find((s) => !s.sponsor)?.slot || null;
  const [slot, setSlot] = useState(initialSlot || firstOpen);
  const [f, setF] = useState({ brand: '', link: '', tagline: '', name: '', email: '', logo: '' });
  const [err, setErr] = useState({});
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);
  const p = feed.placements[placement];
  const booking = feed.booking || {};
  const payLink = booking.paymentLinks?.[placement] || booking.paymentLinks?.default || '';
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const choosePlacement = (k) => {
    setPlacement(k);
    setSlot(slotsFor(feed, k).find((s) => !s.sponsor)?.slot || null);
  };
  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { setErr((x) => ({ ...x, logo: 'Choose a PNG, JPG, WebP or SVG image.' })); return; }
    if (file.size > 2 * 1024 * 1024) { setErr((x) => ({ ...x, logo: 'Keep the logo under 2 MB.' })); return; }
    const r = new FileReader();
    r.onload = () => { setF((x) => ({ ...x, logo: String(r.result) })); setErr((x) => ({ ...x, logo: undefined })); };
    r.readAsDataURL(file);
  };

  const summary = useMemo(() => [
    'Tend sponsorship request',
    `Placement: ${p?.label} · slot ${slot}`,
    `Price: ${fmtPrice(feed, p?.price)} / month`,
    `Brand: ${f.brand}`,
    `Link: ${f.link}`,
    f.tagline && `Tagline: ${f.tagline}`,
    `Contact: ${f.name} <${f.email}>`,
    `Logo: ${f.logo ? 'attached separately' : 'to follow'}`,
  ].filter(Boolean).join('\n'), [p, slot, f, feed]);

  const submit = () => {
    const e = {};
    if (!slot) e.slot = 'Every slot here is taken. Pick another placement.';
    if (!f.brand.trim()) e.brand = 'Add the name shown under your logo.';
    if (!sponsorHref(f.link.trim()) || !/\./.test(f.link)) e.link = 'Add your website, like acme.com.';
    if (!f.name.trim()) e.name = 'Add your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Add an email for the receipt.';
    setErr(e);
    if (Object.keys(e).length) return;
    setDone({ summary });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(done.summary); toast('Request copied'); } catch { toast('Copy blocked here. Select the text and copy it.'); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Advertise with Tend" wide
      footer={!done ? <><div className="flex-1" /><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Continue</Button></> : <><div className="flex-1" /><Button onClick={onClose}>Done</Button></>}>
      {!done ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-brandsoft p-4 flex gap-3">
            <LuShieldCheck className="w-5 h-5 text-brand shrink-0 mt-0.5" aria-hidden />
            <p className="text-[13px] leading-relaxed">Your logo, name and a link, styled like the rest of Tend. <b>No tracking, no pop-ups</b>, and never inside people's logs. Billed monthly, cancel any time.</p>
          </div>
          <Field label="Where">
            <div className="grid sm:grid-cols-2 gap-2">
              {keys.map((k) => {
                const pl = feed.placements[k];
                const open = slotsFor(feed, k).filter((s) => !s.sponsor).length;
                return (
                  <button key={k} type="button" aria-pressed={placement === k} onClick={() => choosePlacement(k)}
                    className={cx('rounded-2xl border-2 p-3 text-left transition', placement === k ? 'border-brand bg-brandsoft' : 'hairline border hover:bg-surface2')}>
                    <span className="flex items-baseline justify-between gap-2"><span className="font-medium text-[14px]">{pl.label}</span><span className="num text-[13px] font-semibold">{fmtPrice(feed, pl.price)}<span className="text-muted font-normal">/mo</span></span></span>
                    <span className="block text-[12px] text-muted mt-0.5">{pl.blurb}</span>
                    <span className={cx('block text-[11px] mt-1.5', open ? 'text-good' : 'text-faint')}>{open ? `${open} of ${pl.slots} slots open` : 'Fully booked'}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Slot" error={err.slot}>
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button key={s.slot} type="button" disabled={!!s.sponsor} aria-pressed={slot === s.slot} onClick={() => setSlot(s.slot)}
                  className={cx('h-14 rounded-xl border text-center transition disabled:opacity-40', slot === s.slot ? 'bg-ink text-bg border-transparent' : 'hairline hover:bg-surface2')}>
                  <span className="block text-[15px] font-semibold num">{s.slot}</span>
                  <span className="block text-[11px] opacity-70">{s.sponsor ? 'Taken' : 'Open'}</span>
                </button>
              ))}
            </div>
          </Field>
          <div className="grid sm:grid-cols-[1fr_140px] gap-4">
            <div className="flex flex-col gap-3 min-w-0">
              <Field label="Name under your logo" htmlFor="ad-brand" error={err.brand}><input id="ad-brand" className="field" value={f.brand} onChange={set('brand')} maxLength={28} placeholder="Acme" aria-invalid={!!err.brand} /></Field>
              <Field label="Link" htmlFor="ad-link" error={err.link}><input id="ad-link" className="field" value={f.link} onChange={set('link')} inputMode="url" placeholder="acme.com" aria-invalid={!!err.link} /></Field>
              <Field label="Short line" htmlFor="ad-tag" hint="Optional, up to 32 characters"><input id="ad-tag" className="field" value={f.tagline} onChange={set('tagline')} maxLength={32} placeholder="Budgeting made simple" /></Field>
            </div>
            <Field label="Logo" error={err.logo} hint="Square works best">
              <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square w-full rounded-2xl border border-dashed hairline grid place-items-center text-muted hover:bg-surface2 overflow-hidden">
                {f.logo ? <img src={f.logo} alt="Logo preview" className="w-full h-full object-contain p-3" /> : <span className="flex flex-col items-center gap-1 text-[12px]"><LuImagePlus className="w-5 h-5" />PNG, JPG, SVG</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Logo file" onChange={pickLogo} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Your name" htmlFor="ad-name" error={err.name}><input id="ad-name" className="field" value={f.name} onChange={set('name')} placeholder="Alex Morgan" aria-invalid={!!err.name} /></Field>
            <Field label="Email for the receipt" htmlFor="ad-email" error={err.email}><input id="ad-email" className="field" type="email" value={f.email} onChange={set('email')} placeholder="alex@acme.com" aria-invalid={!!err.email} /></Field>
          </div>
          {f.brand && (
            <Field label="Preview">
              <div className="card flex items-center gap-3 px-3 py-3 max-w-[260px]">
                {f.logo ? <img src={f.logo} alt="" className="w-9 h-9 rounded-xl object-contain bg-white" /> : <Logo sponsor={{ name: f.brand }} />}
                <span className="min-w-0"><span className="block text-[13px] font-semibold truncate">{f.brand}</span>{f.tagline && <span className="block text-[11px] text-muted truncate">{f.tagline}</span>}</span>
              </div>
            </Field>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-good/15 text-good grid place-items-center"><LuCheck className="w-5 h-5" /></span>
            <div><div className="font-semibold">{p.label}, slot {slot} · {fmtPrice(feed, p.price)}/month</div><div className="text-[13px] text-muted">Two steps to go live</div></div>
          </div>
          <ol className="flex flex-col gap-3 text-[14px]">
            <li className="rounded-2xl bg-surface2 p-3">
              <div className="font-medium mb-1">1. Send your request and logo</div>
              {booking.email || booking.whatsapp ? (
                <div className="text-[13px] text-muted flex flex-col gap-1">
                  {booking.email && <span>Email: <span className="select-all text-ink">{booking.email}</span></span>}
                  {booking.whatsapp && <span>WhatsApp: <span className="select-all text-ink">{booking.whatsapp}</span></span>}
                </div>
              ) : <div className="text-[13px] text-muted">Bookings open soon. Copy your request now and keep it handy.</div>}
              <pre className="mt-2 text-[12px] whitespace-pre-wrap rounded-xl bg-surface p-3 select-all mono">{done.summary}</pre>
              <Button size="sm" variant="secondary" icon={LuCopy} className="mt-2" onClick={copy}>Copy request</Button>
            </li>
            <li className="rounded-2xl bg-surface2 p-3">
              <div className="font-medium mb-1">2. Pay the first month</div>
              {payLink ? (
                <a href={payLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand text-onbrand text-[14px] font-medium">Pay {fmtPrice(feed, p.price)} <LuArrowUpRight className="w-4 h-4" /></a>
              ) : <div className="text-[13px] text-muted">Online payment opens soon.</div>}
              <div className="text-[12px] text-muted mt-2">Your tile goes live the day after payment and the logo check.</div>
            </li>
          </ol>
        </div>
      )}
    </Sheet>
  );
}

export function SupportLink({ className = '' }) {
  const feed = useSponsors();
  const link = feed.booking?.supportLink;
  if (!link) return null;
  return <a href={link} target="_blank" rel="noopener noreferrer" className={className}>Support Tend</a>;
}
