# EVACAI Real Data System - Quick Start Guide

## Setup (First Time)

### 1. Set Environment Variables

Create `.env` in `frontend/` directory:
```bash
OPENAI_API_KEY=your_actual_openai_key_here
OPENAI_MODEL=gpt-4o-mini  # or gpt-5 if available
```

**IMPORTANT**: Keep `.env` secret! It's in `.gitignore` and never sent to frontend.

### 2. Start Backend

```bash
cd frontend
npm run server
# Output: EVACAI AI server running on http://localhost:8787
```

Keep this terminal open.

### 3. Start Frontend Dev Server

Open new terminal:
```bash
cd frontend
npm run dev
# Open http://localhost:5173 in browser
```

## Testing Real Workflows

### Test 1: Search Real Place + Map

**User Action**:
1. Click "SEARCH" input
2. Type: `C21 Mall Bhopal` or `SGVU Jaipur` or your local landmark
3. Click SEARCH or press Enter

**Expected Results**:
- ✅ Map centers on location (real coordinates from Nominatim)
- ✅ Location Intelligence panel shows place details
- ✅ Map data badge shows "MAP" (real OSM data)
- ✅ 3 exit markers appear on map (from Overpass entrances/gates)
- ✅ Route lines drawn in green/yellow/red by safety score
- ✅ Building circles show surrounding structures
- ✅ Emergency resources panel shows nearby hospitals/fire/police
- ✅ AI analysis loads with risk score and recommendations
- ✅ Status shows "✓ Emergency analysis complete"

### Test 2: Photo Upload + Vision Analysis

**User Action**:
1. After searching a place, click "📸 Upload place photo"
2. Select an image file (building, interior, parking lot, etc.)
3. Wait for "Photo analysis complete" message

**Expected Results**:
- ✅ Photo displays as thumbnail
- ✅ AI analyzes visible elements (doors, exits, people, smoke, etc.)
- ✅ Image tab shows in map area
- ✅ AI analysis updates with photo insights
- ✅ Confidence scores on vision results
- ✅ Data source shows "IMAGE_ANALYSIS"

### Test 3: Occupancy Status

**Current Behavior** (Real System):
- After search: Occupancy panel shows "UNAVAILABLE"
- This is CORRECT - no fake "24 people" anymore

**Future Integration**:
- Option 1: Upload CCTV video → AI counts visible people
- Option 2: Enter sensor reading manually
- Option 3: Connect to building API

### Test 4: Hazard Tracking

**User Action** (via photo):
1. Upload photo with visible fire/smoke
2. Wait for AI analysis
3. Or manually trigger hazard (advanced)

**Expected Results**:
- ✅ Hazard panel updates with detected hazard
- ✅ Type, severity, confidence shown
- ✅ Red hazard zone circle appears on map
- ✅ Routes automatically recalculate
- ✅ Blocked exit marked with ✗
- ✅ Alternative routes highlighted

### Test 5: Ask AI Assistant

**User Action**:
1. Ensure place is searched
2. Type question: "Which exit should we use?" or "Why is exit B dangerous?"
3. Click ASK AI or press Enter

**Expected Results**:
- ✅ AI responds based on current state (place, routes, hazards, occupancy)
- ✅ Answer references actual data from location
- ✅ Shows confidence in analysis
- ✅ Cites data sources used

**Test Queries**:
- "Which exit is safest?"
- "How far is Exit A?"
- "Where should we gather?"
- "What's the most dangerous exit?"
- "How many exits available?"

### Test 6: No Fake Data Policy

**Verification**:
1. Search any place
2. Check Occupancy Status panel → Should show "UNAVAILABLE" (not fake "24")
3. Check Hazard Panel → Only shows real detected hazards (not fake fire)
4. Check Exit Routes → Real distances from OSRM routing
5. All panels have source badges

### Test 7: Layer Controls

**User Action**:
Uncheck/check layer options:
- Routes (green/yellow/red evacuation paths)
- Exits (blue door markers)
- Buildings (light blue circles)

