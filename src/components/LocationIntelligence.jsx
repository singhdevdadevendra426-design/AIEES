import DataSourceBadge from "./DataSourceBadge";

export default function LocationIntelligence({ place }) {
  if (!place) return null;

  return (
    <div
      style={{
        marginBottom: "12px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderLeft: "4px solid #0d4d7f",
        borderRadius: "4px",
        fontSize: "12px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
        📍 LOCATION INTELLIGENCE
        <DataSourceBadge source={place.source || "MAP_DATA"} confidence={place.dataConfidence} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
        <div>
          <strong>Place:</strong> {place.name}
        </div>
        <div>
          <strong>Type:</strong> {place.placeType || "Location"}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <strong>Address:</strong> {place.formatted_address}
        </div>
        <div>
          <strong>Coordinates:</strong> {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </div>
        <div>
          <strong>Confidence:</strong> {((place.dataConfidence || 0.9) * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
