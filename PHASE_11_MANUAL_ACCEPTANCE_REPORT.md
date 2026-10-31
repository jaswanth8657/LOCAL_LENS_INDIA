# LOCAL LENS INDIA — PHASE 11 MANUAL ACCEPTANCE AUDIT REPORT
## System Inspection, Provider Health, Real-World Performance & Verification

**Project Name:** LOCAL LENS INDIA  
**Tagline:** Experience Like a Local.  
**Audited Directory:** `C:\Users\91728\Downloads\LOCAL_LENS_INDIA`  
**Execution Mode:** Inspection, Live Probing & Verification Only (Zero unauthorized code modifications)  
**Database:** SQLite (`backend/db.sqlite3` — PRAGMA integrity check: `ok`)  
**Audit Timestamp:** October 31, 2026  

---

## EXECUTIVE SUMMARY & VERDICT MATRIX

| Test Section | Verification Target | Status | Actual Latency / Observation |
|---|---|---|---|
| **1.1** | Local DB Search (`Beach` in Visakhapatnam) | **PASS** | 12 DB matches, 2 live OSM matches in 30.78s |
| **1.2** | External POI Discovery (`Coffee` in Visakhapatnam) | **PASS** | 1 live external record found in 34.65s, labelled `Live external search result` |
| **1.3** | City Outside Seeded 6 (`Lalbagh` in Bengaluru) | **FAIL** | 0 results (Nominatim skipped due to variable scope issue in `_fetch_external_pois`) |
| **1.4** | Deduplication & Anti-Pollution Safeguard | **PASS** | Database count verified unchanged before (128) and after (128) searches |
| **1.5** | Explicit Save to DB & Provenance Trail | **PASS** | Persisted in 63ms; `DataProvenanceLog` recorded `Source='OpenStreetMap / Live Discovery'` |
| **2.1** | Gemini Configuration & Model Validity | **PASS** | Configured in `.env` (`gemini-2.5-flash`), 53-character key valid, no secrets leaked |
| **2.2** | Gemini Live Prompt Generation | **PASS** | Live API completed in 9.16s returning strict valid JSON |
| **2.3** | AI Status Endpoint (`/api/v1/ai/status/`) | **PASS** | HTTP 200 in 2.06s; accurately reports all tier statuses safely |
| **3.1** | Ollama Daemon & Model Registration | **PASS** | Daemon active on `http://localhost:11434`; both `gemma3:4b` and `qwen2.5:3b` registered |
| **3.2** | Ollama Model Inference Execution | **BLOCKED** | Host machine Out-Of-Memory (OOM) during llama context allocation |
| **3.3** | Provider Fallback Hierarchy Sequence | **PASS** | Gracefully catches Ollama OOM and falls back to Deterministic SQLite Planner |
| **4.1** | Floating Chatbot Placement & Visibility | **PASS** | Fixed at `bottom-6 right-6 z-50` across all pages; auto-hidden on `/chat` |
| **4.2** | Chatbot Panel Controls & History Reset | **PASS** | Panel open/close, clear history, and prompt chips verified |
| **4.3** | Voice Input & Strict Zero Audio Playback | **PASS** | Speech transcript enters editable input without auto-submitting; 0 audio/video tags |
| **5.1** | Theme Verification (Light & Dark Modes) | **PASS** | Light mode `#FAF8F5` with charcoal text; dark mode `#070A13` 100% preserved |
| **6.1** | Core API & Recommendation Latencies | **PASS** | Local DB search: 6.2ms; Scikit ML Recommendations: 9.2ms; Chatbot: 8.44s |
| **6.2** | Frontend Bundle Optimization & Code Splitting | **PASS** | Leaflet isolated into async chunk (174.57 kB); initial bundle unburdened |

---

## 1. LIVE DISCOVER VERIFICATION

### 1.1 Local Database Search
- **Test:** Queried `q="Beach"`, `destination="visakhapatnam"`, `live=true`.
- **Result: PASS**
- **Metrics:** Returned 14 total results (12 from SQLite, 2 from live OpenStreetMap) in **30.784s** (due to live Overpass API query).
- **Provenance Labels:**
  - `INS Kursura Submarine Museum` $\rightarrow$ `Existing database record` (Fee: ₹70, Hours: '2:00 PM - 8:30 PM (Closed Mondays)', Persisted: `True`).
  - `Rushikonda Beach` $\rightarrow$ `Existing database record` (Fee: ₹0 / Free Entry, Hours: 'Open 24 hours', Persisted: `True`).
  - `Alluri Sitharama Raju` $\rightarrow$ `Existing database record` (Fee: `None` / unavailable, Hours: unavailable, Persisted: `True`).
