// Text that its owner can tap to edit in place. Enter saves, Escape cancels.
// Everyone else just sees the text.
import { useState } from 'react'
import { errorText } from '../lib/format'

function Pencil() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M11.2 2.3 L13.7 4.8 L5.6 12.9 L2.6 13.4 L3.1 10.4 Z M9.8 3.7 L12.3 6.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function EditableText({ value, canEdit, onSave, label, maxLength = 200, multiline = false, allowEmpty = false, placeholder = '', className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function start() { setDraft(value || ''); setError(''); setEditing(true) }
  function cancel() { setEditing(false); setError('') }

  async function save(e) {
    e?.preventDefault()
    const text = draft.replace(/\s+/g, ' ').trim()
    if (text === (value || '')) return cancel()
    if (!text && !allowEmpty) return setError('This can’t be empty.')
    setBusy(true)
    try { await onSave(text); setEditing(false) } catch (ex) { setError(errorText(ex)) } finally { setBusy(false) }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancel() }
    if (e.key === 'Enter' && (!multiline || !e.shiftKey)) save(e)
  }

  if (editing) {
    const Field = multiline ? 'textarea' : 'input'
    return (
      <form className={`inline-edit ${className}`} onSubmit={save}>
        <Field className="field inline-field" value={draft} maxLength={maxLength} autoFocus aria-label={`Edit ${label}`}
          rows={multiline ? Math.min(5, Math.ceil(draft.length / 38) + 1) : undefined}
          onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown} />
        <div className="inline-actions">
          <button type="submit" className="btn primary small" disabled={busy}>Save</button>
          <button type="button" className="btn small" onClick={cancel}>Cancel</button>
          {error && <span className="err">{error}</span>}
        </div>
      </form>
    )
  }

  if (!canEdit) return <span className={className}>{value || placeholder}</span>
  return (
    <span className={`editable ${className}`}>
      <span className="editable-text" role="button" tabIndex={0} title={`Tap to edit ${label}`}
        onClick={start} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start() } }}>
        {value || <em className="placeholder">{placeholder}</em>}
      </span>
      <button type="button" className="edit-btn" onClick={start} aria-label={`Edit ${label}`}><Pencil /></button>
    </span>
  )
}
