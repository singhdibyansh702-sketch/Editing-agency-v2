# CineFlow Studio - High-End Video Editing Agency Management System (v2.0)

A comprehensive, responsive, multi-currency, and privacy-segregated full-stack web application for managing a high-end Video Editing Agency.

---

## 1. System Architecture & Privacy Segregation

The platform enforces strict privacy and security boundaries across three distinct user roles:

```
┌─────────────────────────────────────────────────────────────┐
│                       ADMIN PORTAL                          │
│        (Central Privacy Intermediary & Agency Owner)        │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
        Encrypted Chat                  Encrypted Chat
        & Quoting Flow                  & Assignment Flow
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│        CLIENT PORTAL         │ │        EDITOR PORTAL        │
│   (Content Creator / Brand)  │ │    (Video Editing Roster)   │
└──────────────────────────────┘ └─────────────────────────────┘
  ❌ CANNOT SEE:                   ❌ CANNOT SEE:
     • Editor identity or name        • Client identity, company
     • Editor email or phone          • Client email, phone
     • Editor payout rates            • Client prices / budgets
     • Agency profit margins          • Agency profit margins
  ❌ NO DIRECT CHAT WITH EDITOR    ❌ NO DIRECT CHAT WITH CLIENT
```

### Critical Security Boundaries
1. **Client Privacy**: Video Editors **NEVER** see client names, emails, phone numbers, company names, payment receipts, or agency profit margins.
2. **Editor Privacy**: Clients **NEVER** see editor names, emails, phone numbers, portfolio links, or payout amounts.
3. **No Direct Client ↔ Editor Communication**:
   - Clients can only communicate directly with the Admin.
   - Editors can only communicate directly with the Admin.
   - Direct messaging between Client and Editor is strictly blocked on both the frontend UI and the backend API (`403 Forbidden`).
4. **Data Sanitization**: Every backend API endpoint passes data through role-based sanitizers (`src/middleware/sanitizer.js`) to purge passwords, phone numbers, contact info, and confidential financials before returning to clients or editors.

---

## 2. Multi-Currency & Negotiation Workflow

The system provides native, dual-currency support throughout all portals:
- **US Dollars ($ USD)**
- **Indian Rupees (₹ INR)**

### Budget & Price Negotiation Rules:
1. **Client Project Request**:
   - Client selects their preferred currency (**$ USD** or **₹ INR**).
   - Enters a **Proposed Budget** (e.g. `₹25,000` or `$600`) with live formatted preview.
   - Status is marked `Pending Approval` and notifies the Admin.
2. **Admin Review & Counter-Quote**:
   - Admin inspects the client's proposed budget in the review modal.
   - Admin can approve as-is or set a counter-negotiated final client price.
   - Admin attaches an optional **Negotiation / Quote Note** (e.g. *"Budget accepted; includes 2 revision rounds and 4K color grade"*).
   - Admin selects and assigns an editor, setting the **Agreed Editor Payout** in the same currency.
3. **Segregated Visibility**:
   - Client sees their negotiated price and admin note; **never** the editor payout.
   - Editor only sees their agreed payout in their currency; **never** client pricing or margins.

---

## 3. Technology Stack

- **Frontend**: Clean, semantic HTML5, Modern CSS3 with CSS variables (Light and Dark high-contrast themes), vanilla ES6+ component-oriented JavaScript, Lucide Icons.
- **Backend**: Node.js + Express.js (Modular REST API, async controllers, input validation, rate limiting, helmet security headers).
- **Database**:
  - **Primary**: MySQL 8.0+ (`schema.sql` with normalized relational schema, foreign keys, UTF8MB4, and cascade integrity).
  - **Embedded Fallback**: SQLite (`data/agency.sqlite`) for instant zero-dependency local development if MySQL server is offline.
- **Authentication**: Secure HTTP-only cookies with signed JWT, bcrypt password hashing, and role-based authorization middleware.
- **Video Analysis Microservice**: Python 3.10+ FastAPI microservice (`video_service.py`) with `ffmpeg-python` for automated duration, resolution, frame rate, codec, and 3 keyframe thumbnail previews (at 10%, 50%, and 80% marks).

---

## 4. Directory Structure