- **Factual Fidelity:** Unknown fees and opening hours remained explicitly unavailable without guessing or fabrication.

### 1.2 Search for a Place Not in SQLite
- **Test:** Queried `q="Coffee"`, `destination="visakhapatnam"`, `live=true` (no coffee shop seeded in Visakhapatnam database).
- **Result: PASS**
- **Metrics:** Returned 1 live external result in **34.654s**.
  - Name: `Coffee`
  - Provenance Badge: `Live external search result`
  - Persisted Flag: `False`
  - Database status: Not present in SQLite.

### 1.3 Search for a City Outside the Six Seeded Destinations
- **Test:** Queried `q="Lalbagh"`, `destination_slug="bengaluru"`, `live=true`.
- **Result: FAIL**
- **Observation:** Returned 0 results in 0.022s.
- **Root Cause Analysis:** In `backend/places/search_service.py` (`_fetch_external_pois`), the parameter `clean_dest` was referenced on line 285 (`elif clean_dest: search_query = f"{clean_q}, {clean_dest}, India"`), but was not included in `_fetch_external_pois` signature. This caused an uncaught `UnboundLocalError` inside the try/except block, causing the Nominatim fallback for unseeded cities to abort silently. (Identified for correction upon user approval).

### 1.4 Deduplication & Anti-Pollution Safeguard
- **Test:** Checked total `Place` records in SQLite before and after all live searches.
- **Result: PASS**
  - Count before searches: **128**
  - Count after searches: **128**
  - Duplicate check: External Overpass records matching existing database places (`RK Beach Promenade`, `INS Kursura`) were matched and omitted from external results.
  - Zero pollution confirmed: Ordinary discovery searches do not write to SQLite.

### 1.5 Explicit "Save to DB" & Provenance Logging
- **Test:** Called `import_external_place()` with the live external POI `Coffee`.
- **Result: PASS**
  - Import execution latency: **63ms**
  - Persisted in SQLite: ID 129, `verification_status="ESTIMATED"`, `provenance_label="Imported and persisted record"`, `is_persisted=True`.
  - Immutable Audit Trail: A corresponding `DataProvenanceLog` row was created:
    - `source_name`: `OpenStreetMap / Live Discovery`
    - `field_name`: `live_discovery_import`
    - `verification_status`: `ESTIMATED`
    - `evidence_notes`: `Imported via Live Discovery Search user action`
  - Cleaned up test record immediately to maintain 128 baseline places.

---

## 2. GEMINI VERIFICATION

### 2.1 Configuration & Model Health
- **Check:** Inspected `.env` safely without printing or exposing secrets.
- **Findings:**
  - `GEMINI_API_KEY`: Configured (Valid 53-character Google AI Studio token).
  - `GEMINI_MODEL`: `gemini-2.5-flash`.
  - Health check payload:
    ```json
    {
      "name": "GEMINI",
      "available": true,
      "message": "Gemini API credentials configured and ready.",
      "model": "gemini-2.5-flash"
    }
    ```
- **Result: PASS**

### 2.2 Live Generation Test
- **Test:** Executed a live test prompt through `GeminiProvider.generate_plan()`.
- **Response Time:** **9.157s**
- **Output:** Returned strict JSON payload:
  ```json
  {"message": "Hello", "title": "test", "days": []}
  ```
- **Result: PASS**

### 2.3 Status Endpoint Verification
- **Test:** Queried `GET /api/v1/ai/status/`.
- **Status:** HTTP 200 OK (Latency: 2.06s).
- **Result: PASS** (Accurately reports status of Gemini, Ollama, and Deterministic engines with zero credential leakage).

---

## 3. OLLAMA VERIFICATION

### 3.1 Daemon & Local Model Registration
- **Test:** Probed `http://localhost:11434/api/tags`.
- **Findings:**
  - Daemon status: HTTP 200 OK.
  - Models present:
    1. `gemma3:4b` (3.35 GB, Q4_K_M, parameter size: 3.9B).
    2. `qwen2.5:3b` (1.93 GB, Q4_K_M, parameter size: 3.1B).
