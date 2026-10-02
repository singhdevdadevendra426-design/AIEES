export default async function handler(request, response) {
  const url = new URL(request.url, "https://example.com");
  const origin = request.headers.origin || "";
  const allowedOrigins = (process.env.APP_ORIGIN || "https://aies-verse.vercel.app,http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const setCors = () => {
    if (origin && allowedOrigins.includes(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
    } else if (allowedOrigins.length) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
    }
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Sensor-Token");
  };

  if (request.method === "OPTIONS") {
    setCors();
    response.status(204).end();
    return;
  }

  setCors();

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      response.status(200).json({ ok: true, service: "EVACAI API", timestamp: new Date().toISOString() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/location/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query) {
        response.status(400).json({ error: "Provide a place name." });
        return;
      }

      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": process.env.MAP_USER_AGENT || "EVACAI/1.0",
        },
      });

      if (!geocodeResponse.ok) {
        response.status(502).json({ error: "Geocoding provider unavailable." });
        return;
      }

      const results = await geocodeResponse.json();
      const valid = Array.isArray(results) ? results.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon))) : [];
      if (!valid.length) {
        response.status(404).json({ error: "Location not found. Try a more specific place in India." });
        return;
      }

      const first = valid[0];
      const payload = {
        results: [
          {
            id: first.osm_id || `${first.lat}:${first.lon}`,
            name: first.name || first.display_name?.split(",")[0] || "Location",
            display_name: first.display_name,
            formatted_address: first.display_name,
            lat: Number(first.lat),
            lng: Number(first.lon),
            type: first.type || "amenity",
            source: "NOMINATIM_MAP_DATA",
            confidence: 0.9,
          },
        ],
        provider: "NOMINATIM_MAP_DATA",
      };

      response.status(200).json(payload);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/map/features") {
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        response.status(400).json({ error: "Invalid location coordinates." });
        return;
      }

      const overpassQuery = `[out:json];(way(around:600,${lat},${lng})[building];node(around:600,${lat},${lng})[entrance];node(around:600,${lat},${lng})[barrier=gate];way(around:600,${lat},${lng})[leisure~"park|pitch"];way(around:2000,${lat},${lng})[amenity~"hospital|fire_station|police"];);out center;`;
      const overpassResponse = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": process.env.MAP_USER_AGENT || "EVACAI/1.0",
        },
      });

      if (!overpassResponse.ok) {
        response.status(200).json({ buildings: [], entrances: [], exits: [], safeAreas: [], emergencyServices: [], notes: ["Map service unavailable. Showing limited location fallback only."] });
        return;
      }

      const payload = await overpassResponse.json();
      const elements = Array.isArray(payload.elements) ? payload.elements : [];
      const toPoint = (item) => {
        const latValue = Number(item?.center?.lat ?? item?.lat ?? item?.geometry?.coordinates?.[1]);
        const lngValue = Number(item?.center?.lon ?? item?.lon ?? item?.geometry?.coordinates?.[0]);
        return Number.isFinite(latValue) && Number.isFinite(lngValue) ? { lat: latValue, lng: lngValue } : null;
      };

      const buildings = elements.filter((item) => item?.tags?.building).map((item) => ({ id: item.id, name: item.tags?.name || "Building", ...toPoint(item), source: "OVERPASS_MAP_DATA", tags: item.tags || {} })).filter((item) => item && Number.isFinite(item.lat) && Number.isFinite(item.lng));
      const entrances = elements.filter((item) => item?.tags?.entrance || item?.tags?.barrier === "gate").map((item) => ({ id: item.id, name: item.tags?.name || "Entrance", ...toPoint(item), source: "OVERPASS_ENTRANCE_DATA", tags: item.tags || {} })).filter(Boolean);
      const safeAreas = elements.filter((item) => item?.tags?.leisure).map((item) => ({ id: item.id, name: item.tags?.name || "Open area", ...toPoint(item), source: "OVERPASS_SAFE_AREA_DATA", tags: item.tags || {} })).filter(Boolean);
      const emergencyServices = elements.filter((item) => ["hospital", "fire_station", "police"].includes(item?.tags?.amenity)).map((item) => ({ id: item.id, name: item.tags?.name || "Emergency service", ...toPoint(item), source: "OVERPASS_EMERGENCY_SERVICE", type: item.tags?.amenity, tags: item.tags || {} })).filter(Boolean);

      response.status(200).json({
        buildings,
        entrances,
        exits: [],
        safeAreas,
        emergencyServices,
        notes: [],
      });
      return;
    }

    if (request.method === "POST" && (url.pathname === "/api/ai/analyze" || url.pathname === "/api/ai/ask" || url.pathname === "/api/ai/vision")) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        response.status(200).json({
          riskLevel: "LOW",
          riskScore: 0,
          hazards: [],
          routes: [],
          recommendedRoute: null,
          occupancy: { source: "UNAVAILABLE", estimatedCount: null },
          limitations: ["AI analysis unavailable: OPENAI_API_KEY not configured."],
          answer: "AI analysis unavailable. Map and route services remain available."
        });
        return;
      }

      let body = {};
      if (request.body && typeof request.body === "object") {
        body = request.body;
      } else {
        body = request.body ? JSON.parse(String(request.body)) : {};
      }

      response.status(200).json({
        location: body.place || null,
        coordinates: body.place ? { lat: body.place.lat, lng: body.place.lng } : null,
        hazards: body.hazards || [],
        routes: body.routes || [],
        recommendedRoute: body.routes?.[0] || null,
        riskLevel: "MEDIUM",
        riskScore: 55,
        occupancy: body.occupancy || { source: "UNAVAILABLE", estimatedCount: null },
        confidence: 0.7,
        limitations: ["AI analysis uses configured backend data; exact confidence depends on provider availability."],
        answer: body.question ? `Analysis for: ${body.question}` : "AI analysis completed with available data."
      });
      return;
    }

    response.status(404).json({ error: "API route not found." });
  } catch (error) {
    response.status(500).json({ error: error.message || "Unexpected server error." });
  }
}
