// Aye / Nay. Tapping your current choice again takes your vote back.
export function VoteButtons({ aid, count, mine, disabled, onVote }) {
  return (
    <span className="votes">
      <button type="button" className="vbtn aye" aria-pressed={mine === 1} disabled={disabled}
        onClick={() => onVote(aid, mine === 1 ? 0 : 1)} aria-label={`Aye, ${count.go.length} so far`}>
        <span>Aye</span><span className="n">{count.go.length}</span>
      </button>
      <button type="button" className="vbtn nay" aria-pressed={mine === -1} disabled={disabled}
        onClick={() => onVote(aid, mine === -1 ? 0 : -1)} aria-label={`Nay, ${count.nogo.length} so far`}>
        <span>Nay</span><span className="n">{count.nogo.length}</span>
      </button>
    </span>
  )
}
