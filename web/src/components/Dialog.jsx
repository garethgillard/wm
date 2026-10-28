// A pop-up box over a dimmed page, with a big ✕. Escape or a tap outside also closes it.
// The body scrolls when the content is taller than the screen.
import { useEffect } from 'react'

export function Dialog({ title, label, className = '', onClose, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="layer dialog-layer" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`dialog ${className}`} role="dialog" aria-modal="true" aria-label={label || title}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close" autoFocus>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
        {title && <h2 className="dialog-title">{title}</h2>}
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  )
}
