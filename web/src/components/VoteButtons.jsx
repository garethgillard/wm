// Tapping your current choice again clears it.
export function VoteButtons({ aid, count, mine, disabled, onVote }) {
  return (
    <>
      <button type="button" className="vbtn go" aria-pressed={mine === 1} disabled={disabled}
        onClick={() => onVote(aid, mine === 1 ? 0 : 1)} aria-label={`Go, ${count.go.length} so far`}>
        <span>Go</span><span className="n">{count.go.length}</span>
      </button>
      <button type="button" className="vbtn nogo" aria-pressed={mine === -1} disabled={disabled}
        onClick={() => onVote(aid, mine === -1 ? 0 : -1)} aria-label={`No-go, ${count.nogo.length} so far`}>
        <span>No-go</span><span className="n">{count.nogo.length}</span>
      </button>
    </>
  )
}
