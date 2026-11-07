/**
 * The SaaS and the content site are served from the same domain (/saas and /content), so they
 * share the browser's localStorage and sessionStorage. Without this, comments, tests, versions and
 * the demo account of one would show up in the other. Every key the SaaS app reads or writes gets
 * a "saas:" prefix, so it keeps its own data.
 *
 * The SaaS installable script stores under "saas:vibe:" itself (src/core/embed/store.ts), and keys
 * that already carry the prefix are left alone, so the panel reads exactly what the script writes.
 * Nothing is shared with the content site.
 *
 * Imported first in main.tsx, before any module reads storage.
 */
const PREFIX = 'saas:'
const scoped = (k: string) => (k.startsWith(PREFIX) ? k : PREFIX + k)
const proto = Storage.prototype
const { getItem, setItem, removeItem } = proto
proto.getItem = function (k: string) { return getItem.call(this, scoped(String(k))) }
proto.setItem = function (k: string, v: string) { setItem.call(this, scoped(String(k)), v) }
proto.removeItem = function (k: string) { removeItem.call(this, scoped(String(k))) }

// Storage events carry the stored key; hand listeners the key they asked for.
const keyGetter = Object.getOwnPropertyDescriptor(StorageEvent.prototype, 'key')?.get
if (keyGetter) {
  Object.defineProperty(StorageEvent.prototype, 'key', {
    configurable: true,
    get() { const k = keyGetter.call(this) as string | null; return k?.startsWith(PREFIX) ? k.slice(PREFIX.length) : k },
  })
}

export {}
