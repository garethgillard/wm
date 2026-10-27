// The first thing a newcomer sees: the letters, and a way in.
import { useState } from 'react'

export function Landing({ onEnter }) {
  const [leaving, setLeaving] = useState(false)
  function enter() {
    setLeaving(true)
    setTimeout(onEnter, 650) // let the fade finish
  }
  return (
    <div className={`landing${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label="The WM Cult">
      <h1 className="landing-mark">WM</h1>
      <button type="button" className="landing-enter" onClick={enter} autoFocus>Enter</button>
    </div>
  )
}