**Expected Results**:
- ✅ Layers toggle on/off correctly
- ✅ Map updates instantly
- ✅ Layers render only when checked

### Test 8: Emergency Simulation

**Keep Existing Simulation**:
1. Simulation grid still works in Dashboard
2. Agents still evacuate with A* pathfinding
3. Separate from real analysis (not fake data)
4. Fire zone, safe zones, grid visualization unchanged

**User Action**:
1. Click "START EVACUATION" button
2. Watch agents move in grid toward exits
3. Timer counts up
4. Dashboard stats update

**Expected Results**:
- ✅ Simulation runs independently
- ✅ Grid and real map coexist
- ✅ Labeled as SIMULATION (not real data)
- ✅ Routes and exits show in both systems

## Troubleshooting

### Issue: "Location service unavailable"
- Check internet connection
- Nominatim API might be rate-limited
- Try a different place name
- Wait a few seconds, try again

### Issue: "AI analysis temporarily unavailable"
- Verify OPENAI_API_KEY is set in `.env`
- Check API key is correct and has credits
- Backend server must be running (`npm run server`)
- Check browser dev console for API errors

### Issue: "Route unavailable"
- Place might be in unmapped area
- OSRM might not have routing data
- Fallback simulated routes shown
- Try a major city location

### Issue: Map doesn't load
- Check Leaflet tiles loading (look for OSM copyright)
- Backend must be running
- Vite proxy must work (http://localhost:5173 dev server)
- Clear browser cache and reload

### Issue: Build fails
```bash
npm run lint
npm run build
```

### Issue: New services not found
- Ensure all new files exist in `src/services/`
- Check EvacuationMap imports all services
- Clear `node_modules/` and run `npm install`

## Validation Checklist

Before deploying:
```bash
# Terminal 1: Backend
npm run server
# Should print: "EVACAI AI server running on http://localhost:8787"

# Terminal 2: Frontend
npm run dev
# Should open browser to http://localhost:5173

# Terminal 3: Validation
npm run lint   # Should pass with no errors
npm run build  # Should generate dist/ folder
```

## Data Sources Reference

When you see these badges, know they mean:

| Badge | Color | Meaning | Trustworthiness |
|-------|-------|---------|-----------------|
| MAP | Blue | Real OpenStreetMap data | ✅ High |
| ROUTING | Blue | Real OSRM calculated distances | ✅ High |
| AI EST | Brown | AI analysis of provided data | ⚠️ Medium |
| CAMERA | Green | Video/CCTV analysis | ✅ High |
| SENSOR | Green | Occupancy/traffic sensor | ✅ High |
| SIM | Purple | Simulated/demo data | ⚠️ Demo only |
| USER | Yellow | Manually entered data | ⚠️ Depends on user |
| N/A | Red | No data available | ❌ Unavailable |

## Key Differences from Old System

**Before**: 
- Fake "24 People Inside"
- Hardcoded simulated fire zone
- No data source tracking
- AI analyzed only on request

**Now**:
- Real occupancy or "UNAVAILABLE"
- Real hazards from images/sensors only
- All data source-tagged with confidence
- AI analyzes automatically on place search
- Transparent risk calculation

## Next Steps After Testing

1. **Test with Real Data**:
   - Use your own place/building
   - Upload real photos
   - Integrate real CCTV/sensors if available

2. **For 3D Map**:
   - Decide: Mapbox GL (paid) vs Cesium (free) vs deck.gl (free)
   - Implement 3D building visualization

3. **For Video Analysis**:
   - Upload CCTV stream
   - AI counts visible people automatically
   - Updates occupancy in real-time

4. **Production Deployment**:
   - Set real OPENAI_API_KEY
   - Deploy backend (Node.js server)
   - Deploy frontend (Vite build → static hosting)
   - Monitor API costs

---

**Remember**: This system prioritizes ACCURACY over appearance. 
If data is unavailable, it says so clearly rather than inventing data.
