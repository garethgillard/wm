import { useEffect, useState } from 'react'
import { Chair, Figure } from './Cult'
import { RsvpChoice } from './Rsvp'
import { EMOJI, ROBES, rand, randomName } from '../lib/constants'
import { errorText } from '../lib/format'

// A centred card over a dimmed page. Escape closes it (when closing is allowed).
function Sheet({ title, lede, onSubmit, onClose, children, actions }) {
  useEffect(() => {
    if (!onClose) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="layer">
      <form className="sheet" autoComplete="off" onSubmit={e => { e.preventDefault(); onSubmit() }}>
        <h2>{title}</h2>
        {lede && <p className="lede">{lede}</p>}
        {children}
        <div className="sheet-actions">{actions}</div>
      </form>
    </div>
  )
}

// Wraps a save so the sheet shows a busy state and any error message.
function useSave(save, onDone) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(...args) {
    setBusy(true)
    setError('')
    try { await save(...args); onDone?.() } catch (e) { setError(typeof e === 'string' ? e : errorText(e)) } finally { setBusy(false) }
  }
  return { busy, error, setError, run }
}

export function JoinSheet({ current, players, me, onSave, onLeave, onClose }) {
  const [renouncing, setRenouncing] = useState(false)
  const [codename, setCodename] = useState(() => current?.codename ?? randomName())
  const [emoji, setEmoji] = useState(() => current?.emoji ?? rand(EMOJI.length))
  const [color, setColor] = useState(() => current?.color ?? rand(ROBES.length))
  const [rsvp, setRsvp] = useState(() => current?.rsvp ?? null)
  const { busy, error, setError, run } = useSave(onSave, onClose)
  const primary = current ? 'Save' : 'Join'

  function submit() {
    const name = current ? current.codename : codename.trim().replace(/\s+/g, ' ').slice(0, 28)
    if (name.length < 2) return setError('Your secret name needs at least 2 characters.')
    if (!current && Object.values(players).some(p => p.codename.toLowerCase() === name.toLowerCase())) return setError(errorText({ error: 'taken' }))
    if (!rsvp) return setError('Tell the circle whether you will attend.')
    run(name, emoji, color, rsvp)
  }

  return (
    <Sheet
      title={current ? 'Change your disguise' : 'Take your vows'}
      lede={current ? 'Your secret name is yours for good. The rest can change.' : 'In the WM Cult you are known only by your secret name. Choose well: it cannot be changed.'}
      onSubmit={submit}
      onClose={onClose}
      actions={<>
        <button className="btn" type="button" onClick={onClose}>{current ? 'Cancel' : 'Just looking'}</button>
        <button className="btn primary" type="submit" disabled={busy}>{primary}</button>
      </>}
    >
      <div className="preview">
        <svg className="preview-figure" viewBox="-62 -156 124 166" aria-hidden="true">
          <ellipse cx="0" cy="2" rx="52" ry="9" fill="#000" opacity="0.5" />
          <Chair />
          <Figure player={{ emoji, color }} lit={rsvp !== 'no'} />
        </svg>
        <span className="preview-name">{codename.trim() || 'Your secret name'}</span>
      </div>
      {!current && (
        <div>
          <label className="label" htmlFor="codename">Secret name</label>
          <div className="row">
            <input className="field" id="codename" maxLength={28} required value={codename} onChange={e => setCodename(e.target.value)} />
            <button className="btn dice-btn" type="button" onClick={e => { setCodename(randomName()); e.currentTarget.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 400, easing: 'ease-out' }) }}
              aria-label="Suggest a secret name" title="Suggest a secret name">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="8" cy="8" r="1.6" fill="currentColor" /><circle cx="16" cy="8" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="8" cy="16" r="1.6" fill="currentColor" /><circle cx="16" cy="16" r="1.6" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div>
        <span className="label">Your familiar</span>
        <div className="emojis">
          {EMOJI.map((e, i) => (
            <button key={e} type="button" aria-pressed={i === emoji} aria-label={`Familiar ${e}`} onClick={() => setEmoji(i)}>{e}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Your robe <span className="label-value">{ROBES[color].name}</span></span>
        <div className="swatches">
          {ROBES.map((r, i) => (
            <button key={r.name} type="button" aria-pressed={i === color} aria-label={`${r.name} robe`} title={r.name}
              style={{ '--robe': r.fill, '--robe-lit': r.lit }} onClick={() => setColor(i)} />
          ))}
        </div>
      </div>
      <div>
        <span className="label">Will you attend?</span>
        <RsvpChoice value={rsvp} onChange={v => { setRsvp(v); setError('') }} />
      </div>
      {error && <p className="err">{error}</p>}
      {current && onLeave && (
        <div className="renounce">
          {renouncing ? (
            <>
              <span>Your character will be gone for good. Start again?</span>
              <button type="button" className="btn danger small" onClick={onLeave}>Renounce</button>
              <button type="button" className="linkbtn" onClick={() => setRenouncing(false)}>Keep it</button>
            </>
          ) : (
            <button type="button" className="linkbtn danger-link" onClick={() => setRenouncing(true)}>Renounce your vows and start again</button>
          )}
        </div>
      )}
    </Sheet>
  )
}

export function OrganiserSheet({ hint, onUnlock, onClose }) {
  const [code, setCode] = useState('')
  const { busy, error, run } = useSave(
    c => onUnlock(c).catch(e => { throw e?.error === 'forbidden' ? "That code didn't work." : e }),
    onClose,
  )
  return (
    <Sheet
      title="Organiser’s entrance"
      lede="Speak the organiser code to edit the board and post notices."
      onSubmit={() => code.trim() && run(code.trim())}
      onClose={onClose}
      actions={<>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy}>Unlock</button>
      </>}
    >
      <div>
        <label className="label" htmlFor="adminInput">Organiser code</label>
        <input className="field full" id="adminInput" type="password" maxLength={100} autoComplete="off" value={code} onChange={e => setCode(e.target.value)} />
      </div>
      {hint && <p className="lede">{hint}</p>}
      {error && <p className="err">{error}</p>}
    </Sheet>
  )
}

export function PasscodeSheet({ wrong, onSubmit }) {
  const [code, setCode] = useState('')
  return (
    <Sheet
      title="The door is sealed"
      lede="Speak the password the organiser gave you to enter the chamber."
      onSubmit={() => code.trim() && onSubmit(code.trim())}
      actions={<button className="btn primary" type="submit">Enter the chamber</button>}
    >
      <div>
        <label className="label" htmlFor="passInput">Password</label>
        <input className="field full" id="passInput" maxLength={100} autoCapitalize="off" autoCorrect="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} />
      </div>
      {wrong && <p className="err">The door stays shut. Check the password with the organiser.</p>}
    </Sheet>
  )
}
