function Navbar({ isRunning, alertCount, onAlertsClick }) {
  return (
    <header className="navbar">

      <div className="nav-left">
        <div className="status-dot"></div>

        <div>
          <span className="system-status">SYSTEM STATUS</span>
          <strong>{isRunning ? "EVACUATION IN PROGRESS" : "ALL SYSTEMS OPERATIONAL"}</strong>
        </div>
      </div>

      <div className="nav-center">
        <span className="live-indicator"></span>
        {isRunning ? "EVACUATION ACTIVE" : "LIVE MONITORING"}
      </div>

      <div className="nav-right">

        <button className="alert-button" onClick={onAlertsClick}>
          ⚠
          <span>{alertCount}</span>
        </button>

        <div className="user-profile">
          <div className="user-avatar">D</div>

          <div className="user-info">
            <strong>COMMANDER</strong>
            <span>Administrator</span>
          </div>
        </div>

      </div>

    </header>
  );
}

export default Navbar;