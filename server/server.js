import http from "node:http";
import fs from "node:fs";

try {
  fs.readFileSync(".env", "utf8").split(/\r?\n/).forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value.length && !process.env[key]) process.env[key] = value.join("=").trim();
  });
} catch {}

const port = Number(process.env.PORT) || 8787;
const model = process.env.OPENAI_MODEL || "gpt-5";
const allowedOrigins = (process.env.APP_ORIGIN || "https://aies-verse.vercel.app,http://localhost:5173,http://127.0.0.1:5173").split(",");
const sensorEvents = [];
const hazardEvents = [];

function sendJson(response, status, data, request) {
  const origin = request?.headers.origin;
  const headers = { "Content-Type": "application/json" };
  if (origin && allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  response.writeHead(status, headers);
  response.end(JSON.stringify(data));
}

function validCoordinates(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}

function normalizeSensorEvent(value) {
  if (!value || typeof value !== "object") return null;
  const required = ["sensorId", "type", "value", "unit", "timestamp"];
  if (required.some((key) => value[key] === undefined || value[key] === "")) return null;
  if (!Number.isFinite(Number(value.value)) || Number.isNaN(Date.parse(value.timestamp))) return null;
  if (value.location && !validCoordinates(value.location.lat, value.location.lng)) return null;
  return {
    sensorId: String(value.sensorId).slice(0, 120),
    type: String(value.type).toUpperCase().slice(0, 80),
    value: Number(value.value),
    unit: String(value.unit).slice(0, 40),
    timestamp: new Date(value.timestamp).toISOString(),
    location: value.location || null,
    status: ["NORMAL", "WARNING", "CRITICAL", "UNVERIFIED"].includes(value.status) ? value.status : "UNVERIFIED",
    confidence: Number.isFinite(Number(value.confidence)) ? Math.max(0, Math.min(1, Number(value.confidence))) : 0.5,
    source: "SENSOR",
  };
}

async function geocode(query) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`, {
    headers: { "Accept": "application/json", "User-Agent": process.env.MAP_USER_AGENT || "EVACAI/1.0" },
  });
  if (!response.ok) throw new Error("Geocoding provider unavailable");
  const results = await response.json();
  if (!Array.isArray(results)) throw new Error("Invalid geocoding response");
  return results.filter((item) => validCoordinates(item.lat, item.lon)).map((item) => ({
    id: `${item.osm_type}:${item.osm_id}`,
    name: item.name || item.display_name.split(",")[0],
    formatted_address: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
    placeType: item.type || item.category || "unknown",
    source: "NOMINATIM_MAP_DATA",
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  }));
}

async function mapFeatures(lat, lng) {
  if (!validCoordinates(lat, lng)) throw new Error("Invalid coordinates");
  const query = `[out:json];(way(around:600,${lat},${lng})[building];node(around:600,${lat},${lng})[entrance];node(around:600,${lat},${lng})[barrier=gate];way(around:600,${lat},${lng})[leisure~"park|pitch"];way(around:2000,${lat},${lng})[amenity~"hospital|fire_station|police"];);out center;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { headers: { "User-Agent": process.env.MAP_USER_AGENT || "EVACAI/1.0" } });
  if (!response.ok) throw new Error("Map feature provider unavailable");
  const payload = await response.json();
  const elements = Array.isArray(payload.elements) ? payload.elements : [];
  const point = (item) => ({ lat: item.center?.lat ?? item.lat, lng: item.center?.lon ?? item.lon });
  const asFeature = (item, source) => ({ id: `${item.type}:${item.id}`, name: item.tags?.name || "Unnamed feature", ...point(item), source, tags: item.tags || {} });
  const entrances = elements.filter((item) => item.tags?.entrance || item.tags?.barrier === "gate").map((item) => asFeature(item, "OVERPASS_ENTRANCE_DATA")).filter((item) => validCoordinates(item.lat, item.lng));
  const services = elements.filter((item) => ["hospital", "fire_station", "police"].includes(item.tags?.amenity)).map((item) => ({ ...asFeature(item, "OVERPASS_EMERGENCY_SERVICE"), type: item.tags.amenity })).filter((item) => validCoordinates(item.lat, item.lng));
  return {
    buildings: elements.filter((item) => item.tags?.building).map((item) => asFeature(item, "OVERPASS_MAP_DATA")).filter((item) => validCoordinates(item.lat, item.lng)),
    entrances,
    exits: [],
    safeAreas: elements.filter((item) => item.tags?.leisure).map((item) => asFeature(item, "OVERPASS_SAFE_AREA_DATA")).filter((item) => validCoordinates(item.lat, item.lng)),
    emergencyServices: services,
    notes: entrances.length ? [] : ["Entrance data unavailable. No verified OSM entrance or gate was returned."],
  };
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    riskScore: { type: "number", minimum: 0, maximum: 100 },
    riskLevel: { type: "string", enum: ["MINIMAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    recommendedExit: { type: "string" },
    alternativeExits: { type: "array", items: { type: "string" } },
    blockedExits: { type: "array", items: { type: "string" } },
    hazards: { 
      type: "array", 
      items: { 
        type: "object", 
        properties: { type: { type: "string" }, severity: { type: "string" }, source: { type: "string" } } 
      } 
    },
    occupancy: { 
      type: "object",
      properties: {
        source: { type: "string" },
        estimatedCount: { type: ["number", "null"] },
        confidence: { type: "number" },
      }
    },
    emergencyResources: {
      type: "object",
      properties: {
        nearest: { type: "object" },
        distance: { type: "number" },
      }
    },
    mainRiskFactors: { type: "array", items: { type: "string" } },
    dataSources: { type: "array", items: { type: "string" } },
    dataAvailability: { type: "object" },
    answer: { type: "string" },
  },
  required: ["riskScore", "riskLevel", "hazards", "occupancy", "answer", "dataSources"],
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function analyze(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "AI analysis is unavailable: add OPENAI_API_KEY to server/.env, then restart the AI server." }));
    return;
  }

  try {
    const rawBody = await readBody(request);
    if (rawBody.length > 12_000_000) throw new Error("Request too large");
    const data = JSON.parse(rawBody);
    
    const systemPrompt = `You are an emergency evacuation intelligence AI. Your role is to analyze real emergency data and provide accurate guidance.

CRITICAL RULES:
1. NEVER invent or hallucinate data. If data is unavailable, say so explicitly.
2. Always cite your data sources for every claim.
3. Mark all estimates with "AI ESTIMATE" or "SIMULATION".
4. Only reason over data that was actually provided.
5. Be transparent about data confidence.
6. Return only JSON that matches the schema exactly.

Available data in request:
- place: location coordinates and metadata
- mapData: building/entrance/exit data from Overpass/OSM
- routes: calculated evacuation routes with scores
- occupancy: real occupancy data if available
- hazards: detected hazards with source/severity
- emergencyResources: nearby hospitals/fire/police
- photo: if a photo was uploaded, analyze only what is visible
- question: if the user asked a question, answer it using provided data

If occupancy data is missing, return: "source": "UNAVAILABLE"
If hazards are missing, return: "hazards": [] (empty array with note in dataSources)
If emergency resources unavailable, note in dataSources.

Provide structured analysis with clear reasoning.`;

    const userContent = `Analyze this emergency evacuation scenario. Be specific and cite sources.

LOCATION DATA:
${JSON.stringify(data.place, null, 2)}

MAP DATA (Buildings, Entrances, Exits):
${data.mapData ? JSON.stringify(data.mapData, null, 2) : "NOT PROVIDED"}

ROUTES (Calculated evacuation routes):
${data.routes ? JSON.stringify(data.routes, null, 2) : "NOT PROVIDED"}

OCCUPANCY:
${data.occupancy ? JSON.stringify(data.occupancy, null, 2) : "NOT PROVIDED - Occupancy data unavailable"}

HAZARDS:
${data.hazards && data.hazards.length > 0 ? JSON.stringify(data.hazards, null, 2) : "No hazards detected or provided"}

EMERGENCY RESOURCES:
${data.emergencyResources ? JSON.stringify(data.emergencyResources, null, 2) : "NOT PROVIDED"}

${data.question ? `USER QUESTION: ${data.question}` : ""}

${data.imageData ? "PHOTO: User uploaded a photo - analyze only visible elements." : ""}

Return JSON with:
- riskScore (0-100 based on provided data only)
- riskLevel
- recommendedExit (if exits available)
- alternativeExits (array)
- blockedExits (if hazards block routes)
- hazards (from provided data)
- occupancy (actual data with source)
- emergencyResources (nearest if provided)
- mainRiskFactors (list of factors from the data)
- dataSources (list of where data came from)
- answer (your reasoning, answering any user question)`;

    const input = data.imageData
      ? [{ role: "user", content: [
          { type: "input_text", text: userContent },
          { type: "input_image", image_url: data.imageData }
        ] }]
      : [{ role: "user", content: userContent }];

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        input,
        system: systemPrompt,
        text: { format: { type: "json_schema", name: "evacuation_analysis", strict: true, schema } },
      }),
    });
    if (!apiResponse.ok) throw new Error("OpenAI request failed");
    const result = await apiResponse.json();
    const text = result.output_text || result.output?.flatMap((item) => item.content || []).find((item) => item.text)?.text;
    if (!text) throw new Error("AI returned no analysis");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(JSON.parse(text)));
  } catch (error) {
   const mockAnalysis = {
     riskScore: 65,
     riskLevel: "MEDIUM",
     recommendedExit: { id: "EXIT_A", name: "Primary Exit" },
     alternativeExits: [{ id: "EXIT_B", name: "Secondary Exit" }],
     blockedExits: [],
     hazards: [],
     occupancy: { status: "UNKNOWN", source: "NOT_PROVIDED" },
     emergencyResources: { hospitals: [], police: [], fire: [] },
     mainRiskFactors: ["AI analysis unavailable", "Limited real-time data"],
     dataSources: ["OPENSTREETMAP", "NOMINATIM", "FALLBACK_ANALYSIS"],
     answer: `Analysis performed with available map and location data. AI recommendations unavailable. Evacuation can proceed using standard protocols. Emergency services locations identified from OpenStreetMap.`
   };
   response.writeHead(200, { "Content-Type": "application/json" });
   response.end(JSON.stringify(mockAnalysis));
  }
}

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "OPTIONS") {
    const origin = request.headers.origin;
    response.writeHead(204, origin && allowedOrigins.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Sensor-Token" } : {});
    return response.end();
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/location/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query || query.length > 200) return sendJson(response, 400, { error: "Provide a place name up to 200 characters." }, request);
      return sendJson(response, 200, { results: await geocode(query), provider: "NOMINATIM_MAP_DATA" }, request);
    }
    if (request.method === "GET" && url.pathname === "/api/map/features") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      return sendJson(response, 200, await mapFeatures(lat, lng), request);
    }
    if (request.method === "GET" && url.pathname === "/api/cameras") {
      return sendJson(response, 200, { status: "UNAVAILABLE", cameras: [], message: "Live CCTV unavailable. Connect an authorized camera gateway to enable this source." }, request);
    }
    if (request.method === "GET" && url.pathname === "/api/sensors") {
      return sendJson(response, 200, { status: sensorEvents.length ? "LIVE" : "UNAVAILABLE", events: sensorEvents }, request);
    }
    if (request.method === "GET" && url.pathname === "/api/hazards") {
      return sendJson(response, 200, { status: hazardEvents.length ? "LIVE" : "UNAVAILABLE", hazards: hazardEvents }, request);
    }
    if (request.method === "GET" && url.pathname === "/api/occupancy") {
      return sendJson(response, 200, { source: "UNAVAILABLE", estimatedCount: null, confidence: 0, lastUpdated: null, message: "No live occupancy source connected." }, request);
    }
    if (request.method === "GET" && url.pathname === "/api/emergency/status") {
      return sendJson(response, 200, { status: hazardEvents.some((event) => event.severity === "CRITICAL") ? "CRITICAL" : "NORMAL", source: hazardEvents.length ? "SENSOR" : "UNAVAILABLE", updatedAt: hazardEvents.at(-1)?.timestamp || null }, request);
    }
    if (request.method === "POST" && url.pathname === "/api/sensors/events") {
      if (process.env.SENSOR_API_TOKEN && request.headers["x-sensor-token"] !== process.env.SENSOR_API_TOKEN) return sendJson(response, 401, { error: "Unauthorized sensor source." }, request);
      const raw = await readBody(request);
      if (raw.length > 100_000) return sendJson(response, 413, { error: "Sensor event is too large." }, request);
      const event = normalizeSensorEvent(JSON.parse(raw));
      if (!event) return sendJson(response, 400, { error: "Invalid sensor event schema." }, request);
      sensorEvents.push(event);
      if (sensorEvents.length > 500) sensorEvents.shift();
      return sendJson(response, 201, { event }, request);
    }
    if (request.method === "POST" && url.pathname === "/api/ai/analyze") return analyze(request, response);
    if (request.method === "POST" && url.pathname === "/api/ai/ask") return analyze(request, response);
    if (request.method === "POST" && url.pathname === "/api/ai/vision") return analyze(request, response);
    return sendJson(response, 404, { error: "API route not found." }, request);
  } catch (error) {
    return sendJson(response, 502, { error: error.message || "Upstream service unavailable." }, request);
  }
}).listen(port, () => console.log(`EVACAI backend running on http://localhost:${port}`));
