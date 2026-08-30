// Hazard Engine: Manages real hazards from all sources
export class HazardService {
  constructor() {
    this.hazards = [];
  }

  addHazard(hazard) {
    if (!hazard.type || !hazard.severity || !hazard.source) {
      throw new Error("Hazard must have type, severity, and source");
    }
    const normalized = {
      id: `${Date.now()}_${Math.random()}`,
      type: hazard.type,
      severity: hazard.severity || "MEDIUM",
      location: hazard.location || null,
      source: hazard.source,
      confidence: hazard.confidence ?? 0.5,
      timestamp: hazard.timestamp || new Date().toISOString(),
      description: hazard.description || "",
    };
    this.hazards.push(normalized);
    return normalized;
  }

  removeHazard(hazardId) {
    this.hazards = this.hazards.filter((h) => h.id !== hazardId);
  }

  getHazardsByType(type) {
    return this.hazards.filter((h) => h.type === type);
  }

  getHazardsNearLocation(lat, lng, radiusKm = 1) {
    const earthRadiusKm = 6371;
    return this.hazards.filter((hazard) => {
      if (!hazard.location) return false;
      const dLat = (hazard.location.lat - lat) * (Math.PI / 180);
      const dLng = (hazard.location.lng - lng) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * (Math.PI / 180)) * Math.cos(hazard.location.lat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.asin(Math.sqrt(a));
      const distance = earthRadiusKm * c;
      return distance <= radiusKm;
    });
  }

  getHighRiskHazards() {
    return this.hazards.filter((h) => h.severity === "HIGH");
  }

  clear() {
    this.hazards = [];
  }
}

export const hazardService = new HazardService();
