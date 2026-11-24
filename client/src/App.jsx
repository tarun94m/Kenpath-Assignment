import { useEffect, useState, useCallback, useRef } from 'react';
import { T } from './i18n.js';

const tok = () => localStorage.getItem('tok');
const api = async (url, body) => {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (r.status === 401) { localStorage.clear(); location.reload(); }
  if (!r.ok) throw new Error(j.error || T.err);
  return j;
};
// Shrink phone photos to ~900px JPEG before upload: faster on weak networks and easier for the model.
const shrink = (file) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 900 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = img.width * k; cv.height = img.height * k;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    resolve(cv.toDataURL('image/jpeg', 0.7));
  };
  img.src = URL.createObjectURL(file);
});
const fmt = (d) => new Date(d).toLocaleString('kn-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [id, setId] = useState(null);
  const [view, setView] = useState('list');
  if (!user) return <Login onLogin={setUser} />;
  return (
    <main>
      <header className="top">
        <div><h1>{T.title}</h1><p>{T.sub}</p></div>
        <div className="me"><span>{user.name}<small>{T.roles[user.role]}</small></span>
          <button onClick={() => { localStorage.clear(); setUser(null); }}>{T.logout}</button></div>
      </header>
      {user.role === 'tahsildar' && !id && (
        <div className="tabs">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>{T.queue}</button>
          <button className={view === 'dash' ? 'on' : ''} onClick={() => setView('dash')}>{T.dash}</button>
        </div>
      )}
      {id ? <Detail id={id} onBack={() => setId(null)} /> : view === 'dash' ? <Dashboard /> : <List onOpen={setId} />}
    </main>
  );
}

function Login({ onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
      const j = await r.json();
      if (!r.ok) throw new Error();
      localStorage.setItem('tok', j.token); localStorage.setItem('user', JSON.stringify(j.user));
      onLogin(j.user);
    } catch { setErr(true); }
  };
  return (
    <main>
      <header className="top"><div><h1>{T.title}</h1><p>{T.sub}</p></div></header>
      <form className="login" onSubmit={go}>
        <label>{T.username}<input value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none" autoFocus /></label>
        <label>{T.password}<input type="password" value={p} onChange={(e) => setP(e.target.value)} /></label>
        {err && <p className="err">{T.badLogin}</p>}
        <button className="primary" type="submit">{T.login}</button>
        <small>{T.demo}</small>
      </form>
    </main>
  );
}

function Bars({ title, rows, label, val, late, max: fixed }) {
  const max = fixed || Math.max(1, ...rows.map(val));
  return (
    <section className="chart">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="empty">{T.none}</p>}
      {rows.map((r, i) => (
        <div className="hb" key={i}>
          <span>{label(r)}</span>
          <div><i style={{ width: `${(val(r) / max) * 100}%` }}>{late && r.late > 0 && <u style={{ width: `${(r.late / val(r)) * 100}%` }} />}</i></div>
          <b>{val(r)}</b>
        </div>
      ))}
    </section>
  );
}

function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/api/dashboard').then(setD); }, []);
  if (!d) return null;
  const k = d.kpi;
  return (
    <div className="dash">
      <div className="stats four">
        <div><b>{k.pending}</b>{T.pending}</div>
        <div className={k.overdue ? 'late' : ''}><b>{k.overdue}</b>{T.overdue}</div>
        <div><b>{k.avg_days ?? T.none}</b>{T.kpiAvg}</div>
        <div><b>{k.ai_pct ?? T.none}</b>{T.kpiAi}</div>
      </div>
      <Bars title={T.chStage} rows={d.by_stage} label={(r) => T.stages[r.stage - 1]} val={(r) => r.n} />
      <Bars title={T.chVillage} rows={d.by_village} label={(r) => r.village} val={(r) => r.n} late />
      <Bars title={T.chReturn} rows={d.returns} label={(r) => T.stages[r.stage - 1]} val={(r) => r.n} />
      <Bars title={T.chOutcome} rows={d.outcomes} label={(r) => T.status[r.status]} val={(r) => r.n} />
      <Bars title={T.chAgree} rows={d.ai.filter((r) => r.decided)} max={100}
        label={(r) => `${T.stages[r.stage - 1]} (${r.agreed}/${r.decided})`} val={(r) => Math.round((100 * r.agreed) / r.decided)} />
      <section className="chart">
        <h3>{T.chDiff}</h3>
        {d.ai_diff.length === 0 && <p className="empty">{T.none}</p>}
        {d.ai_diff.map((r, i) => <p className="diff" key={i}><b>{r.name}</b> · {T.sug[r.suggestion]} → {T.sug[r.final]}</p>)}
      </section>
    </div>
  );
}

