// Real connection: one WebSocket to the Python server, reconnecting with back-off.
export function connectSocket({ onOpen, onMessage, onClose }) {
  let ws = null
  let retry = 0
  let stopped = false
  let timer = 0

  const url = () => {
    const u = new URL('ws', window.location.href) // works at / and under a sub-path like /party/
    u.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    u.search = ''
    u.hash = ''
    return u.href
  }

  function open() {
    ws = new WebSocket(url())
    ws.onopen = () => { retry = 0; onOpen() }
    ws.onmessage = e => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg && typeof msg === 'object') onMessage(msg)
    }
    ws.onclose = () => {
      onClose()
      if (!stopped) timer = setTimeout(open, Math.min(15000, 800 * 2 ** retry++) + Math.random() * 400)
    }
  }

  // Reconnect straight away when a phone comes back from sleep.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && ws && ws.readyState > 1 && !stopped) { clearTimeout(timer); retry = 0; open() }
  }
  document.addEventListener('visibilitychange', onVisible)
  open()

  return {
    send: obj => { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)) },
    isOpen: () => ws?.readyState === 1,
    close: () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); ws?.close() },
  }
}