```
├── schema.sql                      # Production MySQL 8.0 DDL specification
├── schema_sqlite.sql               # Embedded SQLite schema (identical tables & constraints)
├── video_service.py                # Python FastAPI video analysis microservice
├── server.js                       # Express application server entrypoint
├── test_system.js                  # Automated 39-point test suite (unit + integration)
├── package.json                    # Project dependencies & scripts
├── .env.example                    # Environment variable template
├── .env                            # Active environment configuration
├── src/
│   ├── config/                     # Configuration loader
│   ├── db/
│   │   ├── index.js                # Dual database manager (MySQL & SQLite fallback)
│   │   └── seed.js                 # Realistic demo data seeder
│   ├── middleware/
│   │   ├── auth.js                 # Role authorization & session verification
│   │   ├── sanitizer.js            # Role-based data sanitizer & privacy shield
│   │   ├── rateLimiter.js          # Express rate limiter
│   │   └── errorHandler.js         # Centralized error handler
│   ├── controllers/
│   │   ├── authController.js       # Login, session check, demo switcher
│   │   ├── userController.js       # Client & Editor CRUD and profile management
│   │   ├── projectController.js    # Lifecycle, quotes, submissions, reviews, deliveries
│   │   ├── financeController.js    # Ledger, multi-currency balances, payment records
│   │   ├── chatController.js       # Segregated messaging & privacy firewall
│   │   ├── notificationController.js# User notifications & unread counts
│   │   ├── auditController.js      # Chronological audit logs
│   │   └── videoController.js      # Video metadata inspection
│   └── routes/                     # REST API route definitions
└── public/
    ├── index.html                  # Single Page Application container
    ├── css/
    │   └── styles.css              # Custom CSS design system (Dark & Light themes)
    └── js/
        ├── api.js                  # Unified API client
        ├── state.js                # Global state & formatters
        ├── components/
        │   ├── toast.js            # Non-blocking toast alerts
        │   └── modal.js            # Accessible modal dialogs
        ├── portals/
        │   ├── adminPortal.js      # Admin dashboard, clients, editors, projects, ledger
        │   ├── editorPortal.js     # Editor dashboard, assigned projects, cut submission
        │   ├── clientPortal.js     # Client dashboard, request builder, master downloads
        │   ├── chatView.js         # Segregated agency chat
        │   └── videoInspectorView.js# Video metadata and keyframe visualizer
        └── app.js                  # Router, theme toggle, demo switcher
```

---

## 5. Demo Seed Accounts

The system automatically seeds realistic demo data on startup:

| Role | Name | Email | Password | Details |
|---|---|---|---|---|
| **ADMIN** | Alex Vance | `admin@videoagency.com` | `AdminPassword123!` | Agency Owner (Full Authority) |
| **EDITOR** | Liam Vance | `editor1@videoagency.com` | `EditorPass123!` | Motion Graphics & YouTube Specialist ($45/hr) |
| **EDITOR** | Sophia Ray | `editor2@videoagency.com` | `EditorPass123!` | Commercial & Short-Form Specialist ($35/hr) |
| **CLIENT** | Marcus Brody | `client1@techflow.io` | `ClientPass123!` | TechFlow Media (SaaS Explainer Videos) |
| **CLIENT** | Elena Vance | `client2@apexfitness.com` | `ClientPass123!` | Apex Athletics (Brand Commercials & Reels) |

> **Interactive Demo Switcher**: A quick one-click portal switcher bar is pinned to the header of the web application, allowing instant switching between all roles to test privacy segregation in real-time.

---

## 6. How to Run the Application

### 1. Install Dependencies
```bash
# Node.js backend dependencies
npm install

# Python microservice dependencies (FastAPI + ffmpeg-python)
pip install -r requirements.txt # or pip install fastapi uvicorn ffmpeg-python
```

### 2. Configure Environment (`.env`)
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secure_video_agency_jwt_secret_key_2026_!@#
COOKIE_SECRET=agency_cookie_secret_key_998877

# MySQL 8.0 (Set to your MySQL host; auto-switches to SQLite if offline)
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=video_agency

PYTHON_SERVICE_URL=http://127.0.0.1:8001
```

### 3. Start the Server
```bash
# Start Node.js API & Web Portal
npm start
# -> Access at http://localhost:5000

# (Optional) Start Python Video Microservice
npm run video-service
# -> Runs at http://127.0.0.1:8001
```

### 4. Run Automated Test Suite
```bash
node test_system.js
```
The test suite validates:
- Authentication & JWT cookie generation.
- Role-based data sanitization (verifying editors cannot see client details/margins; clients cannot see editor details/payouts).
- Direct Client ↔ Editor messaging firewall (`403 Forbidden`).
- Multi-currency project negotiation ($ USD and ₹ INR).
- Editor cut submissions and revision cycles.
- Finance ledger reconciliations (UPI / GPay / IMPS and Bank Wire).
- Automated video inspection and keyframe previews.
All 39 tests pass with zero errors.

