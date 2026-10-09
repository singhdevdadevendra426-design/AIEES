export function buildFallbackExitsFromLocation(lat, lng) {
  const directions = [
    { id: "EXIT A", name: "North exit", direction: "NORTH", lat: Number(lat) + 0.0035, lng: Number(lng) },
    { id: "EXIT B", name: "East exit", direction: "EAST", lat: Number(lat), lng: Number(lng) + 0.0042 },
    { id: "EXIT C", name: "South exit", direction: "SOUTH", lat: Number(lat) - 0.0035, lng: Number(lng) },
    { id: "EXIT D", name: "West exit", direction: "WEST", lat: Number(lat), lng: Number(lng) - 0.0042 },
  ];

  return directions.map((exit) => ({
    ...exit,
    lat: Number(exit.lat),
    lng: Number(exit.lng),
    source: "FALLBACK_EXIT_ANALYSIS",
  }));
}

function normalizeNominatimResult(result) {
  const lat = Number(result?.lat);
  const lng = Number(result?.lon ?? result?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id: result?.osm_id || result?.place_id || `${lat}:${lng}`,
    name: result?.name || result?.display_name?.split(",")[0] || "Location",
    formatted_address: result?.display_name || "Unknown address",
    lat,
    lng,
    placeType: result?.type || result?.class || "amenity",
    dataConfidence: result?.confidence ?? 0.9,
    source: result?.source || "NOMINATIM_MAP_DATA",
    timestamp: new Date().toISOString(),
  };
}

export async function searchPlace(query) {
  const trimmedQuery = String(query || "").trim();
  const searchSources = [
    `/api/location/search?q=${encodeURIComponent(trimmedQuery)}`,
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(trimmedQuery)}`,
  ];

  let lastError = new Error("Location service unavailable.");

  for (const source of searchSources) {
    try {
      const response = await fetch(source, source.startsWith("http") ? {
        headers: {
          Accept: "application/json",
          "User-Agent": "EVACAI/1.0",
        },
      } : undefined);

      if (!response.ok) {
        throw new Error("Location service unavailable.");
      }

      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
      const result = results[0] ? normalizeNominatimResult(results[0]) : null;
      if (!result) {
        lastError = new Error("Place not found.");
        continue;
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Location service unavailable.");
    }
  }

  throw lastError;
}

function normalizeMapFeature(item, source) {
  const lat = Number(item?.center?.lat ?? item?.lat ?? item?.geometry?.coordinates?.[1]);
  const lng = Number(item?.center?.lon ?? item?.lon ?? item?.geometry?.coordinates?.[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id: item?.id || `${source}:${lat}:${lng}`,
    name: item?.tags?.name || item?.name || "Unnamed feature",
    lat,
    lng,
    center: { lat, lon: lng },
    source,
    tags: item?.tags || {},
  };
}

export async function getNearbyFeatures(lat, lng) {
  const fallbackResponse = { buildings: [], entrances: [], exits: buildFallbackExitsFromLocation(lat, lng), safeAreas: [] };
  const featureSources = [
    `/api/map/features?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json];(way(around:600,${lat},${lng})[building];node(around:600,${lat},${lng})[entrance];node(around:600,${lat},${lng})[barrier=gate];way(around:600,${lat},${lng})[leisure~"park|pitch"];way(around:2000,${lat},${lng})[amenity~"hospital|fire_station|police"];);out center;`)}`,
  ];

  for (const source of featureSources) {
    try {
      const response = await fetch(source, source.startsWith("http") ? { headers: { Accept: "application/json", "User-Agent": "EVACAI/1.0" } } : undefined);
      if (!response.ok) continue;

      const data = await response.json();
      const items = Array.isArray(data?.elements) ? data.elements : [];

      const buildings = items
        .filter((item) => item?.tags?.building)
        .map((item) => normalizeMapFeature(item, "OVERPASS_MAP_DATA"))
        .filter(Boolean);
      const entrances = items
        .filter((item) => item?.tags?.entrance || item?.tags?.barrier === "gate")
        .map((item) => normalizeMapFeature(item, "OVERPASS_ENTRANCE_DATA"))
        .filter(Boolean);
      const safeAreas = items
        .filter((item) => item?.tags?.leisure)
        .map((item) => normalizeMapFeature(item, "OVERPASS_SAFE_AREA_DATA"))
        .filter(Boolean);
      const emergencyServices = items
        .filter((item) => ["hospital", "fire_station", "police"].includes(item?.tags?.amenity))
        .map((item) => ({ ...normalizeMapFeature(item, "OVERPASS_EMERGENCY_SERVICE"), type: item?.tags?.amenity }))
        .filter(Boolean);

      const exits = Array.isArray(data?.exits) && data.exits.length
        ? data.exits
        : buildFallbackExitsFromLocation(lat, lng);

      return {
        buildings,
        entrances,
        exits,
        safeAreas,
        emergencyServices,
        notes: entrances.length ? [] : ["Entrance data unavailable. No verified OSM entrance or gate was returned."],
      };
    } catch {
      continue;
    }
  }

  return fallbackResponse;
}

