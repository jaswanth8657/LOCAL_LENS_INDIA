# LOCAL LENS INDIA — LOCAL DEMONSTRATION GUIDE

**Tagline:** *Experience Like a Local.*  
**Domain:** AI-Powered Personalized Travel Discovery Platform  
**Target Environment:** Localhost (`127.0.0.1` / `localhost`)  
**Database:** SQLite (`backend/db.sqlite3`)  
**AI Stack:** Google Gemini 2.5 Flash $\rightarrow$ Local Ollama Models (`gemma3:4b`, `qwen2.5:3b`) $\rightarrow$ Deterministic Local Planner  

---

## 1. PREREQUISITES & SYSTEM REQUIREMENTS

Before starting the application, ensure the following runtimes and tools are installed on your machine:

- **Python:** Version `3.10` or higher (`3.14.5` verified).
- **Node.js:** Version `18.0` or higher (`v24.15.0` verified).
- **npm:** Version `9.0` or higher (`11.14.1` verified).
- **SQLite3:** Built into standard Python distributions.
- **Git:** Standard git client for repository management.

---

## 2. ENVIRONMENT CONFIGURATION

1. Navigate to the project root directory:
   ```powershell
   cd C:\Users\91728\Downloads\LOCAL_LENS_INDIA
   ```
2. Verify that your `.env` file exists in the project root. If setting up for the first time, copy the template:
   ```powershell
   copy .env.example .env
   ```
3. Set your environment variables in `.env` (backend reads from project root):
   - `GEMINI_API_KEY`: Your Google AI Studio Gemini API key.
   - `OPENTRIPMAP_API_KEY`: OpenTripMap API key (optional, enhances tourist attraction data).
   - `GEOAPIFY_API_KEY`: Geoapify API key (optional, enhances geocoding/places).
   - `DJANGO_SECRET_KEY`: Django secret key for local development.
   - `DEBUG`: Set to `True`.

> **Security Notice:** Never commit `.env` or share actual API credentials in public repositories or demo screenshots.

---

## 3. HOW TO START THE APPLICATION

LOCAL LENS INDIA consists of a Django REST Framework backend and a React (Vite + TypeScript) frontend. Run both servers in separate terminal windows.

### Terminal 1 — Django Backend

```powershell
cd C:\Users\91728\Downloads\LOCAL_LENS_INDIA\backend

# Activate virtual environment if configured, then run:
python manage.py runserver 127.0.0.1:8000
```
- The backend will start on **`http://127.0.0.1:8000/`**.
- OpenAPI Schema: `http://127.0.0.1:8000/api/v1/schema/`
- Interactive Swagger UI: **`http://127.0.0.1:8000/api/v1/docs/`**

### Terminal 2 — React Frontend

```powershell
cd C:\Users\91728\Downloads\LOCAL_LENS_INDIA\frontend

# Start Vite development server:
npm run dev
```
- The frontend will launch at **`http://localhost:5173/`**.

---

## 4. HOW TO VERIFY AI & DATA PROVIDER STATUS

You can inspect provider health without exposing sensitive keys:

1. **Via Browser / API Check:**
   Open: `http://127.0.0.1:8000/api/v1/ai/status/`
   
   Response format:
   ```json
   {
     "gemini": {
       "name": "GEMINI",
       "available": true,
       "model": "gemini-2.5-flash",
       "message": "Configured and active"
     },
     "ollama": {
       "name": "OLLAMA",
       "available": false,
       "model": "gemma3:4b",
       "message": "Ollama daemon offline"
     },
     "deterministic": {
       "name": "DETERMINISTIC",
       "available": true,
       "model": "rule-based-v2",
       "message": "Deterministic database-grounded engine ready"
     }
   }
   ```

2. **How the Multi-Tier Fallback Operates:**
   - **Tier 1 (Cloud AI):** Google Gemini generates personalized, context-aware narratives and itineraries.
   - **Tier 2 (Local LLM):** If Gemini encounters network failure or quota exhaustion (HTTP 429/503), the system tries local Ollama (`gemma3:4b`, fallback `qwen2.5:3b`).
   - **Tier 3 (Deterministic Engine):** If Ollama is offline or inactive, the deterministic travel planner synthesizes a structured, fact-grounded itinerary from verified candidate places. The app never crashes or returns an empty itinerary.

