# EVACAI System Architecture & Data Flow

## System Overview

EVACAI is a real-time emergency evacuation intelligence system that:
- Accepts place names or photos as input
- Fetches REAL geographic data from OpenStreetMap (Nominatim, Overpass)
- Calculates REAL evacuation routes using OSRM routing engine
- Analyzes images/videos with OpenAI vision AI
- Tracks occupancy from available sources (CCTV, sensors, manual)
- Identifies and tracks hazards
- Calculates risk scores transparently
- Provides AI-assisted evacuation planning
- Shows all data sources explicitly (no faked data)

## Architecture

```
Frontend (React 19 + Leaflet)
    ↓
Vite Dev Server (Proxy: /api → http://localhost:8787)
    ↓
Backend (Node.js HTTP Server on port 8787)
    ↓
External Services:
    - Nominatim (OSM geocoding)
    - Overpass API (building/exit/POI data)
    - OSRM (routing)
    - OpenAI Responses API (AI analysis + vision)
```

## Core Services

### `mapsService.js`
- `searchPlace(query)` → Get coordinates & place info from Nominatim
- `getNearbyFeatures(lat, lng)` → Get buildings/entrances/exits from Overpass
- `scoreExitsByRisk(origin, exits, hazards)` → Rank exits by distance + hazard proximity
- `getRoadRouteInfo(from, to)` → Get distance/duration from OSRM

### `hazardService.js`
- Manages hazard list (type, severity, location, source, confidence)
- Methods: `addHazard()`, `removeHazard()`, `getHazardsNearLocation()`, `getHighRiskHazards()`
- Source: IMAGE_ANALYSIS, USER_INPUT, SENSOR_DATA, etc.

### `occupancyService.js`
- Tracks occupancy data source (CAMERA_ANALYSIS, BUILDING_API, MANUAL_COUNT, SENSOR, or UNAVAILABLE)
- Updates crowd density automatically (EMPTY → LOW → MEDIUM → HIGH → CRITICAL)
- Methods: `setFromCameraAnalysis()`, `setFromBuildingAPI()`, `setFromManualCount()`, `setUnavailable()`
- Never fakes "24 people" - returns UNAVAILABLE if no real data

### `riskService.js`
- Calculates transparent risk score (0-100) based on:
  - Hazard severity (0-30 pts)
  - Distance to hazard (0-25 pts)
  - Number of exits (0-20 pts)
  - Exit distance (0-15 pts)
  - Crowd density (0-10 pts)
  - Route accessibility (0-5 pts)
  - Data uncertainty penalty (0-5 pts)
- Returns: riskScore, riskLevel (MINIMAL/LOW/MEDIUM/HIGH/CRITICAL), factors breakdown

### `emergencyResourceService.js`
- `getNearbyEmergencyResources(lat, lng)` → Find hospitals, fire stations, police
- Uses Overpass API with 2km radius
- Returns source: "MAP_DATA"

## Backend Endpoint

**POST /api/ai/analyze**

Request body:
```javascript
{
  place: { name, formatted_address, lat, lng, placeType, source, dataConfidence },
  mapData: { buildings, entrances, exits, safeAreas },
  routes: [{ id, lat, lng, distance, duration, score, source }, ...],
  hazards: [{ type, severity, source, confidence, description }, ...],
  occupancy: { source, visibleCount, estimatedCount, confidence, crowdDensity },
  emergencyResources: { hospitals, fireStations, policeStations },
  riskCalculation: { riskScore, riskLevel, factors },
  imageData: "data:image/..." (optional),
  question: "user question" (optional)
}
```

Response (JSON Schema enforced):
```javascript
{
  riskScore: 0-100,
  riskLevel: "MINIMAL|LOW|MEDIUM|HIGH|CRITICAL",
  recommendedExit: "EXIT A",
  alternativeExits: ["EXIT C", "EXIT B"],
  blockedExits: ["EXIT D"],
  hazards: [{ type, severity, source }],
  occupancy: { source, estimatedCount, confidence },
  emergencyResources: { nearest, distance },
  mainRiskFactors: ["High crowd density", "Fire detected"],
  dataSources: ["NOMINATIM_MAP_DATA", "OSRM_ROUTING", "IMAGE_ANALYSIS"],
  dataAvailability: { occupancy: boolean, hazards: boolean, ... },
  answer: "Reasoning explanation"
}
```

## UI Components