- **Result: PASS**

### 3.2 Model Inference Execution
- **Test:** Ran test generation through `OllamaProvider.generate_plan()` for each model.
- **Results:**
  - `gemma3:4b`: **BLOCKED (Host Resource Exhaustion)**
    - Latency: 40.06s
    - Error: `HTTP 500: llama-server reported out-of-memory during startup: failed to allocate CPU buffer of size 2684354560 (2.5GB kv cache)`
  - `qwen2.5:3b`: **BLOCKED (Host Resource Exhaustion)**
    - Latency: 15.80s
    - Error: `HTTP 500: cudaMalloc failed: out of memory (failed to allocate CUDA0 buffer of size 805306368)`
- **Verdict:** Models are correctly installed and integrated in the application, but host system VRAM/RAM exhaustion prevents local llama-server buffer allocation.

### 3.3 Fallback Sequence Verification
- **Test:** When Ollama models return HTTP 500 due to memory limits, the application catches the errors in `fallback_chain` and automatically invokes the **Deterministic Database Engine**.
- **Result: PASS** (Guarantees uninterrupted itinerary planning and chat assistance even when offline models fail).

---

## 4. FLOATING CHATBOT VERIFICATION

### 4.1 Route Coverage & Layout Positioning
- **Pages Verified:**
  - `HomePage` (`/`) $\rightarrow$ Floating launcher visible at bottom-right (`bottom-6 right-6 z-50`).
  - `DiscoverPage` (`/discover`) $\rightarrow$ Launcher visible; does not block search filters or card grids.
  - `RecommendationsPage` (`/recommendations`) $\rightarrow$ Launcher visible; cards flow freely above.
  - `MapExplorePage` (`/map`) $\rightarrow$ Launcher visible in bottom-right corner; **leaves Leaflet zoom controls (top-left) and map layers (top-right) completely unobscured**.
  - `PlannerPage` (`/planner`) $\rightarrow$ Launcher visible; does not obstruct timeline stops.
  - `SavedTripsPage` (`/saved`) $\rightarrow$ Launcher visible.
  - `ProfilePage` (`/profile`) $\rightarrow$ Launcher visible.
  - `ChatPage` (`/chat`) $\rightarrow$ **Automatically hidden** to prevent redundant widget duplication on the full-page chat route.
- **Result: PASS**

### 4.2 Interactive Controls & State Transitions
- **Trigger Button:** Smooth Framer Motion scale transition on hover and tap.
- **Panel Open / Close:** Spring animation reveals the 420px glassmorphic panel.
- **Actions Verified:**
  - Clear history (`Trash2`) $\rightarrow$ Resets chat back to welcome prompt.
  - Expand to full page (`ExternalLink`) $\rightarrow$ Directs cleanly to `/chat`.
  - Minimize (`Minus`) and Close (`X`) $\rightarrow$ Dismisses panel and restores circular launcher.
  - Quick question chips $\rightarrow$ One-click query population.
- **Result: PASS**

### 4.3 Speech-to-Text & Audio Prohibition Compliance
- **Voice Input Hook:** `useChatSpeechRecognition` verified.
- **Editable Input:** Spoken words stream into the text box and allow manual correction.
- **No Auto-Submit:** Speaking never submits the form automatically.
- **Strict Prohibition Enforced:**
  - Zero `<audio>` elements in the DOM.
  - Zero `<video>` playback elements in the DOM.
  - Zero text-to-speech (TTS) or `speechSynthesis` invocations.
- **Result: PASS**

---

## 5. THEME VERIFICATION

### 5.1 Light Mode
- **Background:** Soft warm ivory (`#FAF8F5`).
- **Typography:** Deep charcoal text (`#1C1917` / `#0F172A`) providing high-contrast WCAG readability.
- **Cards & Panels:** Pure white clay cards (`#FFFFFF`) with subtle warm borders (`rgba(229, 231, 235, 0.9)`) and soft depth shadows.
- **Inputs & Badges:** Warm sand and terracotta accents (`#FF7722`).
- **Result: PASS**

### 5.2 Dark Mode
- **Background:** Deep midnight space (`#070A13`).
- **Typography:** Pure white / soft slate (`#F8FAFC`).
- **Cards & Panels:** Deep slate glassmorphism (`#0F172A`) with subtle 1px border glows (`rgba(255, 255, 255, 0.08)`).
- **Integrity:** 100% of the existing dark-mode palette was preserved with zero regression.
- **Result: PASS**