---

## 5. HYDERABAD COMPLETE DEMO JOURNEY

Use Hyderabad as an unseeded city to showcase the live external discovery pipeline:

1. **Step 1: Homepage Search**
   - Open `http://localhost:5173/`.
   - Enter `Hyderabad` in the search box and press **Enter** (or click **Explore**).
2. **Step 2: Discover Live Attractions**
   - On the Discover page, click the **Live Place & Attraction Discovery** tab.
   - Live attractions (e.g. *Charminar*, *Wazu Khana*, *Golconda Fort*) appear with live badges.
   - Notice the provenance label (*Live external search result*), exact coordinates, and Wikimedia Commons photographs with author and CC BY license links.
   - Notice that unverified fees display *"Fee unavailable"*—no fabricated costs.
3. **Step 3: Preference Selection**
   - Navigate to **Recommendations** or use the homepage builder.
   - Select destination **Hyderabad**, budget **₹3,000/day**, duration **2 Days**, group **Solo**, and interests **Culture & Heritage**.
4. **Step 4: AI Itinerary Generation**
   - Navigate to **AI Planner** (`/planner`).
   - Click **Generate Daily Itinerary**.
   - Review the 2-day daily schedule: morning, afternoon, and evening slots with transit notes.
5. **Step 5: Budget & Expense Breakdown**
   - Review the transparent budget cards: accommodation, food & dining, local transport, and contingency buffer.
6. **Step 6: Saving & Persistence**
   - Click **Save Itinerary**.
   - If signed in as `audit_test_user`, the trip saves to SQLite.
   - If browsing as a guest, choose **Continue as Guest** or sign in.
7. **Step 7: Saved Trips & Refresh**
   - Navigate to **Saved Trips** (`/saved`).
   - The saved itinerary card appears with day count, budget, and destination tags.
   - Click **Open Full Itinerary** to reload the complete trip.
   - Refresh the browser page (`F5`) to confirm that all days, stops, and budgets persist intact.

---

## 6. GUEST BROWSING & AUTHENTICATION DEMO

- **Guest Experience:**
  - Guests have full, unrestricted access to discover destinations, search live places, explore maps, adjust preferences, ask questions in the AI Chatbot, and generate itineraries.
  - When a guest attempts to save an itinerary, an elegant modal presents options: Sign In, Register, or Continue as Guest.
- **Authenticated User Isolation:**
  - Existing audit test account: `username: audit_test_user` | `email: audit@locallens.in`
  - Strict ownership rules ensure that User A can never view or modify User B's saved itineraries or expense breakdowns.

---

## 7. VOICE INPUT CAPABILITIES

- **Scope:** Voice input is integrated exclusively in the AI Chatbot (`/chat` and floating widget) via the browser Web Speech API.
- **Language Support:** English (India) `en-IN` and Hindi `hi-IN`.
- **Text-Only Responses:** To prevent hallucinated voice synthesis, speech output, text-to-speech, and audio playback are strictly disabled. Recognized speech populates an editable text box for user confirmation before sending.

---

## 8. KNOWN LIMITATIONS & NOTES

1. **Public Overpass Node Latency:**
   Live searches for unseeded cities query public OpenStreetMap Overpass API nodes, which can take 20–35 seconds during high-load periods. Resilient timeout handlers prevent freezing and fall back gracefully.
2. **Third-Party Rate Limits:**
   If Geoapify or OpenTripMap reach monthly free tier quotas, the backend automatically isolates the provider and serves factual data from OpenStreetMap and SQLite.
3. **Local Database Latency Fix:**
   Local database searches (`live=False`) execute in under **20 milliseconds** without synchronous external calls.

---

## 9. HOW TO STOP THE SERVERS

When your demonstration is complete:
1. In the backend terminal, press **`Ctrl + C`** to stop Django.
2. In the frontend terminal, press **`Ctrl + C`** (or type `q`) to stop Vite.
3. Database records remain permanently preserved in `backend/db.sqlite3`.