### `EvacuationMap.jsx` (Core)
- Real-time Leaflet map visualization
- Place search with Nominatim
- Route calculation and visualization
- Hazard/exit/building layers
- Photo upload with vision AI
- Integration with all services
- AI emergency brain chat

### `LocationIntelligence.jsx`
- Displays place metadata: name, address, coordinates
- Shows data source and confidence
- Data badge integration

### `OccupancyStatus.jsx`
- Shows real occupancy data
- Displays source (CAMERA, SENSOR, MANUAL, or UNAVAILABLE)
- Shows crowd density with color coding
- Confidence percentage

### `HazardPanel.jsx`
- Lists all detected hazards
- Shows type, severity, source, confidence
- Color-coded by severity

### `DataSourceBadge.jsx`
- Inline badge showing data source
- Color-coded by source type
- Hoverable tooltip with confidence

## Data Source Transparency

Every important data point shows its source:
- **REAL MAP DATA** (blue) - From Nominatim/Overpass/OSM
- **AI ESTIMATE** (brown) - From AI analysis
- **CAMERA_ANALYSIS** (green) - From video/image vision AI
- **SENSOR_DATA** (green) - From occupancy/traffic sensors
- **SIMULATION** (purple) - Fictional/demo data
- **USER_INPUT** (yellow) - Manually entered
- **UNAVAILABLE** (red) - No data available

## User Flow

1. **Search Location**
   - User enters "C21 Mall Bhopal"
   - searchPlace() → Nominatim → coordinates + metadata
   - Map centers on location

2. **Fetch Real Data**
   - getNearbyFeatures() → Overpass → buildings, entrances, exits, safe areas
   - getNearbyEmergencyResources() → Overpass → hospitals, fire, police

3. **Calculate Routes**
   - scoreExitsByRisk() → OSRM for each candidate exit
   - Ranks by distance + hazard exposure
   - Returns routes with real distances/times

4. **AI Analysis**
   - Backend receives: place, map data, routes, occupancy, hazards
   - OpenAI analyzes and provides:
     - Risk assessment
     - Best exit recommendation
     - Alternative routes
     - Confidence scores
   - Response shows data sources

5. **Occupancy Handling**
   - If CCTV/camera available: upload video, AI counts visible people
   - If sensor available: manual entry or API integration
   - If no data: shows "UNAVAILABLE" (not fake "24 people")

6. **Hazard Management**
   - From image: AI detects doors, exits, fire, smoke, crowds
   - From sensors: real-time hazard input
   - From user: manual hazard creation
   - System recalculates routes when hazard updates

7. **Emergency Simulation**
   - Separate from real analysis
   - Dashboard shows A* pathfinding with simulated fire zone
   - Grid visualization of evacuation progress
   - Tracks agent evacuation status

## Environment Variables

**.env** (server-side only, never in frontend bundle):
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5
```

**.env.example** (shared):
```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5
```

## Running the System

Terminal 1 (Backend):
```bash
cd frontend
npm run server
# Listening on http://localhost:8787
```

Terminal 2 (Frontend Dev):
```bash
cd frontend
npm run dev
# Accessible at http://localhost:5173
```

Testing:
```bash
npm run lint
npm run build
```

## Key Principles

1. **NO FAKE DATA**: System shows "UNAVAILABLE" rather than inventing data
2. **TRANSPARENCY**: Every claim is sourced and confidence-rated
3. **REAL GEOGRAPHY**: All coordinates from verified map data
4. **AI REASONING ONLY**: AI analyzes provided data, doesn't hallucinate
5. **BACKWARD COMPATIBLE**: Existing simulation grid still works
6. **PRODUCTION READY**: Services are modular and extensible

## Supported Test Cases

- ✅ "C21 Mall Bhopal" → Real map, real exits, real routes
- ✅ "SGVU Jaipur" → Real campus, real buildings
- ✅ Photo upload → Vision analysis
- ✅ No occupancy data → Shows UNAVAILABLE (not fake count)
- ✅ No exits found → Shows simulated geometry + fallback
- ✅ Multiple hazards → Routes recalculate
- ✅ Ask AI questions → Answers based on current state
- ✅ Evacuation simulation → Separate grid visualization
- ✅ Error handling → Graceful fallbacks
- ✅ npm run build → No errors
- ✅ npm run lint → No warnings

---

**Version**: 2.0 - Real Data Architecture
**Last Updated**: 2025-08-30
**Status**: Production-Ready
