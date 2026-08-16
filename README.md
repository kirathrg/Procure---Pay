# Procure to Pay

A full-cycle procurement system: a conversational chatbot turns a plain-language
request into a purchase order, goods receipts are verified by scanning a QR
code, invoices are read automatically from an uploaded photo, and a 3-way
match (PO vs. receipt vs. invoice) auto-approves or escalates each order
before a manager releases payment.

**Live:** [procure-pay.vercel.app](https://procure-pay.vercel.app) · backend on Render

## How it works

```
Requisition (chat)  →  PO created  →  Sourcing
                                          ↓
                                      Receiving  →  Invoicing
                                          ↓             ↓
                                       3-Way Match (automatic)
                                          ↓
                                 Route to payment  →  Manager approval  →  Paid
```

1. **Requisition** — a user describes what they need in a chat interface
   ("need 30 ergonomic chairs by next week, urgent"). A hosted LLM extracts
   the item, quantity, deadline, and urgency; the system asks whatever's
   still missing using a fixed set of questions, then confirms.
2. **PO creation** — the item is fuzzy-matched to a real catalog product,
   suppliers are ranked by price (plain code, not AI), and a purchase order
   is created automatically.
3. **Receiving** — a QR code is scanned (live camera or an uploaded photo,
   decoded entirely in the browser) to confirm the right goods arrived in
   the right quantity.
4. **Invoicing** — an invoice photo is uploaded and OCR'd to extract the
   vendor, quantity, unit price, and total, with a bounding box drawn over
   each field it found.
5. **3-Way Match** — the moment both a receipt and an invoice exist, the PO,
   receipt, and invoice are compared field by field. A clean match
   auto-approves; a mismatch is flagged for review.
6. **Payment** — a manager (a separate, role-gated login) reviews and
   releases payment through a real Razorpay test-mode checkout.

A warehouse-employee portal lets non-procurement staff file a request that a
procurement lead can approve into the same pipeline.

## Where the AI is (and isn't)

Every number in this app is computed in plain Python or SQL — fuzzy item
matching, supplier ranking, the 3-way match comparison, and anomaly
detection are all deterministic. The LLM is called only to phrase a sentence
around a fact that's already been computed, never to produce the fact
itself. OCR and speech-to-text are separate, purpose-built hosted models —
neither goes through the LLM.

| Task | How |
|---|---|
| Chat slot extraction, narrative text (match reasons, supplier picks) | [Groq](https://groq.com) — hosted LLM |
| Invoice field extraction | [OCR.space](https://ocr.space) — hosted OCR |
| Voice input transcription | [Deepgram](https://deepgram.com) Nova-3 |
| QR code decoding (Receiving) | Entirely client-side in the browser — no image is ever sent to the server for this |
| Item matching, supplier ranking, 3-way match, anomaly detection | Plain Python / SQL — no model involved |

## Stack

**Backend** — FastAPI (Python, async throughout), SQLAlchemy + Alembic,
deployed on Render.

**Frontend** — React 19 + Vite + TypeScript, TanStack Query for server
state, Zustand for auth/UI state, Tailwind CSS, deployed on Vercel.

**Data** — Supabase: Postgres (14 tables), Auth (JWT-based), and Storage
(receipt/invoice images).

**External services** — Groq (LLM), OCR.space (invoice OCR), Deepgram
(speech-to-text), Razorpay (payments, test mode), Resend (emailing POs to
suppliers).

Nothing in the backend requires a GPU or a local model — every AI/ML
capability is a hosted API call, which is what makes it deployable on a
free-tier host.

## Project layout

```
backend/            FastAPI app
  app/
    routers/         one file per resource (requisition, purchase_orders, receiving, invoicing, matching, manager, ...)
    services/        business logic (gemini.py = the LLM wrapper, ocr.py, matching.py, anomaly_detection.py, ...)
    models/          SQLAlchemy models — the source of truth for the DB schema
    schemas/         Pydantic request/response models
  alembic/versions/   migration history

p2p-frontend/        React app
  src/
    pages/            one file per screen
    hooks/             TanStack Query hooks — the data layer between pages and the API
    components/        shared UI (Badge, Button, Modal, layout shell)
    store/             Zustand store (auth/session state only — server data lives in React Query)
    lib/               api client, Supabase client, small utilities
```

## Running it locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in your Supabase project + API keys
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd p2p-frontend
npm install
cp .env.example .env          # point at the backend above + the same Supabase project
npm run dev
```

The frontend expects the backend at `VITE_API_BASE_URL` (default
`http://localhost:8000`) and talks to Supabase Auth directly for
login/signup — the backend only ever verifies the resulting JWT, it never
handles passwords itself.

### Getting API keys

Every external service below has a free tier that comfortably covers this
app's usage (a handful of short calls per requisition, never bulk or
scheduled):

- **Supabase** — [supabase.com](https://supabase.com), create a project, then
  copy the URL/keys from Project Settings → API, and the connection string
  from Project Settings → Database.
- **Groq** — [console.groq.com/keys](https://console.groq.com/keys)
- **Deepgram** — [console.deepgram.com](https://console.deepgram.com)
- **OCR.space** — [ocr.space/ocrapi](https://ocr.space/ocrapi)
- **Resend** (optional — only needed for "email PO to supplier") —
  [resend.com/api-keys](https://resend.com/api-keys)
- **Razorpay** (optional — only needed for the manager payment flow, test
  mode) — [dashboard.razorpay.com/app/keys](https://dashboard.razorpay.com/app/keys)

## Deployment

- **Backend** on Render: root directory `backend`, build command
  `pip install -r requirements.txt`, start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add every key from
  `backend/.env.example` as an environment variable, plus `CORS_ORIGINS`
  set to your deployed frontend's URL.
- **Frontend** on Vercel: root directory `p2p-frontend`, framework preset
  Vite. `p2p-frontend/vercel.json` rewrites every path to `index.html`,
  which is required for client-side routing to survive a direct page load
  or refresh.
