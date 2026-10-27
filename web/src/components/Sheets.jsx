import { useEffect, useState } from 'react'
import { Chair, Figure } from './Cult'
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

export function JoinSheet({ current, players, me, onSave, onClose }) {
  const [codename, setCodename] = useState(() => current?.codename ?? randomName())
  const [emoji, setEmoji] = useState(() => current?.emoji ?? rand(EMOJI.length))
  const [color, setColor] = useState(() => current?.color ?? rand(ROBES.length))
  const { busy, error, setError, run } = useSave(onSave, onClose)

  function submit() {
    const name = codename.trim().replace(/\s+/g, ' ').slice(0, 28)
    if (name.length < 2) return setError('Your secret name needs at least 2 characters.')
    if (Object.values(players).some(p => p.id !== me && p.codename.toLowerCase() === name.toLowerCase())) return setError(errorText({ error: 'taken' }))
    run(name, emoji, color)
  }

  return (
    <Sheet
      title={current ? 'Change your disguise' : 'Take your vows'}
      lede={current ? null : 'Members of the WM Cult are known only by their secret names. Choose yours, then your familiar and your robe.'}
      onSubmit={submit}
      onClose={onClose}
      actions={<>
        <button className="btn" type="button" onClick={onClose}>{current ? 'Cancel' : 'Watch from the shadows'}</button>
        <button className="btn primary" type="submit" disabled={busy}>{current ? 'Save' : 'Take a seat'}</button>
      </>}
    >
      <div className="preview">
        <svg className="preview-figure" viewBox="-62 -156 124 166" aria-hidden="true">
          <ellipse cx="0" cy="2" rx="52" ry="9" fill="#000" opacity="0.5" />
          <Chair />
          <Figure player={{ emoji, color }} lit />
        </svg>
        <span className="preview-name">{codename.trim() || 'Your secret name'}</span>
      </div>
      <div>
        <label className="label" htmlFor="codename">Secret name</label>
        <div className="row">
          <input className="field" id="codename" maxLength={28} required value={codename} onChange={e => setCodename(e.target.value)} />
          <button className="btn" type="button" onClick={() => setCodename(randomName())} aria-label="Suggest a secret name">Divine one</button>
        </div>
      </div>
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
      {error && <p className="err">{error}</p>}
    </Sheet>
  )
}

export function InfoSheet({ info, onSave, onClose }) {
  const [name, setName] = useState(info?.name || 'The Halloween Conclave')
  const [when, setWhen] = useState(info?.when || '')
  const [where, setWhere] = useState(info?.where || '')
  const { busy, error, run } = useSave(onSave, onClose)

  return (
    <Sheet
      title="Edit the summons"
      onSubmit={() => run({ name, when, where })}
      onClose={onClose}
      actions={<>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy}>Save the summons</button>
      </>}
    >
      <div className="stack-fields">
        <div><label className="label" htmlFor="infoName">Name of the gathering</label><input className="field full" id="infoName" maxLength={40} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="infoWhen">When</label><input className="field full" id="infoWhen" maxLength={60} placeholder="Fri 30 Oct, from 18:00" value={when} onChange={e => setWhen(e.target.value)} /></div>
        <div><label className="label" htmlFor="infoWhere">Where</label><input className="field full" id="infoWhere" maxLength={60} placeholder="To be revealed" value={where} onChange={e => setWhere(e.target.value)} /></div>
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
      lede="The organiser code lets you edit the summons, post notices and remove any rite."
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