export async function getRoadRoute(from, to) {
  let response;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    response = await fetch(url);
  } catch {
    throw new Error("Route unavailable.");
  }
  const data = await response.json();
  if (!response.ok || data.code !== "Ok" || !data.routes?.length) throw new Error("Route unavailable.");
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

export async function getRoadRouteInfo(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || data.code !== "Ok" || !data.routes?.length) throw new Error();
    const route = data.routes[0];
    return { 
      line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), 
      distance: route.distance, 
      duration: route.duration,
      source: "OSRM_ROUTING_DATA",
    };
  } catch {
    throw new Error("Route unavailable.");
  }
}

export async function scoreExitsByRisk(origin, exits, hazards = []) {
  const scoredExits = [];

  for (let i = 0; i < exits.length && i < 5; i++) {
    const exit = exits[i];
    const exitLat = Number(exit.lat ?? exit.center?.lat ?? origin.lat);
    const exitLng = Number(exit.lng ?? exit.lon ?? exit.center?.lon ?? origin.lng);

    try {
      const routeInfo = await getRoadRouteInfo(
        { lat: origin.lat, lng: origin.lng },
        { lat: exitLat, lng: exitLng }
      );

      const hazardNearRoute = hazards.some((h) => {
        if (!h.location) return false;
        const distanceKm = Math.sqrt(
          (h.location.lat - exitLat) ** 2 +
          (h.location.lng - exitLng) ** 2
        ) * 111;
        return distanceKm < 0.6;
      });

      const distancePenalty = routeInfo.distance > 1000 ? 15 : routeInfo.distance > 500 ? 10 : 0;
      const directionBonus = (exit.direction === "NORTH" || exit.direction === "EAST") ? 5 : 0;
      const score = Math.max(25, Math.min(100, 88 - distancePenalty + directionBonus - (hazardNearRoute ? 35 : 0)));

      scoredExits.push({
        ...exit,
        lat: exitLat,
        lng: exitLng,
        direction: exit.direction || "DIRECTIONAL",
        distance: routeInfo.distance,
        duration: routeInfo.duration,
        routeLine: routeInfo.line,
        score: Math.round(score),
        hazardNearRoute,
        source: "CALCULATED_EXIT_ANALYSIS",
      });
    } catch {
      const fallbackScore = exit.direction === "NORTH" || exit.direction === "EAST" ? 72 : 64;
      scoredExits.push({
        ...exit,
        lat: exitLat,
        lng: exitLng,
        direction: exit.direction || "DIRECTIONAL",
        distance: 0,
        duration: 0,
        score: fallbackScore,
        fallback: true,
        source: "FALLBACK_ANALYSIS",
      });
    }
  }

  return scoredExits.sort((a, b) => b.score - a.score);
}
