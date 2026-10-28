// Direct-sold sponsor slots (no ad network, no tracking).
// The list lives in sponsors.json next to the web app, so sponsors change
// without an app update. The app keeps the last copy for offline use.
import { useEffect, useState } from 'react';
import { todayKey } from './date.js';
import { netGet } from './covers.js';

/* Edit sponsors.json (shipped with the web app) to run the programme:
   - booking.email / booking.whatsapp: where booking requests go
   - booking.paymentLinks[placement]: a Razorpay / Dodo / Stripe payment link per placement
   - booking.supportLink: a "Support Tend" donation link
   - sponsors: one entry per paid slot (placement, slot number, name, url, logo, until) */
export const DEFAULT_FEED = {
  version: 1,
  currency: '₹',
  placements: {
    home: { label: 'Home screen', blurb: 'Seen every time someone opens Tend', slots: 4, price: 2999 },
    reading: { label: 'Reading', blurb: 'Readers tracking books and pages', slots: 2, price: 1499 },
    finance: { label: 'Finance', blurb: 'People budgeting and saving', slots: 2, price: 1499 },
    gym: { label: 'Fitness', blurb: 'People logging workouts', slots: 2, price: 1499 },
    habits: { label: 'Habits', blurb: 'People building daily routines', slots: 2, price: 1499 },
    export: { label: 'After sharing', blurb: 'Shown when someone saves a share card', slots: 2, price: 999 },
  },
  booking: { email: '', whatsapp: '', paymentLinks: {}, supportLink: '' },
  sponsors: [],
};

const CACHE = 'tend.sponsors.v1';
// When the Android app or the Claude version should read your hosted list, put its full https URL here.
export const REMOTE_FEED_URL = '';

function readCache() {
  try { const j = JSON.parse(localStorage.getItem(CACHE) || 'null'); return j?.placements ? j : null; } catch { return null; }
}
function writeCache(feed) { try { localStorage.setItem(CACHE, JSON.stringify(feed)); } catch { /* optional */ } }

function merge(feed) {
  return {
    ...DEFAULT_FEED, ...feed,
    placements: { ...DEFAULT_FEED.placements, ...(feed?.placements || {}) },
    booking: { ...DEFAULT_FEED.booking, ...(feed?.booking || {}) },
    sponsors: Array.isArray(feed?.sponsors) ? feed.sponsors : [],
  };
}

let current = merge(readCache() || DEFAULT_FEED);
let loading = null;
const listeners = new Set();

async function fetchText(url) {
  if (window.TendNative?.fetch) return netGet(url, false);
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

export function loadSponsors() {
  if (loading) return loading;
  const hosted = /^https?:$/.test(location.protocol) && !window.TendNative && !(window.claude && typeof window.claude.use === 'function');
  const url = hosted ? './sponsors.json' : REMOTE_FEED_URL;
  if (!url) return Promise.resolve(current);
  loading = fetchText(url)
    .then((t) => {
      current = merge(JSON.parse(t));
      writeCache(current);
      listeners.forEach((fn) => fn(current));
      return current;
    })
    .catch(() => current);
  return loading;
}

export function useSponsors() {
  const [feed, setFeed] = useState(current);
  useEffect(() => {
    listeners.add(setFeed);
    loadSponsors();
    return () => listeners.delete(setFeed);
  }, []);
  return feed;
}

/** Slot list for a placement: [{ slot, sponsor|null }] with expired sponsors removed. */
export function slotsFor(feed, placement) {
  const p = feed.placements[placement];
  if (!p) return [];
  const today = todayKey();
  const live = feed.sponsors.filter((s) => s.placement === placement && (!s.until || s.until >= today));
  return Array.from({ length: p.slots }, (_, i) => ({ slot: i + 1, sponsor: live.find((s) => Number(s.slot) === i + 1) || null }));
}

export function sponsorHref(url) {
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    if (!u.searchParams.has('ref')) u.searchParams.set('ref', 'tend');
    return u.toString();
  } catch { return null; }
}
