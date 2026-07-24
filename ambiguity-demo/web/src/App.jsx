import { useState } from 'react'

const SAMPLE = `태스크 각 스텝별 진행에 필요한 필수 요건이 충족된 상태인 경우에 한하여 태스크를 재전개할 수 있어야 한다.
장비는 충분한 내구성을 가져야 한다.
알람 발생 시 관련 부서와 협의하여 적절히 조치한다.
AMR은 IEC 60204-1 안전 규격을 만족해야 한다.
통신 끊김 시 빠른 시일 내 복구한다.
진행 상황 보고 항목에 AMR ID, 현재 스텝, 현재 위치를 포함한다.`

const MODE = {
  ollama: ['ollama', 'LLM: Qwen3-8B (실제 판정)'],
  mock: ['mock', 'mock 판정 (Ollama 미실행 — 규칙 기반)'],
}

export default function App() {
  const [text, setText] = useState(SAMPLE)
  const [mode, setMode] = useState(null)
  const [clauses, setClauses] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  async function analyze() {
    setBusy(true)
    setStatus('분석 중… (모델 첫 호출이면 수십 초 걸릴 수 있음)')
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const d = await r.json()
      setMode(d.mode)
      setClauses(d.clauses.map((c) => ({
        ...c,
        state: c.ambiguous ? 'open' : 'clear',
        resolveOpen: false, draft: c.suggestion || '', resolution: '',
      })))
      setAnalyzed(true)
      setStatus('')
    } catch (e) {
      setStatus('실패: ' + e)
    } finally {
      setBusy(false)
    }
  }

  const update = (i, patch) =>
    setClauses((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  function confirmResolve(i) {
    const c = clauses[i]
    if (!c.draft.trim()) { alert('확정 해석을 입력하세요.'); return }
    update(i, { state: 'resolved', resolution: c.draft.trim() })
  }

  const total = clauses.length
  const amb = clauses.filter((c) => c.ambiguous).length
  const done = clauses.filter((c) => c.state === 'resolved').length
  const [modeCls, modeTxt] = mode ? MODE[mode] : ['none', '판정기 확인 중…']

  return (
    <div className="wrap">
      <header>
        <h1>요구사항 모호성 해결 데모</h1>
        <span className={`mode ${modeCls}`}>{modeTxt}</span>
      </header>
      <p className="sub">
        요구사항 원문(한 줄에 조항 하나)을 붙여넣고 분석 → 모호 조항 검출 → 해결(해석 입력) 또는 넘어가기.
      </p>

      <div className="panel">
        <h2>1. 요구사항 입력</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <button className="primary" onClick={analyze} disabled={busy}>분석</button>
          <span className="status">{status}</span>
          {analyzed && (
            <span className="kpis">
              전체 <b>{total}</b> · 모호 <b>{amb}</b> · 해결 <b>{done}</b>
            </span>
          )}
        </div>
      </div>

      {analyzed && (
        <div className="panel">
          <h2>2. 검출 &amp; 해결</h2>
          {clauses.map((c, i) => (
            <Clause key={c.id} c={c} i={i} update={update} confirmResolve={confirmResolve} />
          ))}
        </div>
      )}
    </div>
  )
}

function Clause({ c, i, update, confirmResolve }) {
  if (!c.ambiguous) {
    return (
      <div className="clause">
        <div className="chead"><span className="rid">{c.id}</span><span className="badge clear">명확</span></div>
        <div className="ctext">{c.text}</div>
      </div>
    )
  }
  if (c.state === 'resolved') {
    return (
      <div className="clause resolved">
        <div className="chead"><span className="rid">{c.id}</span><span className="badge done">✔ 확정</span></div>
        <div className="ba">
          <div className="before"><span className="lab">해결 전 (원본)</span>{c.text}</div>
          <div className="after"><span className="lab">해결 후 (확정 해석)</span>{c.resolution}</div>
        </div>
      </div>
    )
  }
  if (c.state === 'skipped') {
    return (
      <div className="clause skipped">
        <div className="chead"><span className="rid">{c.id}</span><span className="badge skip">해결 불필요</span></div>
        <div className="ctext">{c.text}</div>
      </div>
    )
  }
  return (
    <div className="clause amb">
      <div className="chead"><span className="rid">{c.id}</span><span className="badge amb">{c.type || '모호'}</span></div>
      <div className="ctext">{c.text}</div>
      {c.reason && <div className="reason">사유: {c.reason}</div>}
      {c.suggestion && <div className="suggest">✎ 이렇게 쓰면 명확: {c.suggestion}</div>}
      <div className="actions">
        <button className="small primary" onClick={() => update(i, { resolveOpen: true })}>해결하기</button>
        <button className="small ghost" onClick={() => update(i, { state: 'skipped' })}>해결 불필요 · 넘어가기</button>
      </div>
      {c.resolveOpen && (
        <div className="resolvebox show">
          <label>확정 해석 입력</label>
          <textarea
            value={c.draft}
            placeholder="이 조항을 어떻게 해석·확정할지 입력"
            onChange={(e) => update(i, { draft: e.target.value })}
          />
          <div className="actions"><button className="small ok" onClick={() => confirmResolve(i)}>확정</button></div>
        </div>
      )}
    </div>
  )
}
