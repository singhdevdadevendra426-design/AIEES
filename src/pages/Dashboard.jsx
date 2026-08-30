import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StatsCard from "../components/StatsCard";
import EvacuationMap from "../components/EvacuationMap";

const startingAgents = [];

function Dashboard() {
  const [seconds, setSeconds] = useState(0);
  const [peopleInside] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [alternateRoute, setAlternateRoute] = useState(false);
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [message, setMessage] = useState("");
  const [agents, setAgents] = useState(startingAgents);
  const [routes, setRoutes] = useState([]);
  const [blockedExit, setBlockedExit] = useState(false);
  const [reroutes, setReroutes] = useState(0);
  const [exits, setExits] = useState([
    { id: "EXIT A", x: 0, y: 0 },
    { id: "EXIT B", x: 100, y: 0 },
    { id: "EXIT C", x: 50, y: 100 },
  ]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSeconds((currentSeconds) => currentSeconds + 1);
      setAgents((currentAgents) => {
        const moving = currentAgents.map((agent) => {
          if (agent.status === "EVACUATED") return agent;
          const next = agent.path?.[1];
          if (!next) return { ...agent, status: "EVACUATED" };
          return { ...agent, x: next.x, y: next.y, path: agent.path.slice(1), status: "EVACUATING" };
        });
        const evacuated = moving.filter((agent) => agent.status === "EVACUATED").length;
        if (evacuated === moving.length) {
          setIsRunning(false);
          setCompleted(true);
          setMessage("Evacuation completed successfully.");
        }
        return moving;
      });
    }, 700);

    return () => clearInterval(timer);
  }, [isRunning]);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  const time = `${minutes}:${remainingSeconds}`;

  function findRoute(agent, exit, blockedExit) {
    const steps = 10 + Math.random() * 5;
    const path = [];
    for (let i = 0; i < steps; i++) {
      path.push({
        x: agent.x + (exit.x - agent.x) * (i / steps),
        y: agent.y + (exit.y - agent.y) * (i / steps),
      });
    }
    return path;
  }

  function startEvacuation() {
    if (!completed) {
      const planned = startingAgents.map((agent) => {
        const exit = exits[agent.x % (blockedExit ? 2 : 3)];
        return { ...agent, status: "EVACUATING", exit: exit.id, path: findRoute(agent, exit, blockedExit) };
      });
      setAgents(planned);
      setRoutes(planned);
      setIsRunning(true);
      setMessage("🔥 FIRE DETECTED. Evacuation started with A* safe routes.");
    }
  }

  function recalculateRoutes() {
    const nextBlocked = !blockedExit;
    const planned = agents.map((agent) => {
      const exit = exits[agent.x % (nextBlocked ? 2 : 3)];
      return { ...agent, exit: exit.id, path: findRoute(agent, exit, nextBlocked) };
    });
    setBlockedExit(nextBlocked);
    setRoutes(planned);
    setAgents(planned);
    setReroutes((count) => count + 1);
    setAlternateRoute((currentRoute) => !currentRoute);
    setMessage(`Safe routes recalculated. ${nextBlocked ? "EXIT C blocked." : "EXIT C reopened."}`);
  }

  function resetSimulation() {
    setSeconds(0);
    setAgents(startingAgents);
    setRoutes([]);
    setBlockedExit(false);
    setReroutes(0);
    setCompleted(false);
    setIsRunning(false);
    setMessage("Simulation reset.");
  }

  function renderSection() {
    const evacuated = agents.filter((agent) => agent.status === "EVACUATED").length;
    const averageRoute = routes.length ? Math.round(routes.reduce((sum, route) => sum + route.path.length, 0) / routes.length) : 0;
    const sections = {
      "Live Simulation": ["Training Simulation", isRunning ? "SIMULATION ACTIVE" : completed ? "COMPLETED" : "READY", `Timer: ${time} | Live occupancy: ${peopleInside ?? "Demo mode"} | Simulated agents evacuated: ${evacuated}`],
      "Evacuation Routes": ["Safe Routes", `${blockedExit ? 2 : 3} exits available`, routes.slice(0, 2).map((route) => `${route.id} → ${route.exit || "EXIT A"}`).join(" | ") || "Start evacuation to calculate A* routes"],
      "Emergency Alerts": ["Emergency Alert", completed ? "RESOLVED" : "ACTIVE", "Fire Emergency | Sector B • Level 1"],
      "AI Predictions": ["Simulation-Based Predictions", "Risk Level: HIGH", "Fire hazard | Sector B | Recommended: EXIT A and EXIT B"],
      "Risk Analysis": ["Risk Analysis", "Overall Risk: HIGH", `Fire severity: High | Danger zones: 1 | Blocked exits: ${blockedExit ? 1 : 0} | Congestion: Medium`],
      Reports: ["Evacuation Report", "SIMULATION", `Live occupancy: Demo mode | Simulated agents: ${agents.length} | Time: ${time} | Avg route: ${averageRoute} steps | Reroutes: ${reroutes}`],
    };
    const section = sections[activeSection];
    if (!section) return null;
      return <div className="section-panel"><h2>{section[0]}</h2><strong>{section[1]}</strong><p>{section[2]}</p>{activeSection === "Live Simulation" && <div className="section-controls"><button className="secondary-button" onClick={startEvacuation} disabled={isRunning || completed}>Start / Resume</button><button className="secondary-button" onClick={() => setIsRunning(false)} disabled={!isRunning}>Pause</button><button className="secondary-button" onClick={resetSimulation}>Reset</button></div>}</div>;
  }

  return (
    <div className="dashboard">
      
      <Sidebar activeSection={activeSection} onSelect={setActiveSection} />

      <main className="main-content">
        <Navbar
          isRunning={isRunning}
          alertCount={0}
          onAlertsClick={() => setActiveSection("Emergency Alerts")}
        />

        <section className="dashboard-content">
          {activeSection !== "Dashboard" && renderSection()}
          {activeSection === "Dashboard" && <>

          <div className="page-heading">
            <div>
              <p className="eyebrow">AI EMERGENCY CONTROL CENTER</p>
              <h1>Evacuation Dashboard</h1>
              <p>
                Real-time AI monitoring and emergency evacuation simulation.
              </p>
            </div>

            <div className="system-status">
              <span className="status-dot"></span>
              SYSTEM ONLINE
            </div>
          </div>

          <div className="stats-grid">

            <StatsCard
              title="Live Occupancy"
              value="Demo mode"
              label="No live occupancy source connected"
              icon="👥"
            />

            <StatsCard
              title="Safe Exits"
              value={blockedExit ? "2" : "3"}
              label="Available exits"
              icon="🚪"
            />

            <StatsCard
              title="Active Hazards"
              value={completed ? "0" : "1"}
              label="Danger zones"
              icon="🔥"
            />

            <StatsCard
              title="Evacuation Time"
              value={time}
              label="Current simulation"
              icon="⏱️"
            />

          </div>

          <div className="simulation-layout">

            <EvacuationMap alternateRoute={alternateRoute} isRunning={isRunning} agents={agents} routes={routes} exits={exits} blockedExit={blockedExit} />

            <div className="control-panel">

              <div className="panel-header">
                <span>Emergency Control</span>
                <span className="live-badge">{completed ? "DONE" : isRunning ? "ACTIVE" : "LIVE"}</span>
              </div>

              <div className="emergency-box">
                <span className="warning-icon">⚠</span>

                <div>
                  <h3>Fire Emergency</h3>
                  <p>Sector B • Level 1</p>
                </div>
              </div>

              <button className="emergency-button" onClick={startEvacuation} disabled={isRunning || completed}>
                {completed ? "✓ EVACUATION COMPLETED" : isRunning ? "EVACUATION IN PROGRESS" : "🚨 START EVACUATION"}
            </button>

              <button className="secondary-button" onClick={recalculateRoutes}>
                Recalculate Safe Routes
              </button>

              {message && <p className="feedback">{message}</p>}

              <div className="route-info">
                <div>
                  <span>AI Route Engine</span>
                  <strong>ACTIVE</strong>
                </div>

                <div>
                  <span>Pathfinding</span>
                  <strong>A*</strong>
                </div>

                <div>
                  <span>Risk Analysis</span>
                  <strong>ONLINE</strong>
                </div>
              </div>

            </div>

          </div>
          </>}

        </section>

      </main>

    </div>
  );
}

export default Dashboard;
