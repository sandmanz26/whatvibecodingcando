/**
 * The SaaS and the content site are served from the same domain (/saas and /content), so they
 * share the browser's localStorage and sessionStorage. Without this, comments, tests, versions and
 * the demo account of one would show up in the other. Every key the SaaS app reads or writes gets
 * a "saas:" prefix, so it keeps its own data.
 *
 * Keys starting with "vibe:" are left as they are: they belong to the installable script, which
 * runs on its own (on the demo site and customers' sites) and stores per project; the panel's
 * inbox must read the same keys the script writes.
 *
 * Imported first in main.tsx, before any module reads storage.
 */
const PREFIX = 'saas:'
const scoped = (k: string) => (k.startsWith('vibe:') || k.startsWith(PREFIX) ? k : PREFIX + k)
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
