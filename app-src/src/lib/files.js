// Save a generated file. Inside Claude the frame can't start downloads itself,
// so it goes through the viewer's `downloads` capability (the viewer confirms).
// Opened as a standalone page, a normal browser download is used instead.
const toBase64 = (data) => new Promise((res, rej) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = rej;
  r.readAsDataURL(blob);
});
const mimeOf = (name) => (/\.png$/i.test(name) ? 'image/png' : /\.json$/i.test(name) ? 'application/json' : 'application/octet-stream');
export const isNative = () => typeof window !== 'undefined' && !!window.TendNative;

// Android app: hand the file to the share sheet
export async function shareNative(filename, data) {
  if (!window.TendNative?.shareFile) return false;
  try { return window.TendNative.shareFile(filename, await toBase64(data), mimeOf(filename)) === 'ok'; } catch { return false; }
}

export async function saveFile(filename, data) {
  if (window.TendNative?.saveFile) {
    try { return window.TendNative.saveFile(filename, await toBase64(data), mimeOf(filename)) === 'ok' ? 'saved' : 'failed'; } catch { return 'failed'; }
  }
  const c = typeof window !== 'undefined' ? window.claude : null;
  if (c && typeof c.use === 'function') {
    let d = null;
    try { d = await c.use('downloads'); } catch { d = null; }
    if (!d) return 'unavailable';
    try {
      await d.save({ filename, data });
      return 'saved';
    } catch (e) {
      if (e?.code === 'declined') return 'declined';
      if (e?.code === 'rate_limited') return 'failed';
      return 'unavailable';
    }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'fallback';
  } catch {
    return 'failed';
  }
}
