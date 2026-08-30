function Sidebar({ activeSection, onSelect }) {
  const commandItems = [
    ["Dashboard", "◈"],
    ["Live Simulation", "⌁"],
    ["Evacuation Routes", "◉"],
    ["Emergency Alerts", "⚠"],
  ];

  const analyticsItems = [
    ["AI Predictions", "▥"],
    ["Risk Analysis", "◌"],
    ["Reports", "▤"],
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">E</div>
        <div>
          <h2>EVACAI</h2>
          <span>RESCUE SYSTEM</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-title">COMMAND</p>
        {commandItems.map(([label, icon]) => (
          <button
            className={`nav-item ${activeSection === label ? "active" : ""}`}
            onClick={() => onSelect(label)}
            key={label}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}

        <p className="nav-title">ANALYTICS</p>
        {analyticsItems.map(([label, icon]) => (
          <button
            className={`nav-item ${activeSection === label ? "active" : ""}`}
            onClick={() => onSelect(label)}
            key={label}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="ai-status">
          <div className="ai-pulse"></div>
          <div>
            <strong>AI ENGINE</strong>
            <span>Operational</span>
          </div>
        </div>
        <div className="version">EVACAI v1.0</div>
      </div>
    </aside>
  );
}

export default Sidebar;