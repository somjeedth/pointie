// Shared DOM helpers (customer app + merchant web).
// ---- In-place DOM patching ------------------------------------------------
// Re-renders within the same screen patch the existing DOM instead of
// replacing it, so CSS transitions actually run (carousel slide, pin select,
// toggles), images aren't re-decoded and scroll position/focus are kept.
function syncAttrs(from, to) {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
}
export function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName || (from.id || to.id) && from.id !== to.id) {
    from.replaceWith(to); return;
  }
  if (from.nodeType === Node.TEXT_NODE || from.nodeType === Node.COMMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  syncAttrs(from, to);
  if (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA') {
    if (document.activeElement !== from && from.value !== (to.value ?? '')) from.value = to.value ?? '';
    if (from.tagName === 'INPUT') return;
  }
  morphChildren(from, to);
}
export function morphChildren(from, to) {
  const a = [...from.childNodes], b = [...to.childNodes];
  b.forEach((nb, i) => { if (a[i]) morph(a[i], nb); else from.appendChild(nb); });
  for (let i = b.length; i < a.length; i++) a[i].remove();
}

// Listeners added inside mount() are tied to this AbortController and dropped
// on the next render, so patched (reused) elements never get duplicates.
let mountAbort = null;
export function runMount(screen, root, ctx) {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const { signal } = mountAbort;
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const o = typeof opts === 'object' && opts ? { ...opts, signal } : { capture: !!opts, signal };
    return orig.call(this, type, fn, o);
  };
  try { return screen.mount?.(root, ctx) || null; } finally { EventTarget.prototype.addEventListener = orig; }
}

