import DataSourceBadge from "./DataSourceBadge";

export default function HazardPanel({ hazards }) {
  if (!hazards || hazards.length === 0) {
    return (
      <div
        style={{
          marginBottom: "12px",
          padding: "10px",
          backgroundColor: "#f5f5f5",
          borderLeft: "4px solid #00d982",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "6px" }}>🛡️ HAZARD STATUS</div>
        <div style={{ color: "#666", fontSize: "11px" }}>No hazards detected.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: "12px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderLeft: "4px solid #ff6600",
        borderRadius: "4px",
        fontSize: "12px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "6px" }}>🛡️ HAZARD STATUS ({hazards.length})</div>
      {hazards.map((hazard, i) => (
        <div
          key={i}
          style={{
            padding: "6px",
            marginBottom: "6px",
            backgroundColor: "#fff",
            borderRadius: "3px",
            borderLeft: `2px solid ${hazard.severity === "HIGH" ? "#ff0000" : "#ff6600"}`,
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "11px" }}>
            {hazard.type}
            <DataSourceBadge source={hazard.source} confidence={hazard.confidence} />
          </div>
          <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
            <strong>Severity:</strong> {hazard.severity} | <strong>Confidence:</strong> {(hazard.confidence * 100).toFixed(0)}%
          </div>
          {hazard.description && (
            <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>{hazard.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}
