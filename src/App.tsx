import './styles/app.css';

const metrics = [
  { label: 'system health', value: '98%', note: 'stable' },
  { label: 'active devices', value: '24', note: '18 online' },
  { label: 'alerts', value: '12', note: '3 urgent' },
  { label: 'voice inbox', value: '6', note: '2 ready' },
];

const commands = [
  'Hold to speak',
  'Open chat',
  'View alerts',
  'Run scene',
];

const integrations = [
  'Tailscale',
  'Home Assistant',
  'Solar PV',
  'AC / Climate',
  'Hot water',
  'EV charger',
];

function App() {
  return (
    <main className="app-shell">
      <div className="backdrop-grid" aria-hidden="true" />
      <section className="frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">Mission Control Center</p>
            <h1>Spatial control surface for home, work, and agentic operations.</h1>
          </div>
          <div className="status-pill">
            <span className="pulse" />
            Tailscale private link
          </div>
        </header>

        <div className="hero">
          <section className="panel hero-panel">
            <div className="panel-header">
              <span>Command core</span>
              <span className="tiny">HUD / 2.5D preview</span>
            </div>
            <div className="orb-stage" aria-hidden="true">
              <div className="orb-glow orb-glow-a" />
              <div className="orb-glow orb-glow-b" />
              <div className="orb orb-ring" />
              <div className="orb orb-core" />
              <div className="orb scanline" />
              <div className="orb orbit orbit-one" />
              <div className="orb orbit orbit-two" />
            </div>
            <div className="hero-copy">
              <h2>Dense detail. Thin lines. Layered depth. No beige dashboards.</h2>
              <p>
                The shell is designed to behave like a cockpit surface: translucent, responsive,
                and willing to look expensive without becoming theatrical.
              </p>
            </div>
          </section>

          <aside className="panel side-panel">
            <div className="panel-header">
              <span>Live metrics</span>
              <span className="tiny">fresh</span>
            </div>
            <div className="metric-grid">
              {metrics.map((metric) => (
                <article className="metric-card" key={metric.label}>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <span>{metric.note}</span>
                </article>
              ))}
            </div>
          </aside>
        </div>

        <div className="grid-row">
          <section className="panel">
            <div className="panel-header">
              <span>Command rail</span>
              <span className="tiny">touch / voice / gesture</span>
            </div>
            <div className="command-list">
              {commands.map((command) => (
                <button className="command-chip" key={command} type="button">
                  {command}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <span>Integration registry</span>
              <span className="tiny">heartbeat live</span>
            </div>
            <div className="registry-list">
              {integrations.map((item) => (
                <div className="registry-item" key={item}>
                  <span>{item}</span>
                  <span className="registry-state">connected</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
