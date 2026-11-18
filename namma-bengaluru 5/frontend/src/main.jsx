import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownUp, ArrowRight, ArrowUpRight, BusFront, CarFront, Check,
  CircleAlert, LayoutDashboard, MapPin, Play, Plus, Route,
  Siren, TrafficCone, TrainFront,
} from 'lucide-react'
import Map from './Map.jsx'
import './style.css'

const INITIAL = { origin: 'indiranagar', destination: 'whitefield' }
const WORKSPACES = {
  overview: {
    label: 'Overview', icon: LayoutDashboard, heading: 'Traffic control centre',
    description: 'Monitor junctions, model disruptions, and find the quickest way across east Bengaluru.',
  },
  signals: {
    label: 'Signals', icon: TrafficCone, heading: 'Signals',
    description: 'Inspect a junction and see how adjusted green time changes modeled delays.',
  },
  routes: {
    label: 'Routes', icon: Route, heading: 'Road routes',
    description: 'Compare driving options and see which roads a disruption affects.',
  },
  incidents: {
    label: 'Incidents', icon: Siren, heading: 'Incidents',
    description: 'Report a disruption, track its effect on the corridor, or resolve an active incident.',
  },
  'public-transport': {
    label: 'Public transport', icon: TrainFront, heading: 'Public transport',
    description: 'Compare modeled metro and bus trips for the current journey.',
  },
}

function workspaceUrl(id) {
  return id === 'overview' ? '#/' : `#/${id}`
}

function readWorkspace() {
  const { hash } = window.location
  const id = hash.startsWith('#/') ? hash.slice(2) : ''
  return Object.hasOwn(WORKSPACES, id) ? id : 'overview'
}
const EMPTY_INCIDENT = { road_id: 'kr-hoodi', kind: 'Lane closure', severity: 'High', description: '' }
const INCIDENT_TYPES = ['Lane closure', 'Collision', 'Roadworks', 'Waterlogging']
const MODE_ICONS = { Drive: CarFront, Metro: TrainFront, Bus: BusFront }

