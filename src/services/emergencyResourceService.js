// Emergency Resource Service: Find nearby hospitals, fire stations, police
export async function getNearbyEmergencyResources(lat, lng) {
  try {
    const response = await fetch(`/api/map/features?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    if (!response.ok) return { hospitals: [], fireStations: [], policeStations: [] };
    const services = (await response.json()).emergencyServices || [];
    const hospitals = services.filter((item) => item.type === "hospital").map((item) => ({
      name: item.name || "Hospital",
      lat: item.lat,
      lng: item.lng,
      type: "HOSPITAL",
      address: item.tags?.["addr:full"] || "Address unavailable",
      source: item.source,
    }));
    const fireStations = services.filter((item) => item.type === "fire_station").map((item) => ({
      name: item.name || "Fire Station",
      lat: item.lat,
      lng: item.lng,
      type: "FIRE_STATION",
      address: item.tags?.["addr:full"] || "Address unavailable",
      source: item.source,
    }));
    const policeStations = services.filter((item) => item.type === "police").map((item) => ({
      name: item.name || "Police Station",
      lat: item.lat,
      lng: item.lng,
      type: "POLICE_STATION",
      address: item.tags?.["addr:full"] || "Address unavailable",
      source: item.source,
    }));

    return {
      hospitals: hospitals.slice(0, 3),
      fireStations: fireStations.slice(0, 3),
      policeStations: policeStations.slice(0, 3),
    };
  } catch {
    return { hospitals: [], fireStations: [], policeStations: [] };
  }
}
