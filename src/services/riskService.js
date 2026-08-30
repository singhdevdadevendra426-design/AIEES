// Risk Service: Calculate emergency risk transparently
export class RiskService {
  calculateRisk(params) {
    const {
      hazardSeverity = 0,
      distanceToHazard = Infinity,
      numberOfExits = 0,
      exitDistance = 0,
      crowdDensity = "UNKNOWN",
      routeAccessibility = "UNKNOWN",
      dataConfidence = 0.5,
    } = params;

    let riskScore = 0;

    // Hazard severity: 0-30 points
    const hazardPoints = {
      HIGH: 30,
      MEDIUM: 20,
      LOW: 10,
      UNKNOWN: 5,
    }[hazardSeverity] || 0;
    riskScore += hazardPoints;

    // Distance from hazard: 0-25 points (closer = higher risk)
    if (distanceToHazard < 100) riskScore += 25;
    else if (distanceToHazard < 300) riskScore += 15;
    else if (distanceToHazard < 500) riskScore += 5;

    // Number of exits: 0-20 points (fewer = higher risk)
    if (numberOfExits === 0) riskScore += 20;
    else if (numberOfExits === 1) riskScore += 15;
    else if (numberOfExits === 2) riskScore += 10;

    // Exit distance: 0-15 points (farther = higher risk)
    if (exitDistance > 500) riskScore += 15;
    else if (exitDistance > 300) riskScore += 10;
    else if (exitDistance > 100) riskScore += 5;

    // Crowd density: 0-10 points
    const crowdPoints = {
      CRITICAL: 10,
      HIGH: 8,
      MEDIUM: 5,
      LOW: 2,
      EMPTY: 0,
      UNKNOWN: 3,
    }[crowdDensity] || 0;
    riskScore += crowdPoints;

    // Route accessibility: 0-5 points
    if (routeAccessibility === "BLOCKED") riskScore += 5;
    else if (routeAccessibility === "RESTRICTED") riskScore += 3;

    // Data confidence: lower confidence = higher uncertainty penalty
    const confidencePenalty = (1 - dataConfidence) * 5;
    riskScore += confidencePenalty;

    // Normalize to 0-100
    riskScore = Math.min(100, Math.max(0, riskScore));

    return {
      riskScore: Math.round(riskScore),
      riskLevel: this.getRiskLevel(riskScore),
      factors: {
        hazardSeverity: hazardPoints,
        hazardProximity: Math.max(0, 25 - (distanceToHazard / 20)),
        exitAvailability: numberOfExits === 0 ? 20 : numberOfExits === 1 ? 15 : 10,
        exitDistance: exitDistance > 500 ? 15 : exitDistance > 300 ? 10 : 5,
        crowdDensity: crowdPoints,
        routeAccessibility: routeAccessibility === "BLOCKED" ? 5 : 0,
        dataUncertainty: confidencePenalty,
      },
    };
  }

  getRiskLevel(score) {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 40) return "MEDIUM";
    if (score >= 20) return "LOW";
    return "MINIMAL";
  }
}

export const riskService = new RiskService();