function List({ onOpen }) {
  const [apps, setApps] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('open');
  const [err, setErr] = useState(false);
  useEffect(() => { api('/api/applications').then(setApps).catch(() => setErr(true)); api('/api/stats').then(setStats).catch(() => {}); }, []);
  const isOpen = (a) => a.status === 'pending' || a.status === 'returned';
  const shown = apps.filter((a) => (tab === 'open') === isOpen(a));
  return (
    <>
      {stats && (
        <div className="stats">
          <div><b>{stats.pending}</b>{T.pending}</div>
          <div className={+stats.overdue ? 'late' : ''}><b>{stats.overdue}</b>{T.overdue}</div>
          <div><b>{stats.closed}</b>{T.closed}</div>
        </div>
      )}
      <div className="tabs">
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>{T.open}</button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>{T.done}</button>
      </div>
      {err && <p className="err" style={{ padding: '0 14px' }}>{T.err}</p>}
      <ul className="list">
        {shown.map((a) => (
          <li key={a.id}>
            <button className={`row ${a.status === 'pending' && a.days_left < 0 ? 'late' : ''}`} onClick={() => onOpen(a.id)}>
              <span className="who"><b>{a.name}</b><small>{a.village} · {a.ref_no}</small></span>
              <span className="meta">
                {isOpen(a)
                  ? <><em>{T.stages[a.stage - 1]}</em><span className="due">{T.daysLeft(a.days_left)}</span></>
                  : <em className={`st ${a.status}`}>{T.status[a.status]}</em>}
                {a.failed > 0 && isOpen(a) && <span className="flag">⚠ {a.failed}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Detail({ id, onBack }) {
  const [a, setA] = useState(null);
  const [ai, setAi] = useState({ state: 'idle', text: '' });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [remark, setRemark] = useState('');
  const [pending, setPending] = useState(null); // action waiting for confirmation
  const [err, setErr] = useState('');
  const aiLog = useRef(null); // id of the AI suggestion on screen, sent with the decision

  const load = useCallback(() => api(`/api/applications/${id}`).then((d) => { setA(d); setNotes(d.field_notes || ''); }), [id]);
  useEffect(() => { load(); }, [load]);
  const confirmRef = useRef(null);
  useEffect(() => { if (pending) confirmRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [pending]); // scroll once, not on every keystroke
  if (!a) return null;

  const open = a.status === 'pending' && a.can_act;
  const askAi = async () => {
    setAi({ state: 'loading', text: '' });
    try {
      const r = await fetch(`/api/applications/${id}/ai`, { method: 'POST', headers: { Authorization: `Bearer ${tok()}` } });
      if (!r.ok) throw new Error();
      const logId = r.headers.get('X-AI-Log');
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setAi({ state: 'ok', text }); // text appears word by word
      }
      if (!text.trim()) throw new Error();
      aiLog.current = logId;
    } catch {
      setAi({ state: 'off', text: '' });
    }
  };
  const run = async (action) => {
    try {
      await api(`/api/applications/${id}/action`, { action, remark, aiLogId: aiLog.current, fieldNotes: a.stage === 2 ? notes : undefined });
      setPending(null); setRemark(''); setAi({ state: 'idle', text: '' }); aiLog.current = null; setErr('');
      await load();
    } catch (e) { setErr(e.message); setPending(null); }
  };
  const upload = async (kind, file) => {
    setBusy(kind); setErr('');
    try { await api(`/api/applications/${id}/documents`, { kind, image: await shrink(file) }); await load(); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const confirmDoc = async (did) => { await api(`/api/documents/${did}/confirm`, {}); await load(); };
  const needsRemark = pending === 'reject' || pending === 'return';
  const listen = () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return;
    const r = new R(); r.lang = 'kn-IN';
    r.onresult = (e) => setNotes((n) => `${n} ${e.results[0][0].transcript}`.trim());
    r.start();
  };

  return (
    <section className="detail">
      <button className="back" onClick={onBack}>{T.back}</button>
      <div className="person">
        <h2>{a.name}</h2>
        <p>{a.village} · {a.ref_no} · {T.age} {a.age} · {T.income} ₹{a.income.toLocaleString('kn-IN')}</p>
        <span className={`st ${a.status}`}>{T.status[a.status]}</span>
      </div>

      <ol className="path">
        {T.stages.map((s, i) => (
          <li key={s} className={i + 1 < a.stage || a.status === 'approved' ? 'past' : i + 1 === a.stage ? 'now' : ''}>{s}</li>
        ))}
      </ol>

      <ul className="checks">
        {a.checks.map((c) => <li key={c.k} className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗'} {T.checks[c.k]}</li>)}
      </ul>

      {a.status === 'pending' && !a.can_act && <p className="notice">{T.notYours}</p>}
      {open && (
        <>
          {a.stage === 1 && (
            <div className="docs">
              <h3>{T.photos}</h3>
              {['a', 'i', 'b', 'p'].map((k) => {
                const d = a.photos.find((x) => x.kind === k);
                return (
                  <div className="doc" key={k}>
                    <b>{T.checks['d_' + k]}</b>
                    {d && <img src={d.data} alt="" />}
                    {d?.extracted?.flags?.length > 0 && <p className="err">⚠ {d.extracted.flags.map((f) => T.mismatch[f]).join(', ')} · {T.readAs}: {d.extracted.name || ''} {d.extracted.birth_year || ''}</p>}
                    {d && !d.extracted && k !== 'p' && <p className="notice">{T.unread}</p>}
                    <div className="btns">
                      <label className="ghost filebtn">{busy === k ? T.reading : d ? T.retake : T.take}
                        <input type="file" accept="image/*" capture="environment" hidden disabled={!!busy} onChange={(e) => e.target.files[0] && upload(k, e.target.files[0])} />
                      </label>
                      {d && !d.confirmed && <button className="primary" onClick={() => confirmDoc(d.id)}>{T.confirmDoc}</button>}
                      {d?.confirmed && <span className="okmark">✓ {T.confirmed}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {a.stage === 2 && (
            <label className="notes">{T.notes}
              <textarea rows="4" value={notes} placeholder={T.notesHint} onChange={(e) => setNotes(e.target.value)} />
              <button type="button" className="ghost" onClick={listen}>{T.mic}</button>
            </label>
          )}
          <div className="ai">
            <button className="ghost" onClick={askAi} disabled={ai.state === 'loading'}>✨ {ai.state === 'loading' ? T.aiLoading : T.ai}</button>
            {ai.state === 'ok' && <><p className="aitext">{ai.text}</p><small>{T.aiNote}</small></>}
            {ai.state === 'off' && <p className="aitext off">{T.aiOff}</p>}
          </div>

          {err && <p className="err">{err === 'remark required' ? T.remarkNeed : err === 'field notes required' ? T.notesNeed : err === 'confirm documents' ? T.confirmNeed : T.err}</p>}
          {pending ? (
            <div className="confirm" ref={confirmRef}>
              {needsRemark && <textarea rows="2" autoFocus placeholder={T.remark} value={remark} onChange={(e) => setRemark(e.target.value)} />}
              <p>{pending === 'advance' && a.stage === 2 && !notes.trim() ? T.notesNeed : T.confirm}</p>
              <div className="btns">
                <button className="primary" disabled={(needsRemark && !remark.trim()) || (pending === 'advance' && a.stage === 2 && !notes.trim())} onClick={() => run(pending)}>{T.yes}</button>
                <button className="ghost" onClick={() => setPending(null)}>{T.no}</button>
              </div>
            </div>
          ) : (
            <div className="btns bar">
              {a.stage < 3
                ? <button className="primary" onClick={() => setPending('advance')}>{T.next}</button>
                : <button className="primary" onClick={() => setPending('approve')}>{T.approve}</button>}
              <button className="warn" onClick={() => setPending('return')}>{T.ret}</button>
              <button className="danger" onClick={() => setPending('reject')}>{T.reject}</button>
            </div>
          )}
        </>
      )}
      {a.status === 'returned' && a.can_act && <div className="btns bar"><button className="primary" onClick={() => run('reopen')}>{T.reopen}</button></div>}

      {a.notes.length > 0 && (
        <>
          <h3>{T.msgs}</h3>
          <ul className="history">{a.notes.map((n, i) => <li key={i}><p>{n.body}</p><small>{T.nstatus[n.status]} · {fmt(n.at)}</small></li>)}</ul>
        </>
      )}
      <h3>{T.history}</h3>
      {a.history.length === 0 && <p className="empty">{T.noHistory}</p>}
      <ul className="history">
        {a.history.map((h) => (
          <li key={h.id}>
            <b>{T.actions[h.action]}</b> <small>{h.user_name ? `${h.user_name} · ` : ''}{T.stages[h.stage - 1]} · {fmt(h.at)}{h.ai_used ? ` · ${T.aiUsed}` : ''}</small>
            {h.remark && <p>{h.remark}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
