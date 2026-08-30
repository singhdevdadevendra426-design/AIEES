// Badge component for data source transparency
export default function DataSourceBadge({ source, confidence }) {
  const sourceConfig = {
    REAL_MAP_DATA: { bg: "#0d4d7f", label: "MAP" },
    NOMINATIM_MAP_DATA: { bg: "#0d4d7f", label: "MAP" },
    OVERPASS_MAP_DATA: { bg: "#0d4d7f", label: "MAP" },
    OVERPASS_ENTRANCE_DATA: { bg: "#0d4d7f", label: "MAP" },
    MAP_DATA: { bg: "#0d4d7f", label: "MAP" },
    OSRM_ROUTING_DATA: { bg: "#0d4d7f", label: "ROUTING" },
    AI_ESTIMATE: { bg: "#7f4d0d", label: "AI EST" },
    CAMERA_ANALYSIS: { bg: "#0d7f4d", label: "CAMERA" },
    CCTV_DATA: { bg: "#0d7f4d", label: "CCTV" },
    SENSOR_DATA: { bg: "#0d7f4d", label: "SENSOR" },
    SIMULATION: { bg: "#4d0d7f", label: "SIM" },
    USER_INPUT: { bg: "#7f7f0d", label: "USER" },
    UNAVAILABLE: { bg: "#7f0d0d", label: "NO DATA" },
    CALCULATED_EXIT_ANALYSIS: { bg: "#0d4d7f", label: "CALC" },
    FALLBACK_ANALYSIS: { bg: "#7f4d0d", label: "EST" },
  };

  const config = sourceConfig[source] || sourceConfig.AI_ESTIMATE;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        fontSize: "10px",
        fontWeight: "bold",
        backgroundColor: config.bg,
        color: "#fff",
        borderRadius: "3px",
        marginLeft: "6px",
      }}
      title={`Source: ${source}${confidence ? ` | Confidence: ${(confidence * 100).toFixed(0)}%` : ""}`}
    >
      {config.label}
    </span>
  );
}