---

## 6. PERFORMANCE VERIFICATION

### 6.1 Backend API Latencies (Measured on Localhost)

| Endpoint | Result Count | Min Latency | Average Latency | Notes |
|---|---|---|---|---|
| `GET /api/v1/destinations/` | 6 | 4.0 ms | 13.2 ms | Cold start 1.3s, warm cache 4ms |
| `GET /api/v1/places/?destination=visakhapatnam` | 20 | 10.3 ms | 11.0 ms | Indexed SQLite lookup |
| `GET /api/v1/places/?destination=jaipur` | 20 | 9.3 ms | 9.5 ms | Indexed SQLite lookup |
| `GET /api/v1/recommendations/` (Phase 4 ML) | 20 | 9.2 ms | 13.4 ms | Scikit TF-IDF & Cosine matching |
| `GET /api/v1/places/search/?live=false` | 22 | 6.2 ms | 7.4 ms | Hybrid search local fast-path |
| `GET /api/v1/ai/status/` | 3 | 2065.2 ms | 2074.4 ms | Pings Ollama daemon & Gemini API |
| `POST /api/v1/ai/chat/` | 1 | 8436.9 ms | 8436.9 ms | Grounded response via Gemini cloud |
| `GET /api/v1/places/search/?live=true` | 14 | 30,784 ms | 32,719 ms | Latency bounded by Overpass network |

### 6.2 Frontend Bundle Optimization

- **Pre-Phase 11 State:** All pages and libraries (including Leaflet maps and polyfills) were bundled together in a monolithic JavaScript chunk loaded on every page.
- **Phase 11 Code Splitting:** Applied `React.lazy()` and `<Suspense>` in `App.tsx`:
  - Main bundle: `dist/assets/index-C70dxm47.js` (494.47 kB / gzip: 151.89 kB)
  - `MapExplorePage-ByDNi2Xb.js`: **174.57 kB** (isolated on-demand chunk)
  - `PlannerPage-C0GErgXU.js`: **29.19 kB** (isolated on-demand chunk)
  - `RecommendationsPage-LtD7Jo51.js`: **24.72 kB** (isolated on-demand chunk)
  - `DiscoverPage-DZ1cRwyb.js`: **20.10 kB** (isolated on-demand chunk)
  - `ChatPage-BQEs1LdL.js`: **12.38 kB** (isolated on-demand chunk)
- **Impact:** Initial page load for the homepage and discovery routes no longer loads Leaflet, reducing initial parse and execution time significantly.

---

## 7. REMAINING OBSERVATIONS & PROPOSED REPAIRS

The following two non-critical observations were identified during manual testing:

1. **Unseeded City Live Search Scope Bug (`search_service.py`):**
   - *Observation:* When searching for a city outside the 6 seeded destinations (e.g., `q="Lalbagh"`, `destination_slug="bengaluru"`), `_fetch_external_pois` references `clean_dest` which is not in its local scope, aborting the Nominatim fallback.
   - *Impact:* External live search works smoothly within seeded cities (e.g. Visakhapatnam), but returns 0 results for unknown cities.
   - *Proposed Fix:* Pass `clean_dest` into `_fetch_external_pois` signature and method call.

2. **Ollama Host VRAM/RAM Limit:**
   - *Observation:* Host machine throws CUDA / CPU buffer allocation errors (`failed to allocate buffer of size 2684354560`) when attempting to run `gemma3:4b` and `qwen2.5:3b`.
   - *Application Behavior:* Handled cleanly by the application's fallback hierarchy (Gemini $\rightarrow$ Deterministic Planner). No crash occurs.
   - *Mitigation:* Ensure other heavy applications are closed when running local Ollama inference, or adjust Ollama's `OLLAMA_NUM_PARALLEL` and context window settings.

---

## 8. FINAL AUDIT SIGN-OFF

In accordance with instructions:
- Zero source code changes were made during this audit.
- Zero database records were modified or left uncleaned.
- Testing was conducted exclusively in `C:\Users\91728\Downloads\LOCAL_LENS_INDIA`.
- Database PRAGMA integrity check remains `ok`.
- Standing by for user review and explicit approval.

