import type { ReactNode } from 'react'

/**
 * A copy of how the product's widget looks (the dock, a pin, the new-comment card, a thread), so
 * the landing page can show the real thing instead of describing it. It is a drawing of the
 * widget, written here from scratch: nothing is imported from apps/saas, and it stores nothing.
 * Styles: the `.w-` rules in styles.css, which use the product's own colours, not the page's.
 */
const I = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)
export const IcComment = ({ size }: { size?: number }) => <I size={size} d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 7v6M9 10h6" />
export const IcList = ({ size }: { size?: number }) => <I size={size} d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2zM18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
export const IcCheck = ({ size }: { size?: number }) => <I size={size} d="M20 6 9 17l-5-5" />
export const IcX = ({ size }: { size?: number }) => <I size={size} d="M18 6 6 18M6 6l12 12" />
export const IcTrash = ({ size }: { size?: number }) => <I size={size} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
export const IcMic = ({ size }: { size?: number }) => <I size={size} d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
export const IcCopy = ({ size }: { size?: number }) => <I size={size} d="M9 9h11v11H9zM5 15H4V4h11v1" />
export const IcSpark = ({ size }: { size?: number }) => <I size={size} d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 16v4M17 18h4" />
export const IcLock = ({ size }: { size?: number }) => <I size={size} d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
export const IcMonitor = ({ size }: { size?: number }) => <I size={size} d="M3 4h18v12H3zM8 21h8M12 16v5" />
export const IcPhone = ({ size }: { size?: number }) => <I size={size} d="M7 2h10v20H7zM11 18h2" />

export function WPin({ n, done, className = '' }: { n: ReactNode; done?: boolean; className?: string }) {
  return <span className={`w-pin ${done ? 'done' : ''} ${className}`} aria-hidden>{done ? <IcCheck size={11} /> : n}</span>
}

/** The pill that sits in the corner of a site with the script installed. */
export function WDock({ count = 0, active, onComment, onList, label }: { count?: number; active?: boolean; onComment?: () => void; onList?: () => void; label?: string }) {
  const Btn = onComment ? 'button' : 'span'
  const Lst = onList ? 'button' : 'span'
  return (
    <div className="w w-dock">
      <Btn className={`w-dock-main ${active ? 'cancel' : ''}`} onClick={onComment}><IcComment />{label ?? (active ? 'Cancel' : 'Comment')}</Btn>
      <Lst className="w-dock-icon" onClick={onList} aria-label={onList ? `All comments, ${count} on this page` : undefined}><IcList size={15} />{count > 0 && <i>{count}</i>}</Lst>
    </div>
  )
}

export interface WReply { author: string; text: ReactNode }

/** A posted comment with its thread, as the widget shows it next to the pin. */
export function WThread({ n, author, time = 'just now', text, replies = [], done, onDone, onDelete, onClose, meta, children }: {
  n: number; author: string; time?: string; text: ReactNode; replies?: WReply[]; done?: boolean
  onDone?: () => void; onDelete?: () => void; onClose?: () => void; meta?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="w w-card w-thread">
      <div className="w-top">
        <span className={`w-status ${done ? 'done' : ''}`}>{done ? 'Completed' : 'Open'}</span>
        <b>#{n}</b>
        {meta && <span className="w-meta">{meta}</span>}
        <span className="w-grow" />
        {onDelete && <button className="w-ic" onClick={onDelete} aria-label="Delete comment"><IcTrash size={13} /></button>}
        {onClose && <button className="w-ic" onClick={onClose} aria-label="Close"><IcX size={14} /></button>}
      </div>
      <p className="w-by"><b>{author}</b> · {time}</p>
      <p className="w-text">{text}</p>
      {children}
      {replies.map((r, i) => (
        <div className="w-reply" key={i}><p className="w-by"><b>{r.author}</b> · just now</p><p className="w-text">{r.text}</p></div>
      ))}
      <div className="w-actions">
        {onDone
          ? <button className="w-btn" onClick={onDone}><IcCheck size={13} />{done ? 'Reopen' : 'Set as completed'}</button>
          : <span className="w-btn"><IcCheck size={13} />{done ? 'Reopen' : 'Set as completed'}</span>}
        <span className="w-grow" />
        <span className="w-btn primary soft">Reply</span>
      </div>
    </div>
  )
}

/** A small browser window to put the widget in, so it reads as "on your site". */
export function Browser({ url, children, className = '' }: { url: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bw ${className}`}>
      <div className="bw-bar"><i /><i /><i /><span>{url}</span></div>
      <div className="bw-body">{children}</div>
    </div>
  )
}
