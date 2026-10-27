import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import { COLORS, EMOJI, rand, randomName } from '../lib/constants'
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

export function JoinSheet({ current, players, me, onSave, onClose }) {
  const [codename, setCodename] = useState(() => current?.codename ?? randomName())
  const [emoji, setEmoji] = useState(() => current?.emoji ?? rand(EMOJI.length))
  const [color, setColor] = useState(() => current?.color ?? rand(COLORS.length))
  const { busy, error, setError, run } = useSave(onSave, onClose)

  function submit() {
    const name = codename.trim().replace(/\s+/g, ' ').slice(0, 28)
    if (name.length < 2) return setError('Pick a codename with at least 2 characters.')
    if (Object.values(players).some(p => p.id !== me && p.codename.toLowerCase() === name.toLowerCase())) return setError(errorText({ error: 'taken' }))
    run(name, emoji, color)
  }

  return (
    <Sheet
      title={current ? 'Change your identity' : 'Choose your secret identity'}
      lede={current ? null : "Everyone here goes by a codename. Pick one, choose an avatar, and you're in."}
      onSubmit={submit}
      onClose={onClose}
      actions={<>
        <button className="btn" type="button" onClick={onClose}>{current ? 'Cancel' : 'Not now'}</button>
        <button className="btn primary" type="submit" disabled={busy}>{current ? 'Save' : 'Join the party'}</button>
      </>}
    >
      <div className="preview">
        <Avatar player={{ emoji, color }} size="lg" />
        <span className="preview-name">{codename.trim() || 'Codename'}</span>
      </div>
      <div>
        <label className="label" htmlFor="codename">Codename</label>
        <div className="row">
          <input className="field" id="codename" maxLength={28} required value={codename} onChange={e => setCodename(e.target.value)} />
          <button className="btn" type="button" onClick={() => setCodename(randomName())} aria-label="Random codename">🎲</button>
        </div>
      </div>
      <div>
        <span className="label">Avatar</span>
        <div className="emojis">
          {EMOJI.map((e, i) => (
            <button key={e} type="button" aria-pressed={i === emoji} aria-label={`Avatar ${e}`} onClick={() => setEmoji(i)}>{e}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Colour</span>
        <div className="swatches">
          {COLORS.map((c, i) => (
            <button key={c} type="button" aria-pressed={i === color} aria-label={`Colour ${i + 1}`} style={{ '--av': c }} onClick={() => setColor(i)} />
          ))}
        </div>
      </div>
      {error && <p className="err">{error}</p>}
    </Sheet>
  )
}

export function InfoSheet({ info, onSave, onClose }) {
  const [name, setName] = useState(info?.name || 'Work party')
  const [when, setWhen] = useState(info?.when || '')
  const [where, setWhere] = useState(info?.where || '')
  const { busy, error, run } = useSave(onSave, onClose)

  return (
    <Sheet
      title="Party details"
      onSubmit={() => run({ name, when, where })}
      onClose={onClose}
      actions={<>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy}>Save details</button>
      </>}
    >
      <div className="stack-fields">
        <div><label className="label" htmlFor="infoName">Party name</label><input className="field full" id="infoName" maxLength={40} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="infoWhen">When</label><input className="field full" id="infoWhen" maxLength={60} placeholder="Fri 11 Dec, from 17:00" value={when} onChange={e => setWhen(e.target.value)} /></div>
        <div><label className="label" htmlFor="infoWhere">Where</label><input className="field full" id="infoWhere" maxLength={60} placeholder="Still to be decided" value={where} onChange={e => setWhere(e.target.value)} /></div>
      </div>
      {error && <p className="err">{error}</p>}
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
      title="Organiser mode"
      lede="With the organiser code you can edit the party details and remove any activity."
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
      title="Invite only"
      lede="Enter the passcode from the organiser to get into Party HQ."
      onSubmit={() => code.trim() && onSubmit(code.trim())}
      actions={<button className="btn primary" type="submit">Enter</button>}
    >
      <div>
        <label className="label" htmlFor="passInput">Passcode</label>
        <input className="field full" id="passInput" maxLength={100} autoCapitalize="off" autoCorrect="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} />
      </div>
      {wrong && <p className="err">That passcode didn't work. Check it with the organiser.</p>}
    </Sheet>
  )
}
