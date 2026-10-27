import { RSVP } from '../lib/format'

// Yes / Maybe / No. Yes takes a seat at the table, Maybe waits in the shadows, No stays out of the picture.
export function RsvpChoice({ value, onChange, disabled }) {
  return (
    <div className="rsvp-choice" role="radiogroup" aria-label="Will you attend?">
      {Object.entries(RSVP).map(([key, r]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} className={`rsvp-btn ${key}`}
          disabled={disabled} onClick={() => onChange(key)}>
          {r.button}
        </button>
      ))}
    </div>
  )
}

export function rsvpCounts(players) {
  const c = { yes: 0, maybe: 0, no: 0, none: 0 }
  for (const p of Object.values(players)) c[p.rsvp in RSVP ? p.rsvp : 'none']++
  return c
}
