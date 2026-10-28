// Book cover photos. Inside Claude, a cover is uploaded to the artifact's own
// file storage, so it follows you to other devices and draws cleanly on share
// cards. Elsewhere it is kept as a small JPEG inside your saved data.

async function downscale(file, maxW = 360, maxH = 540) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const r = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * r);
    c.height = Math.round(img.naturalHeight * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.84));
    return { blob, dataUrl: c.toDataURL('image/jpeg', 0.72) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveCover(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Choose an image file (JPG, PNG or WebP).');
  if (file.size > 20 * 1024 * 1024) throw new Error('That image is over 20 MB. Choose a smaller one.');
  let scaled;
  try { scaled = await downscale(file); } catch { throw new Error("Couldn't read that image. Try a JPG or PNG."); }
  const c = window.claude;
  if (c && typeof c.use === 'function') {
    let assets = null;
    try { assets = await c.use('assets'); } catch { assets = null; }
    if (assets) {
      try {
        const res = await assets.upload(scaled.blob);
        return { coverId: res.id, coverData: null };
      } catch { /* fall back to keeping it locally */ }
    }
  }
  return { coverId: null, coverData: scaled.dataUrl };
}

// Images for canvas drawing. Fetched as blobs so the exported PNG is never tainted.
const cache = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!cache.has(src)) {
    cache.set(src, (async () => {
      try {
        let url = src;
        let revoke = null;
        if (!src.startsWith('data:')) {
          const r = await fetch(src);
          if (!r.ok) return null;
          url = revoke = URL.createObjectURL(await r.blob());
        }
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 60000);
        return img;
      } catch {
        return null;
      }
    })());
  }
  return cache.get(src);
}

/* ───────────── Online cover search (Open Library + Google Books) ─────────────
   In the Android app requests go through the native shell (no browser CORS
   limits). On a normal website plain fetch() is used. Inside a Claude artifact
   the page can't reach other sites, so search reports that clearly. */

const pending = new Map();
let seq = 0;
if (typeof window !== 'undefined') {
  window.__tendFetchDone = (id, ok, payload) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.res(payload); else p.rej(new Error(payload || 'Network error'));
  };
}
const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });

export function netGet(url, asImage = false, timeout = 15000) {
  if (window.TendNative?.fetch) {
    return new Promise((res, rej) => {
      const id = `f${++seq}`;
      pending.set(id, { res, rej });
      try { window.TendNative.fetch(id, url, asImage); } catch (e) { pending.delete(id); rej(e); return; }
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout')); } }, timeout);
    });
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  return fetch(url, { signal: ctl.signal })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return asImage ? blobToDataUrl(await r.blob()) : r.text();
    })
    .finally(() => clearTimeout(t));
}

export const inClaude = () => typeof window !== 'undefined' && !window.TendNative && typeof window.claude?.use === 'function';
export const OFFLINE_MSG = inClaude()
  ? "Cover search can't reach the internet from inside Claude. It works in the Android app. Here, use Upload cover instead."
  : "Couldn't reach the book search. Check your connection and try again.";

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function openLibrary(title, author) {
  const p = new URLSearchParams({ limit: '10', fields: 'title,author_name,cover_i,first_publish_year,number_of_pages_median' });
  if (author) { p.set('title', title); p.set('author', author); } else p.set('q', title);
  const j = JSON.parse(await netGet(`https://openlibrary.org/search.json?${p}`));
  return (j.docs || []).filter((d) => d.cover_i).map((d) => ({
    title: d.title, author: (d.author_name || []).slice(0, 2).join(' & '), pages: d.number_of_pages_median || null,
    year: d.first_publish_year || null, thumb: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
    full: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, source: 'Open Library',
  }));
}

async function googleBooks(title, author) {
  const q = `intitle:${title}${author ? `+inauthor:${author}` : ''}`;
  const j = JSON.parse(await netGet(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books`));
  return (j.items || []).map((it) => it.volumeInfo || {}).filter((v) => v.imageLinks?.thumbnail).map((v) => {
    const t = v.imageLinks.thumbnail.replace(/^http:/, 'https:').replace('&edge=curl', '');
    return {
      title: v.title + (v.subtitle && v.title.length < 24 ? `: ${v.subtitle}` : ''), author: (v.authors || []).slice(0, 2).join(' & '),
      pages: v.pageCount || null, year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) : null,
      thumb: t, full: t.replace(/zoom=\d/, 'zoom=1') + '&fife=w480', source: 'Google Books',
    };
  });
}

/** Search both catalogues; best title/author matches first. Throws OFFLINE_MSG if neither answers. */
export async function searchBooks(title, author = '') {
  title = title.trim(); author = author.trim();
  if (!title) return [];
  const [a, b] = await Promise.allSettled([openLibrary(title, author), googleBooks(title, author)]);
  if (a.status === 'rejected' && b.status === 'rejected') throw new Error(OFFLINE_MSG);
  const all = [...(a.value || []), ...(b.value || [])];
  const nt = norm(title), na = norm(author);
  const score = (r) => {
    const t = norm(r.title);
    let s = t === nt ? 3 : t.startsWith(nt) || nt.startsWith(t) ? 2 : t.includes(nt) ? 1 : 0;
    if (na && norm(r.author).split(' ').some((w) => w.length > 2 && na.includes(w))) s += 2;
    return s;
  };
  // interleave sources so both catalogues show, then sort by match quality (stable)
  const seen = new Set();
  return all.map((r, i) => ({ r, i, s: score(r) })).sort((x, y) => y.s - x.s || x.i - y.i).map((x) => x.r)
    .filter((r) => (seen.has(r.thumb) ? false : (seen.add(r.thumb), true))).slice(0, 12);
}

async function shrinkDataUrl(dataUrl, maxW = 320, maxH = 480) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = dataUrl; });
  // Open Library serves a 1×1 placeholder when it has no image
  if (img.naturalWidth < 20 || img.naturalHeight < 20) throw new Error('No cover image for this edition.');
  const r = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * r);
  c.height = Math.round(img.naturalHeight * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.74);
}

/** Download a chosen cover and keep it with the book (works offline afterwards and on share cards). */
export async function coverFromResult(result) {
  let data;
  try { data = await netGet(result.full, true, 20000); } catch { data = await netGet(result.thumb, true, 20000); }
  return { coverData: await shrinkDataUrl(data), coverId: null };
}

/** Fill in real covers for every book that has none. onProgress(done, total). */
export async function fetchMissingCovers(books, setCover, onProgress) {
  const todo = books.filter((b) => !b.coverId && !b.coverData);
  let found = 0;
  for (let i = 0; i < todo.length; i++) {
    const b = todo[i];
    try {
      const res = await searchBooks(b.title, b.author);
      for (const r of res.slice(0, 3)) {
        try { setCover(b.id, await coverFromResult(r)); found++; break; } catch { /* try the next edition */ }
      }
    } catch (e) {
      if (e.message === OFFLINE_MSG) throw e;
    }
    onProgress?.(i + 1, todo.length);
  }
  return { found, total: todo.length };
}
