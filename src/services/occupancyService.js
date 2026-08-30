// Occupancy Service: Real occupancy data from available sources
export class OccupancyService {
  constructor() {
    this.source = null;
    this.count = null;
    this.estimatedCount = null;
    this.confidence = 0;
    this.lastUpdated = null;
    this.crowdDensity = "UNKNOWN";
  }

  // Camera/video analysis
  setFromCameraAnalysis(visibleCount, estimatedCount, confidence = 0.7) {
    this.source = "CAMERA_ANALYSIS";
    this.count = visibleCount;
    this.estimatedCount = estimatedCount;
    this.confidence = confidence;
    this.lastUpdated = new Date().toISOString();
    this.updateCrowdDensity();
    return this.getData();
  }

  // Building occupancy API
  setFromBuildingAPI(count, confidence = 0.9) {
    this.source = "BUILDING_API";
    this.count = count;
    this.estimatedCount = count;
    this.confidence = confidence;
    this.lastUpdated = new Date().toISOString();
    this.updateCrowdDensity();
    return this.getData();
  }

  // Manual count
  setFromManualCount(count) {
    this.source = "MANUAL_COUNT";
    this.count = count;
    this.estimatedCount = count;
    this.confidence = 0.6;
    this.lastUpdated = new Date().toISOString();
    this.updateCrowdDensity();
    return this.getData();
  }

  // Sensor data
  setFromSensor(count, confidence = 0.8) {
    this.source = "OCCUPANCY_SENSOR";
    this.count = count;
    this.estimatedCount = count;
    this.confidence = confidence;
    this.lastUpdated = new Date().toISOString();
    this.updateCrowdDensity();
    return this.getData();
  }

  updateCrowdDensity() {
    const count = this.estimatedCount || 0;
    if (count === 0) this.crowdDensity = "EMPTY";
    else if (count < 10) this.crowdDensity = "LOW";
    else if (count < 50) this.crowdDensity = "MEDIUM";
    else if (count < 100) this.crowdDensity = "HIGH";
    else this.crowdDensity = "CRITICAL";
  }

  // No data available
  setUnavailable() {
    this.source = null;
    this.count = null;
    this.estimatedCount = null;
    this.confidence = 0;
    this.crowdDensity = "UNKNOWN";
  }

  getData() {
    if (!this.source) {
      return {
        source: "UNAVAILABLE",
        visibleCount: null,
        estimatedCount: null,
        confidence: 0,
        crowdDensity: "UNKNOWN",
        lastUpdated: null,
      };
    }

    return {
      source: this.source,
      visibleCount: this.count,
      estimatedCount: this.estimatedCount,
      confidence: this.confidence,
      crowdDensity: this.crowdDensity,
      lastUpdated: this.lastUpdated,
    };
  }

  clear() {
    this.source = null;
    this.count = null;
    this.estimatedCount = null;
    this.confidence = 0;
    this.crowdDensity = "UNKNOWN";
  }
}

export const occupancyService = new OccupancyService();
