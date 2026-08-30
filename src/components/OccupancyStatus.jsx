import DataSourceBadge from "./DataSourceBadge";

export default function OccupancyStatus({ occupancy }) {
  if (!occupancy || occupancy.source === "UNAVAILABLE") {
    return (
      <div
        style={{
          marginBottom: "12px",
          padding: "10px",
          backgroundColor: "#f5f5f5",
          borderLeft: "4px solid #999",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
          👥 LIVE OCCUPANCY
          <DataSourceBadge source="UNAVAILABLE" />
        </div>
        <div style={{ color: "#666", fontSize: "11px" }}>No real occupancy data available. Consider adding CCTV/sensor/manual count.</div>
      </div>
    );
  }

  const densityColor = {
    EMPTY: "#00d982",
    LOW: "#7fff00",
    MEDIUM: "#ffbb00",
    HIGH: "#ff6600",
    CRITICAL: "#ff0000",
  }[occupancy.crowdDensity] || "#999";

  return (
    <div
      style={{
        marginBottom: "12px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderLeft: `4px solid ${densityColor}`,
        borderRadius: "4px",
        fontSize: "12px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
        👥 LIVE OCCUPANCY
        <DataSourceBadge source={occupancy.source} confidence={occupancy.confidence} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
        {occupancy.visibleCount !== null && (
          <div>
            <strong>Visible:</strong> {occupancy.visibleCount}
          </div>
        )}
        {occupancy.estimatedCount !== null && (
          <div>
            <strong>Estimated:</strong> {occupancy.estimatedCount}
          </div>
        )}
        <div>
          <strong>Density:</strong> <span style={{ color: densityColor, fontWeight: "bold" }}>{occupancy.crowdDensity}</span>
        </div>
        <div>
          <strong>Confidence:</strong> {(occupancy.confidence * 100).toFixed(0)}%
        </div>
        {occupancy.lastUpdated && (
          <div style={{ gridColumn: "1 / -1", fontSize: "10px", color: "#999" }}>
            Last updated: {new Date(occupancy.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