async function api(path, method = 'GET', payload) {
  const response = await fetch(`/api${path}`, {
    method, signal: AbortSignal.timeout(10000),
    ...(payload && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = typeof body.detail === 'string' ? body.detail : body.detail?.[0]?.msg
    throw new Error(message || `Request failed (${response.status}).`)
  }
  return response.json()
}

function ModuleHeader({ icon: Icon, children, text }) {
  return <header className="module-header">
    <span className="module-icon"><Icon size={18} /></span>
    <div><h2>{children}</h2><p>{text}</p></div>
  </header>
}

function Option({ option, active, onClick }) {
  const Icon = MODE_ICONS[option.mode]
  return <button className={`option ${active ? 'selected' : ''}`} type="button"
    aria-pressed={active} onClick={onClick}>
    <Icon size={19} />
    <span className="option-copy"><strong>{option.name}</strong>
      <small>{option.mode === 'Drive'
        ? `${option.km} km · ${option.base_minutes} min baseline`
        : option.detail}</small>
      {option.delay > 0 && <small className="red">+{option.delay} min incident delay</small>}
    </span>
    <span className="option-time">{option.minutes} <small>min</small></span>
  </button>
}

function NetworkMap({ data, journey, selected, onJunction }) {
  return <article className="card map-card">
    <header className="map-header">
      <div><h2>Traffic network</h2><p>East Bengaluru</p></div>
      <span className="schematic">Schematic map</span>
    </header>
    <Map data={data} journey={journey} selected={selected} onJunction={onJunction} />
    <div className="legend" aria-label="Map legend">
      <span><i className="road-key" /> Selected road</span><span><i className="alt-key" /> Fastest road</span>
      <span><i className="metro-key" /> Metro</span><span><i className="incident-key" /> Incident</span>
      <span><i className="junction-key" /> Junction</span>
    </div>
  </article>
}

function App() {
  const [data, setData] = useState(null)
  const [journey, setJourney] = useState(INITIAL)
  const [draft, setDraft] = useState(INITIAL)
  const [junction, setJunction] = useState('kr-puram')
  const [activeTab, setActiveTab] = useState(readWorkspace)
  const [selection, setSelection] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [incident, setIncident] = useState(EMPTY_INCIDENT)
  const main = useRef(null)
  const previousTab = useRef(activeTab)
  const inFlight = useRef(false)

  async function refresh(nextJourney = journey, action, successMessage) {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setError('')
    setNotice('')
    let actionSaved = false
    try {
      if (action) {
        await action()
        actionSaved = true
      }
      const nextData = await api(`/scenario?${new URLSearchParams(nextJourney)}`)
      setData(nextData)
      setJourney(nextJourney)
      setDraft(nextJourney)
      setSelection(null)
      if (successMessage) setNotice(successMessage)
      return true
    } catch (failure) {
      const message = failure.name === 'TimeoutError' ? 'The API took too long to respond.' :
        failure instanceof TypeError ? 'Could not reach the FastAPI server.' : failure.message
      setError(actionSaved ? `Incident saved. Dashboard refresh failed. ${message}` : message)
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  useEffect(() => { refresh(INITIAL) }, [])

  useEffect(() => {
    const syncWorkspace = () => setActiveTab(readWorkspace())
    window.addEventListener('hashchange', syncWorkspace)
    return () => window.removeEventListener('hashchange', syncWorkspace)
  }, [])

  useEffect(() => {
    const workspace = WORKSPACES[activeTab]
    document.title = activeTab === 'overview'
      ? 'Namma Bengaluru · Traffic Operations'
      : `${workspace.label} · Namma Bengaluru`
    if (previousTab.current !== activeTab) {
      previousTab.current = activeTab
      main.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
    }
  }, [activeTab])

  function inspectJunction(id) {
    setJunction(id)
    if (activeTab !== 'signals') window.location.hash = workspaceUrl('signals')
  }

  function moveToMain(event) {
    event.preventDefault()
    main.current?.focus()
    main.current?.scrollIntoView({ block: 'start' })
  }

  const demo = data?.incidents.find(row => row.road_id === 'kr-hoodi' &&
    row.kind === 'Lane closure' && row.severity === 'High' &&
    row.description.startsWith('A simulated lane closure reduces capacity'))
  const best = data?.recommendation
  const selected = data && [...data.routes, ...data.transit].find(option => option.id === selection) || best
  const signal = data?.signals[junction]
  const ModeIcon = best ? MODE_ICONS[best.mode] : CarFront
  const page = WORKSPACES[activeTab]
  const showsJourney = activeTab === 'routes' || activeTab === 'public-transport'
  let workspaceSelection = selected
  if (data && activeTab === 'routes' && selected.mode !== 'Drive') workspaceSelection = data.routes[0]
  if (data && activeTab === 'public-transport' && selected.mode === 'Drive') workspaceSelection = data.transit[0]

  async function toggleDemo() {
    if (demo) {
      await refresh(INITIAL, () => api(`/incidents/${demo.id}`, 'DELETE'), 'Demo incident resolved. Journey estimates have been recalculated.')
    } else {
      const updated = await refresh(INITIAL, () => api('/incidents/demo', 'POST'),
        'Demo incident active on KR Puram Main Road. The dashboard has recalculated the journey.')
      if (updated) setJunction('kr-puram')
    }
  }

  async function reportIncident(event) {
    event.preventDefault()
    const updated = await refresh(journey, () => api('/incidents', 'POST', incident), 'Incident added. Journey estimates have been recalculated.')
    if (updated) {
      setShowForm(false)
      setIncident(EMPTY_INCIDENT)
    }
  }

  return <>
    <a className="skip-link" href="#main" onClick={moveToMain}>Skip to workspace</a>
    <header className="topbar">
      <div className="shell top-inner">
        <a className="brand" href={workspaceUrl('overview')}>
          <MapPin size={23} strokeWidth={1.8} aria-hidden="true" />
          <strong>Namma Bengaluru</strong>
        </a>
        <nav aria-label="Traffic workspaces">{Object.entries(WORKSPACES).map(([id, { label, icon: Icon }]) =>
          <a key={id} href={workspaceUrl(id)} aria-current={activeTab === id ? 'page' : undefined}>
            <Icon size={15} /><span>{label}</span>
          </a>)}</nav>
        <span className="simulation">Simulated data</span>
      </div>
    </header>

    <main id="main" ref={main} tabIndex={-1} className="shell" aria-busy={busy}>
      <section className="intro">
        <div>
          <h1>{page.heading}</h1>
          <p>{page.description}</p>
        </div>
        {(activeTab === 'overview' || activeTab === 'incidents') && <button className="primary demo-button" type="button" onClick={toggleDemo} disabled={busy || !data}>
          {demo ? <Check size={17} /> : <Play size={16} fill="currentColor" />}
          {demo ? 'Resolve demo incident' : 'Run incident demo'}
        </button>}
      </section>
      {error && <div className="alert error" role="alert"><CircleAlert size={17} /> <span>{error}</span>
        <button type="button" disabled={busy} onClick={() => refresh(journey)}>Reload dashboard</button></div>}
      {notice && <div className="alert" role="status"><Check size={17} /> <span>{notice}</span></div>}
      {!data && <div className="loading card" role="status">{busy ? 'Loading traffic simulation…' : 'The traffic simulation is unavailable.'}</div>}
      {data && activeTab === 'overview' && <>
        <section className="stats card" aria-label="Corridor summary">
          <div className="stat">
            <span>Monitored junctions</span><strong>{Object.keys(data.junctions).length}</strong>
          </div>
          <div className="stat">
            <span>Road links</span><strong>{Object.keys(data.roads).length}</strong>
          </div>
          <div className="stat">
            <span>Active incidents</span><strong>{data.incidents.length}</strong>
          </div>
          <div className="stat">
            <span>Fastest journey</span><strong>{best.minutes} <small>min</small></strong>
          </div>
        </section>

        <section className="workspace" aria-label="Map and journey planner">
          <NetworkMap data={data} journey={journey} selected={selected} onJunction={inspectJunction} />

          <aside className="card planner">
            <ModuleHeader icon={Route} text="Compare driving, metro, and bus.">Journey planner</ModuleHeader>
            <form onSubmit={event => { event.preventDefault(); refresh(draft) }} className="journey-form">
              <div className="journey-inputs">
                <label><span><i /> From</span><select value={draft.origin} disabled={busy}
                  onChange={event => setDraft({ ...draft, origin: event.target.value })}>
                  {Object.entries(data.junctions).map(([id, point]) => <option key={id} value={id}>{point.name}</option>)}
                </select></label>
                <button type="button" className="swap" title="Swap start and end" aria-label="Swap start and end" disabled={busy}
                  onClick={() => setDraft({ origin: draft.destination, destination: draft.origin })}><ArrowDownUp size={16} /></button>
                <label><span><i className="end-dot" /> To</span><select value={draft.destination} disabled={busy}
                  onChange={event => setDraft({ ...draft, destination: event.target.value })}>
                  {Object.entries(data.junctions).map(([id, point]) => <option key={id} value={id}>{point.name}</option>)}
                </select></label>
              </div>
              <button className="secondary find" type="submit" disabled={busy}>Compare journeys <ArrowRight size={16} /></button>
            </form>
            <div className="recommendation" aria-live="polite">
              <div className="rec-label">Recommended journey</div>
              <div className="rec-title"><span><ModeIcon size={21} /> {best.mode}</span><strong>{best.minutes} <small>min</small></strong></div>
              <p>{best.reason}</p>
              {selection && <button className="text-button" type="button" onClick={() => setSelection(null)}>Show recommendation on map <ArrowUpRight size={14} /></button>}
            </div>
            <div className="quick-options" aria-label="Other journey options">
              {[data.routes[0], ...data.transit].filter(option => option.id !== best.id).map(option => {
                const Icon = MODE_ICONS[option.mode]
                return <button key={option.id} type="button" aria-pressed={selected.id === option.id}
                  onClick={() => setSelection(option.id)}>
                  <Icon size={16} /><span>{option.mode === 'Drive' ? 'Fastest drive' : option.name}</span>
                  <strong>{option.minutes} min</strong>
                </button>
              })}
            </div>
          </aside>
        </section>
      </>}
      {data && activeTab !== 'overview' && <section className="workspace detail-workspace"
        aria-label={`${page.label} workspace`}>
        <div className="workspace-controls">
          {showsJourney && <div className="card journey-context">
            <div><span>Current journey</span><strong>
              {data.junctions[journey.origin].name} <ArrowRight size={14} aria-hidden="true" /> {data.junctions[journey.destination].name}
            </strong></div>
            <a className="secondary" href={workspaceUrl('overview')}>Edit journey</a>
          </div>}
          {activeTab === 'signals' && <section className="card module">
            <ModuleHeader icon={TrafficCone} text="Compare fixed and adjusted timing at a junction.">Signal comparison</ModuleHeader>
            <label className="field">Junction<select value={junction} onChange={event => setJunction(event.target.value)}>
              {Object.entries(data.junctions).map(([id, point]) => <option key={id} value={id}>{point.name}</option>)}
            </select></label>
            <div className="signal-meta">{signal.demand.toLocaleString('en-IN')} veh/h · {signal.cycle}s cycle
              {signal.diversion > 0 && <span className="red"> · +{signal.diversion} veh/h from incidents</span>}</div>
            {[['Fixed timing', signal.fixed], ['Adjusted timing', signal.adjusted]].map(([label, timing], index) =>
              <div className="timing" key={label}>
                <div><strong>{label}</strong><span>{timing.delay}s delay</span></div>
                <div className={`timing-bar timing-${index}`} role="img" aria-label={`${timing.green} seconds green, ${timing.red} seconds red`}>
                  <i style={{ width: `${100 * timing.green / signal.cycle}%` }} />
                </div>
                <small>{timing.green}s green · {timing.red}s red</small>
              </div>)}
            <p className="module-result"><Check size={16} /> {signal.saved_seconds}s modeled delay saved per vehicle</p>
          </section>}

          {activeTab === 'routes' && <section className="card module">
            <ModuleHeader icon={Route} text="Includes the fastest route under baseline conditions.">Driving options</ModuleHeader>
            <div className="options">{data.routes.map(option => <Option key={option.id} option={option}
              active={workspaceSelection.id === option.id} onClick={() => setSelection(option.id)} />)}</div>
          </section>}

          {activeTab === 'incidents' && <section className="card module">
            <ModuleHeader icon={Siren} text="Add or resolve disruptions in the simulation.">Incident management</ModuleHeader>
            {data.incidents.length === 0 && <p className="empty"><Check size={16} /> No active incidents in this corridor.</p>}
            <div className="incident-list">
              {data.incidents.map(row => <div className="incident-row" key={row.id}>
                <div><strong>{row.kind} · {data.roads[row.road_id].name}</strong>
                  <small className="red">{row.severity} severity · +{data.roads[row.road_id].delay} min per affected trip</small>
                  {row.description && <p>{row.description}</p>}</div>
                <button type="button" className="secondary" disabled={busy} onClick={() => refresh(journey,
                  () => api(`/incidents/${row.id}`, 'DELETE'), 'Incident resolved. Journey estimates have been recalculated.')}>Resolve</button>
              </div>)}
            </div>
            <button className="secondary add" type="button" aria-expanded={showForm} aria-controls="incident-form"
              onClick={() => setShowForm(!showForm)}><Plus size={16} /> {showForm ? 'Close incident form' : 'Report incident'}</button>
            {showForm && <form id="incident-form" className="incident-form" onSubmit={reportIncident}>
              <label className="field">Road<select value={incident.road_id} onChange={event => setIncident({ ...incident, road_id: event.target.value })}>
                {Object.entries(data.roads).map(([id, road]) => <option key={id} value={id}>{road.name}</option>)}
              </select></label>
              <div className="form-grid">
                <label className="field">Type<select value={incident.kind} onChange={event => setIncident({ ...incident, kind: event.target.value })}>
                  {INCIDENT_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
                <label className="field">Severity<select value={incident.severity} onChange={event => setIncident({ ...incident, severity: event.target.value })}>
                  {['Low', 'Medium', 'High'].map(severity => <option key={severity}>{severity}</option>)}</select></label>
              </div>
              <label className="field">Note (optional)<textarea rows={2} maxLength={240} value={incident.description}
                onChange={event => setIncident({ ...incident, description: event.target.value })} /></label>
              <button className="primary" disabled={busy} type="submit">Add incident</button>
              {error && <p className="inline-error">{error}</p>}
            </form>}
          </section>}

          {activeTab === 'public-transport' && <section className="card module">
            <ModuleHeader icon={TrainFront} text="Includes modeled walking and waiting time.">Transit options</ModuleHeader>
            <div className="options">{data.transit.map(option => <Option key={option.id} option={option}
              active={workspaceSelection.id === option.id} onClick={() => setSelection(option.id)} />)}</div>
            {!data.transit.some(option => option.mode === 'Metro') && <p className="empty">Metro estimates require a modeled Purple Line station at both ends.</p>}
            <details><summary>Simulation assumptions</summary><p>Road estimates add incident delays to link times. Bus uses the fastest road corridor with a 20% travel-time adjustment and 8 minutes for walking and waiting. Metro uses modeled station-to-station times plus 8 minutes for access and waiting.</p><p>Signal results model one approach per junction and are reported separately from route travel times.</p></details>
          </section>}
        </div>
        <NetworkMap data={data} journey={journey} selected={workspaceSelection} onJunction={inspectJunction} />
      </section>}
      <footer><span>Namma Bengaluru</span><span>Simulated data · East Bengaluru corridor</span></footer>
    </main>
  </>
}

createRoot(document.getElementById('root')).render(<App />)
