# LOCAL LENS INDIA (LOCAL_LENS_INDIA)
> *Experience Like a Local.*

LOCAL LENS INDIA is a full-stack, AI-driven cultural tourism and travel planning platform designed to generate authentic, culturally rich, and budget-conscious itineraries across India.

---

## 🌟 Architecture & Key Features

- **Frontend:**
  - React 18, Vite, TypeScript, and Tailwind CSS.
  - Custom Claymorphism visual design language supporting dark and light themes.
  - Route-level code splitting with dynamic chunking.
  - Interactive Leaflet-powered destination map explorer and live POI discovery.
  - Floating AI Travel Assistant with speech-to-text input (Web Speech API) and fallback handling.

- **Backend:**
  - Django REST Framework (DRF) with SQLite.
  - Modular domain-driven design: `destinations`, `places`, `trips`, `recommendations`, `accounts`, `ai`, `data_providers`.
  - Machine-learning hybrid recommendation engine (`scikit-learn` content-based similarity + popularity scoring).
  - OpenApi documentation with `drf-spectacular`.

- **Hybrid Live Data Discovery & Verification:**
  - Live external POI discovery via OpenStreetMap Overpass API and Nominatim geocoding.
  - Zero database pollution: live external search results are strictly unpersisted until user confirmation (`Save to DB`).
  - Immutable provenance audit trails (`DataProvenanceLog`).
  - Field-level verification: unverified coordinates, fees, or hours are never fabricated or falsely labeled as officially verified.

- **4-Tier Resilient AI Itinerary Planning:**
  1. **Primary:** Google Gemini API (`gemini-2.5-flash`) structured JSON output.
  2. **Local Fallback 1:** Ollama Local Daemon (`gemma3:4b`).
  3. **Local Fallback 2:** Ollama Fallback Model (`qwen2.5:3b`).
  4. **Guaranteed Fallback:** Deterministic Rule-Based Heuristic Itinerary Planner (zero external dependencies).

---

## 🚀 Local Development Setup

### Prerequisites
- **Python:** 3.10 or higher
- **Node.js:** 18.0 or higher (with npm)
- **Git**

### 1. Repository Setup & Environment Configuration
```bash
# Clone the repository
git clone https://github.com/jaswanth8657/LOCAL_LENS_INDIA.git
cd LOCAL_LENS_INDIA

# Create your local environment configuration from template
cp .env.example .env
```
Edit `.env` to configure your environment variables:
```ini
DEBUG=True
DJANGO_SECRET_KEY=local-lens-india-dev-secret-key-2026-experience-like-a-local
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
AI_REQUEST_TIMEOUT=60
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
OLLAMA_FALLBACK_MODEL=qwen2.5:3b
DATA_CACHE_TTL=86400
```

---

### 2. Backend Setup (Django REST Framework)

```bash
# Navigate to the backend directory
cd backend

# Create and activate a Python virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r ../requirements.txt

# Run database migrations
python manage.py migrate

# (Optional) Verify system health
python manage.py check

# Start development server
python manage.py runserver
```
The Django REST API will run at `http://127.0.0.1:8000/`.  
Interactive API documentation: `http://127.0.0.1:8000/api/schema/swagger-ui/`.

---

### 3. Frontend Setup (React + Vite + TypeScript)

```bash
# In a new terminal, navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend application will run at `http://localhost:5173/`.

---

## 🧪 Testing & Verification

### Run Backend Tests
```bash
cd backend
python manage.py test tests
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

### Run Frontend Production Build & TypeScript Verification
```bash
cd frontend
npm run build
```

---

## 🔒 Security & Data Integrity Safeguards

- **Zero Secret Commits:** `.env`, API keys, private credentials, and local logs are strictly `.gitignore`d.
- **Database Safety:** SQLite database files (`*.sqlite3`, `*.db`) and database backups are never tracked in Git.
- **Deterministic AI Fallback:** The application functions fully offline without external API keys or Ollama models using local database records and the deterministic planner.

