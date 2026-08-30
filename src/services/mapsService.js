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

export async function searchPlace(query) {
  let response;
  try {
    response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
  } catch {
    throw new Error("Location service unavailable.");
  }
  if (!response.ok) throw new Error("Location service unavailable.");

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Location service unavailable.");
  }

  const results = payload.results;
  if (!Array.isArray(results) || !results.length) throw new Error("Place not found.");

  const result = results[0];
  const lat = Number(result.lat);
  const lng = Number(result.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Location service returned invalid coordinates.");

  return {
    name: result.name || result.formatted_address.split(",")[0],
    formatted_address: result.display_name,
    place_id: result.id,
    lat,
    lng,
    placeType: result.type || "amenity",
    dataConfidence: result.confidence ?? 0.9,
    source: result.source || "NOMINATIM_MAP_DATA",
    timestamp: new Date().toISOString(),
  };
}

export async function getNearbyFeatures(lat, lng) {
  try {
    const response = await fetch(`/api/map/features?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    if (!response.ok) {
      return { buildings: [], entrances: [], exits: buildFallbackExitsFromLocation(lat, lng), safeAreas: [] };
    }
    const data = await response.json();
    const exits = Array.isArray(data.exits) && data.exits.length ? data.exits : buildFallbackExitsFromLocation(lat, lng);
    return {
      ...data,
      buildings: (data.buildings || []).map((building) => ({ ...building, center: { lat: building.lat, lon: building.lng } })),
      entrances: data.entrances || [],
      exits,
      safeAreas: data.safeAreas || [],
    };
  } catch {
    return { buildings: [], entrances: [], exits: buildFallbackExitsFromLocation(lat, lng), safeAreas: [] };
  }
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
