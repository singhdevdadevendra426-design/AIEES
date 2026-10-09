import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getNearbyFeatures, searchPlace, scoreExitsByRisk } from "../services/mapsService";
import { getNearbyEmergencyResources } from "../services/emergencyResourceService";
import { hazardService } from "../services/hazardService";
import { occupancyService } from "../services/occupancyService";
import { riskService } from "../services/riskService";
import LocationIntelligence from "./LocationIntelligence";
import OccupancyStatus from "./OccupancyStatus";
import HazardPanel from "./HazardPanel";
import DataSourceBadge from "./DataSourceBadge";

function EvacuationMap({ alternateRoute, isRunning, agents = [], routes = [], exits = [], blockedExit }) {
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState(null);
  const [features, setFeatures] = useState({ buildings: [], entrances: [], exits: [], safeAreas: [] });
  const [routeInfo, setRouteInfo] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [occupancy, setOccupancy] = useState(occupancyService.getData());
  const [emergencyResources, setEmergencyResources] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [layers, setLayers] = useState({ routes: true, exits: true, buildings: true });
  const [message, setMessage] = useState("Enter a location to begin analysis.");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [routeDirections, setRouteDirections] = useState([]);
  const [recommendedRoute, setRecommendedRoute] = useState(null);
  const mapRef = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const layerGroups = useRef({ routes: [], exits: [], buildings: [], hazards: [] });

  const clearMapLayers = () => {
    Object.values(layerGroups.current).flat().forEach((layer) => layer.remove());
    layerGroups.current = { routes: [], exits: [], buildings: [], hazards: [] };
  };

  const hasCoordinates = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  async function requestAiAnalysis(payload) {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "AI analysis is unavailable.");
    return result;
  }

  useEffect(() => () => imageUrl && URL.revokeObjectURL(imageUrl), [imageUrl]);

  // Photo analysis effect
  useEffect(() => {
    if (!imageData) return;
    setMessage("AI is analyzing the uploaded photo...");
    requestAiAnalysis({
        imageData,
        place: place || null,
        hazards: hazards.length > 0 ? hazards : undefined,
    })
      .then((result) => {
        setAiAnalysis(result);
        if (result.hazards && result.hazards.length > 0) {
          hazardService.clear();
          result.hazards.forEach((h) => {
            hazardService.addHazard({
              type: h.type || "UNKNOWN",
              severity: h.severity || "LOW",
              source: "IMAGE_ANALYSIS",
              confidence: h.confidence || 0.7,
              description: `Detected in uploaded photo: ${h.description || ""}`,
            });
          });
          setHazards(hazardService.hazards);
        }
        setMessage("Photo analysis complete.");
      })
      .catch((analysisError) => {
        setError(`Photo analysis unavailable: ${analysisError.message}`);
        setMessage("");
      });
  }, [imageData]);

  // Map initialization
  useEffect(() => {
    if (!mapRef.current || map.current) return;
    const center = place ? [place.lat, place.lng] : [20, 78];
    map.current = L.map(mapRef.current).setView(center, place ? 16 : 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
      attribution: "© OpenStreetMap contributors", 
      maxZoom: 19 
    }).addTo(map.current);
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        marker.current = null;
      }
    };
  }, []);

  // Center map on place selection
  useEffect(() => {
    if (!place || !map.current) return;
    const center = [place.lat, place.lng];
    map.current.setView(center, 16);
    window.setTimeout(() => map.current?.invalidateSize(), 0);
    marker.current?.remove();
    marker.current = L.marker(center)
      .addTo(map.current)
      .bindPopup(`<strong>${place.name}</strong><br>${place.formatted_address}<br><small>${place.source || "MAP DATA"}</small>`)
      .openPopup();
  }, [place]);

  // Fetch and analyze place data
  useEffect(() => {
    if (!place || !map.current) return;
    let active = true;
    let analysisMapData = { buildings: [], entrances: [], exits: [], safeAreas: [] };
    let analysisResources = { hospitals: [], fireStations: [], policeStations: [] };

    setMessage("Analyzing place: fetching map data, calculating routes, checking resources...");

    Promise.all([
      getNearbyFeatures(place.lat, place.lng),
      getNearbyEmergencyResources(place.lat, place.lng),
    ])
      .then(([mapData, resources]) => {
        if (!active) return;
        analysisMapData = mapData;
        analysisResources = resources;
        setFeatures(mapData);
        setEmergencyResources(resources);

        const mapExits = (mapData.exits || [])
          .map((item, index) => ({
            id: `EXIT ${String.fromCharCode(65 + index)}`,
            lat: Number(item.center?.lat ?? item.lat ?? item.lat ?? item.y ?? 0),
            lng: Number(item.center?.lon ?? item.lng ?? item.lon ?? item.x ?? 0),
            direction: item.direction || ["NORTH", "EAST", "SOUTH", "WEST"][index % 4],
            source: item.source || "MAP_DATA",
            mapFeature: item,
            name: item.name || `Evacuation point ${index + 1}`,
          }))
          .filter((exit) => hasCoordinates(exit.lat, exit.lng))
          .slice(0, 5);

        const fallbackExits = (mapExits.length ? mapExits : []);
        return scoreExitsByRisk({ lat: place.lat, lng: place.lng }, fallbackExits.length ? fallbackExits : [
          { id: "ESTIMATED NORTH", direction: "NORTH", lat: place.lat + 0.003, lng: place.lng, name: "Estimated north route" },
          { id: "ESTIMATED EAST", direction: "EAST", lat: place.lat, lng: place.lng + 0.004, name: "Estimated east route" },
          { id: "ESTIMATED SOUTH", direction: "SOUTH", lat: place.lat - 0.003, lng: place.lng, name: "Estimated south route" },
        ], hazards);
      })
      .then((scored) => {
        if (!active) return;
        const sorted = [...(scored || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
        setRouteInfo(sorted);
        setRecommendedRoute(sorted[0] || null);
        setRouteDirections(sorted[0] ? [
          `Start at ${place.name} and move ${sorted[0].direction || "toward"} the safest exit.`,
          `Travel approximately ${(sorted[0].distance || 0 / 1000).toFixed(2) || "0.00"} km via the nearest accessible road.`,
          sorted[0].hazardNearRoute ? "Avoid the hazard zone along this route." : "Hazard exposure is low for this route.",
          `Reach ${sorted[0].id || "evacuation point"} with estimated travel time of ${Math.round((sorted[0].duration || 0) / 60 || 0)} minutes.`
        ] : []);

        const occupancyData = occupancyService.getData();
        const riskCalc = riskService.calculateRisk({
          hazardSeverity: hazards.length > 0 ? hazards[0].severity : "LOW",
          distanceToHazard: hazards.length > 0 ? 200 : Infinity,
          numberOfExits: sorted.length,
          exitDistance: sorted[0]?.distance || 500,
          crowdDensity: occupancyData.crowdDensity,
          dataConfidence: place.dataConfidence || 0.9,
        });

        return requestAiAnalysis({
            place,
            mapData: analysisMapData,
            routes: sorted,
            hazards: hazards.map((h) => ({
              type: h.type,
              severity: h.severity,
              source: h.source,
              confidence: h.confidence,
            })),
            occupancy: occupancyData,
            emergencyResources: analysisResources,
            riskCalculation: riskCalc,
            imageData: imageData || undefined,
        });
      })
      .then((result) => {
        if (!active) return;
        setAiAnalysis(result);
        setMessage("✓ Emergency analysis complete. Ready for evacuation planning.");
      })
      .catch((err) => {
        if (!active) return;
        setError(`Emergency analysis could not finish: ${err.message || "Unknown error"}`);
        setMessage("Map data remains available. You can still use the evacuation controls.");
      });

    return () => {
      active = false;
    };
  }, [place, hazards, imageData]);

  // Map layer visualization
  useEffect(() => {
    if (!map.current || !place) return;
    
    clearMapLayers();
    const newLayers = { routes: [], exits: [], buildings: [], hazards: [] };
    try {
    
    // Draw exit markers and routes
    routeInfo.forEach((exit) => {
      if (!hasCoordinates(exit.lat, exit.lng)) return;
      const color = exit.score > 85 ? "#00aa00" : exit.score > 60 ? "#ffaa00" : "#ff0000";
      const label = exit.score > 85 ? "✓ RECOMMENDED" : exit.score > 60 ? "⚠ ALTERNATIVE" : "✗ AVOID";
      
      const marker = L.marker([exit.lat, exit.lng], { title: exit.id })
        .bindPopup(`
          <strong>${exit.id}</strong><br>
          Score: ${exit.score}/100 ${label}<br>
          Distance: ${(exit.distance / 1000).toFixed(2)}km<br>
          Time: ${Math.round(exit.duration / 60)}m<br>
          <small>${exit.source || "CALCULATED"}</small>
        `)
        ;
      newLayers.exits.push(marker);
      
      // Draw route line
      if (exit.routeLine && layers.routes !== false) {
        const route = L.polyline(exit.routeLine, {
          color,
          weight: exit.score > 85 ? 4 : 2,
          opacity: exit.score > 85 ? 1 : 0.6,
          dashArray: exit.score > 85 ? "0" : "10, 5",
        })
          .bindTooltip(`${exit.id} | Score: ${exit.score}`)
          ;
        newLayers.routes.push(route);
      }
    });
    
    // Draw building outlines
    if (layers.buildings !== false) {
      features.buildings.slice(0, 8).forEach((building) => {
        if (building.center && hasCoordinates(building.center.lat, building.center.lon)) {
          newLayers.buildings.push(L.circle([building.center.lat, building.center.lon], {
            radius: 40,
            color: "#9fc1ff",
            fillColor: "#e6f2ff",
            fillOpacity: 0.1,
            weight: 1,
          })
            .bindTooltip("BUILDING (MAP DATA)"));
        }
      });
    }
    
    // Draw hazard zones
    hazards.forEach((hazard) => {
      if (hazard.location && hasCoordinates(hazard.location.lat, hazard.location.lng)) {
        const color = hazard.severity === "HIGH" ? "#ff0000" : hazard.severity === "MEDIUM" ? "#ff6600" : "#ffaa00";
        newLayers.hazards.push(L.circle([hazard.location.lat, hazard.location.lng], {
          radius: 150,
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
          dashArray: "5, 5",
        })
          .bindTooltip(`${hazard.type} | ${hazard.severity}`));
      }
    });
    
    // Apply layer visibility
    Object.entries(newLayers).forEach(([key, group]) => {
      if (layers[key] !== false && group.length > 0) {
        group.forEach((layer) => layer.addTo(map.current));
      }
    });
    
    layerGroups.current = newLayers;
    } catch (mapError) {
      clearMapLayers();
      setError(`Map overlays could not be drawn: ${mapError.message}`);
    }
  }, [place, routeInfo, features, layers, hazards]);

  async function searchLocation() {
    if (!placeQuery.trim()) {
      setError("Enter a place name before searching.");
      return;
    }
    setSearching(true);
    setError("");
    setMessage("Searching location...");
    marker.current?.remove();
    clearMapLayers();

    setPlace(null);
    setRouteInfo([]);
    setRouteDirections([]);
    setRecommendedRoute(null);
    setAiAnalysis(null);
    setAiAnswer("");
    hazardService.clear();
    setHazards([]);
    occupancyService.setUnavailable();
    setOccupancy(occupancyService.getData());

    try {
      const result = await searchPlace(placeQuery);
      if (!hasCoordinates(result.lat, result.lng)) throw new Error("Location returned invalid coordinates.");
      setPlace(result);
    } catch (searchError) {
      const msg = searchError.message === "Place not found."
        ? "Location not found. Try a more specific place name or address in India."
        : "Location service temporarily unavailable. Please try again or use your current location.";
      setError(msg);
      setMessage("");
    } finally {
      setSearching(false);
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    if (!window.isSecureContext) {
      setError("Current location needs HTTPS. Open the hosted site with its https:// URL.");
      return;
    }

    setSearching(true);
    setError("");
    setMessage("Locating you...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          let result;
          try {
            result = await searchPlace(`${latitude}, ${longitude}`);
          } catch {
            result = {
              id: `user-location:${latitude}:${longitude}`,
              name: "Current Location",
              formatted_address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
              lat: latitude,
              lng: longitude,
              source: "BROWSER_GEOLOCATION",
            };
          }
          if (!hasCoordinates(result.lat, result.lng)) throw new Error("Current location returned invalid coordinates.");
          setPlaceQuery(result.name || "Current Location");
          setPlace({ ...result, name: result.name || "Current Location", placeType: "user_location" });
          setMessage("Current location loaded and analyzed.");
        } catch (locationError) {
          setError(locationError.message || "Unable to resolve current location.");
        } finally {
          setSearching(false);
        }
      },
      (geoError) => {
        const messages = {
          1: "Location permission was denied. Allow location access in the browser and try again.",
          2: "Current location is unavailable right now.",
          3: "Location request timed out. Please try again.",
        };
        setError(messages[geoError.code] || "Unable to access your current location.");
        setMessage("");
        setSearching(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  }

  async function askAI() {
    if (!aiQuestion.trim()) return;
    setAiAnswer("AI is analyzing your question using current emergency data...");
    try {
      const result = await requestAiAnalysis({
          place: place || null,
          routes: routeInfo,
          hazards: hazards.map((h) => ({ type: h.type, severity: h.severity, source: h.source })),
          occupancy: occupancyService.getData(),
          question: aiQuestion,
      });
      setAiAnswer(result.answer || result.recommendedAction || "Unable to provide analysis at this time.");
    } catch {
      setAiAnswer("AI analysis unavailable. Check your connection or API key.");
    }
  }

  return (
    <div className="evacuation-map">
      <div className="map-header">
        <h2>🚨 Evacuation Intelligence System</h2>
        <span className="status">● {place ? "ACTIVE" : "READY"}</span>
      </div>
      
      {/* Search section */}
      <div className="place-search">
        <input
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && searchLocation()}
          placeholder="Enter building/place name or address in India"
        />
        <button onClick={searchLocation} disabled={searching}>
          {searching ? "SEARCHING..." : "SEARCH"}
        </button>
        <button onClick={useCurrentLocation} disabled={searching} className="use-location-button" style={{ marginLeft: "8px" }}>
          {searching ? "LOCATING..." : "USE MY CURRENT LOCATION"}
        </button>
      </div>

      {/* Photo upload */}
      <label className="map-upload">
        📸 Upload place photo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setMessage("Processing photo...");
            setImageUrl(URL.createObjectURL(file));
            const reader = new FileReader();
            reader.onload = () => setImageData(reader.result);
            reader.onerror = () => {
              setError("The selected photo could not be read.");
              setMessage("");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>

      {/* Status messages */}
      {error && <p className="map-error">❌ {error}</p>}
      {message && <p className="map-message">ℹ️ {message}</p>}

      {/* Layer controls */}
      <div className="map-layers">
        {Object.entries({ routes: "Routes", exits: "Exits", buildings: "Buildings" }).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layers[key] !== false}
              onChange={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Map display */}
      <div className="map-area">
        <div className="osm-map" ref={mapRef}></div>
        {imageUrl && <img className="map-image" src={imageUrl} alt="Uploaded" />}
        {!place && (
          <div className="map-grid">
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px", color: "#999", fontSize: "14px" }}>
              Enter a place name to view the real map and start emergency analysis.
            </div>
          </div>
        )}
        {/* Dashboard grid visualization is only for the demo simulation; actual place analysis is shown via real map overlays. */}
        {!place && (isRunning || alternateRoute) && (
          <div className="map-grid">
            {exits.map((exit) => (
              <div className="map-exit" style={{ left: `${exit.x * 10 + 5}%`, top: `${exit.y * 10 + 5}%` }} key={exit.id}>
                🚪 {exit.id}
              </div>
            ))}
            {routes.map((route) => (
              <svg className="route-line" viewBox="0 0 100 70" key={route.id}>
                <polyline points={route.path.map((point) => `${point.x * 10 + 5},${point.y * 10 + 5}`).join(" ")} />
              </svg>
            ))}
            {agents.map((agent) => (
              <span
                className={`agent ${agent.status.toLowerCase()}`}
                style={{ left: `${agent.x * 10 + 5}%`, top: `${agent.y * 10 + 5}%` }}
                key={agent.id}
              >
                ●
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Map legend */}
      <div className="map-legend">
        <span>✓ RECOMMENDED</span>
        <span>⚠ ALTERNATIVE</span>
        <span>✗ BLOCKED</span>
        <span>🏢 BUILDING</span>
        <span>🚪 EXIT</span>
        <span>⚠️ HAZARD</span>
      </div>

      {/* Place intelligence and analysis panels */}
      {place && (
        <div className="location-analysis">
          <LocationIntelligence place={place} />
          <OccupancyStatus occupancy={occupancy} />
          <HazardPanel hazards={hazards} />

          {/* Emergency resources */}
          {emergencyResources && (
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
                🏥 NEARBY EMERGENCY SERVICES <DataSourceBadge source="MAP_DATA" />
              </div>
              {emergencyResources.hospitals?.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Hospitals:</strong> {emergencyResources.hospitals.map((h) => h.name).join(", ")}
                </div>
              )}
              {emergencyResources.fireStations?.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Fire Stations:</strong> {emergencyResources.fireStations.map((f) => f.name).join(", ")}
                </div>
              )}
              {emergencyResources.policeStations?.length > 0 && (
                <div>
                  <strong>Police Stations:</strong> {emergencyResources.policeStations.map((p) => p.name).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Exit routes */}
          {routeInfo.length > 0 && (
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
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>🚪 EVACUATION ROUTES</div>
              {recommendedRoute && (
                <div style={{ marginBottom: "10px", padding: "8px", backgroundColor: "#edf7ee", borderRadius: "4px", borderLeft: "3px solid #00aa00" }}>
                  <strong>RECOMMENDED ROUTE</strong>
                  <div style={{ fontSize: "11px", color: "#333", marginTop: "4px" }}>
                    Safety Score: {recommendedRoute.score}/100 | Distance: {((recommendedRoute.distance || 0) / 1000).toFixed(2)} km | ETA: {Math.round((recommendedRoute.duration || 0) / 60 || 0)} min
                  </div>
                </div>
              )}
              {routeInfo.map((route, i) => (
                <div
                  key={i}
                  style={{
                    padding: "6px",
                    marginBottom: "6px",
                    backgroundColor: "#fff",
                    borderLeft: `3px solid ${route.score > 85 ? "#00aa00" : route.score > 60 ? "#ffaa00" : "#ff0000"}`,
                    borderRadius: "3px",
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>
                    {route.score > 85 ? "✓" : route.score > 60 ? "⚠" : "✗"} {route.id}
                    <span style={{ color: "#333", marginLeft: "6px", fontSize: "10px" }}>({route.direction || "Directional"} exit)</span>
                    <DataSourceBadge source={route.source || "CALCULATED"} />
                  </div>
                  <div style={{ fontSize: "11px", marginTop: "2px", color: "#666" }}>
                    Route: {route.direction || "Directional"} side | Distance: {((route.distance || 0) / 1000).toFixed(2)} km | Time: {Math.round((route.duration || 0) / 60 || 0)} min | Score: {route.score}/100
                  </div>
                </div>
              ))}
            </div>
          )}

          {routeDirections.length > 0 && (
            <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#f5f5f5", borderLeft: "4px solid #0d4d7f", borderRadius: "4px", fontSize: "12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>🧭 ROUTE DIRECTIONS</div>
              <ol style={{ margin: "0", paddingLeft: "18px", color: "#333" }}>
                {routeDirections.map((step, index) => (
                  <li key={index} style={{ marginBottom: "4px" }}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* AI analysis */}
          {aiAnalysis && !aiAnalysis.error && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px",
                backgroundColor: "#f5f5f5",
                borderLeft: "4px solid #7f4d0d",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                🧠 AI EMERGENCY ANALYSIS <DataSourceBadge source="AI_ESTIMATE" confidence={aiAnalysis.confidence} />
              </div>
              {aiAnalysis.riskLevel && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Risk Level:</strong> {aiAnalysis.riskLevel} ({aiAnalysis.riskScore}/100)
                </div>
              )}
              {aiAnalysis.recommendedExit && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Recommended Exit:</strong> {aiAnalysis.recommendedExit?.id || aiAnalysis.recommendedExit?.name || "Primary Exit"}
                </div>
              )}
              {aiAnalysis.mainRiskFactors?.length > 0 && (
                <div style={{ marginBottom: "6px" }}>
                  <strong>Risk Factors:</strong> {aiAnalysis.mainRiskFactors.slice(0, 3).join(", ")}
                </div>
              )}
              {aiAnalysis.answer && (
                <div style={{ marginTop: "8px", fontSize: "11px", fontStyle: "italic", color: "#666" }}>
                  {aiAnalysis.answer}
                </div>
              )}
            </div>
          )}

          {/* AI Assistant chat */}
          <div className="ai-assistant">
            <input
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && askAI()}
              placeholder="Ask the AI about this location, hazards, or exits..."
            />
            <button onClick={askAI} disabled={!place && !aiAnalysis}>
              ASK AI
            </button>
            {aiAnswer && <p style={{ marginTop: "8px", fontSize: "12px", color: "#333" }}>{aiAnswer}</p>}
          </div>

          {/* Data sources */}
          {aiAnalysis?.dataSources && (
            <div style={{ marginTop: "12px", fontSize: "10px", color: "#999", borderTop: "1px solid #ddd", paddingTop: "8px" }}>
              <strong>Data Sources:</strong> {aiAnalysis.dataSources.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EvacuationMap;
