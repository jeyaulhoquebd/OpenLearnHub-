# OpenLearn Hub

**Knowledge for Everyone** — a curated hub of legal, free learning resources for learners in Bangladesh, India, and Pakistan.

OpenLearn Hub lists free courses, lawfully available books (open textbooks, public-domain works, and author-approved free editions), and open-source software. It links out to official sources, never re-hosts copyrighted files, and never hosts installers.

---

## Contents

- [What it does](#what-it-does)
- [Content and legal policy](#content-and-legal-policy)
- [Preview mode (no Firebase needed)](#preview-mode-no-firebase-needed)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Full Firebase setup](#full-firebase-setup)
- [LearnMate AI setup](#learnmate-ai-setup)
- [Environment variables](#environment-variables)
- [Data model and security rules](#data-model-and-security-rules)
- [API](#api)
- [Deployment](#deployment)
- [Moderation workflow](#moderation-workflow)
- [Translations and RTL](#translations-and-rtl)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Legal checklist before launch](#legal-checklist-before-launch)

---

## What it does

- **Browse and filter** 35 hand-checked resources by type, subject, level, language, region, platform, and search terms.
- **Detail pages** with provider, licence, last-verified date, official link, related resources, sharing, and a report button.
- **Accounts** with email/password and Google sign-in (Firebase Auth).
- **Saved resources** and a personal dashboard of your submissions.
- **Community submissions** that enter a moderation queue (`status: "pending"`).
- **Admin dashboard** for approving/rejecting submissions and resolving reports.
- **Report this resource** on every card and detail page for copyright, piracy, broken-link, and accuracy issues.
- **LearnMate**, an AI study guide whose key lives only on the server and which is grounded in the curated library.
- **Three languages** — English, Bangla, and Urdu (RTL). Hindi can be added later without restructuring.
- **Light and dark mode** with a navbar toggle that follows the system preference until you choose one, then remembers it.

## Content and legal policy

These rules are non-negotiable and are reflected in the code, the copy, and the rules files:

1. **No cracked or pirated software.** Software entries link only to the publisher's official download page. The site never hosts `.exe`, `.msi`, `.dmg`, archives, or installers.
2. **No copyrighted books without permission.** Books must be public domain, openly licensed (e.g. Creative Commons), or a free edition the author/publisher distributes themselves.
3. **No re-hosting.** Files and PDFs are not mirrored. Every item links to the official source.
4. **Every resource is reviewable.** The report modal is available on every card and detail page; copyright notices are handled through the [DMCA & Copyright Policy](client/src/pages/CopyrightPage.jsx) page.
5. **Humans approve submissions.** Community submissions start as `pending` and are invisible to the public until an admin publishes them.

Before adding a resource, confirm: the creator allows free access, the official source is clear, the licence is stated, and the link is live.

## Preview mode (no Firebase needed)

If no Firebase environment variables are present, the client runs in **preview mode**:

- The full seeded library (35 resources) renders from `firebase/seed/resources.json`.
- Browsing, filtering, search, detail pages, legal pages, and translations all work.
- Sign-in, saving, submissions, moderation, reports, and LearnMate are disabled with a clear banner instead of crashing.

This is useful for design review and for deploying a static demo. Start it with:

```bash
npm install
npm run dev
# or build and preview the production bundle
npm run build
npm run preview
```

The preview server runs at `http://localhost:4173`. In preview mode the AI assistant and report submission will show a friendly error because there is no API/Firebase behind them. That is expected.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, react-i18next, lucide-react |
| Auth / data | Firebase Web SDK v11 (Auth, Firestore, Storage) |
| Backend | Node.js 20+, Express 4, firebase-admin, zod, helmet, express-rate-limit |
| Hosting | Firebase Hosting (frontend); Render / Railway / Cloud Run (API) |
| AI | Any OpenAI-compatible chat-completions endpoint, called server-side |

There are **no Cloud Functions**. The API is a normal Express service so it can run on free/cheap containers and be deployed independently.

## Repository layout

```
.
├── client/                 React + Vite frontend
│   ├── src/
│   │   ├── components/     Header, cards, modals, chat, layout
│   │   ├── context/        Auth and toast providers
│   │   ├── hooks/          useResources, usePageMeta
│   │   ├── lib/            Firebase init, data layer, API client, i18n
│   │   ├── locales/        en / bn / hi / ur translation files
│   │   └── pages/          Route-level pages (lazy loaded)
│   ├── public/             favicon, OG image, robots.txt
│   ├── .env.example
│   └── vite.config.js
├── server/                 Express API
│   ├── src/
│   │   ├── routes/         /api/health, /api/reports, /api/ai
│   │   ├── middleware/     Firebase ID-token verification
│   │   ├── lib/            AI grounding + HTTP helpers
│   │   ├── config.js
│   │   ├── firebase.js
│   │   └── index.js
│   ├── scripts/            seed.js, set-admin.js
│   └── .env.example
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── storage.rules
│   └── seed/resources.json 35 curated resources
├── firebase.json
├── .firebaserc.example
└── package.json            npm workspaces (client + server)
```

## Prerequisites

- **Node.js 20+** and npm 9+
- A **Firebase project** (Blaze plan is not required for Hosting/Firestore/Storage at this scale, but check current quotas)
- **Firebase CLI** for rules and hosting: `npm install -g firebase-tools` (or use `npx firebase-tools`)
- Optional: an OpenAI-compatible API key for LearnMate

## Quick start

```bash
git clone <your-repo-url> openlearn-hub
cd openlearn-hub
npm install
npm run dev
```

- Client: `http://localhost:5173`
- API: `http://localhost:8080`
- Vite proxies `/api` to the API in development.

Without `.env` files you get preview mode. To enable accounts and moderation, continue with the full setup.

## Full Firebase setup

### 1. Create the Firebase project

1. Open the [Firebase console](https://console.firebase.google.com/) and create a project.
2. Add a **Web app** (Project settings → General → Your apps).
3. Copy the web config values.

### 2. Enable products

- **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
- **Firestore Database** → create a database (production mode is fine; rules come next).
- **Storage** → create a bucket (used only for optional thumbnails).

### 3. Configure the client

```bash
cp client/.env.example client/.env
```

Fill in the six `VITE_FIREBASE_*` values from the web app config. Keep `VITE_API_URL=http://localhost:8080` for local development.

> `VITE_*` values are **public** by design (they identify the Firebase project). They are not secrets. Never put the LLM key or a service-account key in a `VITE_*` variable.

### 4. Configure the server

```bash
cp server/.env.example server/.env
```

Create a service account: **Project settings → Service accounts → Generate new private key**. Then choose one option:

**Option A — paste JSON into `.env` (recommended for Render/Railway/Cloud Run):**

```dotenv
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
```

Keep the JSON on one line and leave the `\n` sequences escaped.

**Option B — point to a file (local development):**

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
```

Never commit `serviceAccount.json` or `.env` — both are ignored by `.gitignore`.

Set `ADMIN_EMAILS` to your own email. Set `CLIENT_ORIGIN` to your frontend origin(s), comma-separated.

### 5. Deploy Firestore and Storage rules

```bash
cp .firebaserc.example .firebaserc
# edit .firebaserc and replace your-project-id
npx firebase-tools login
npx firebase-tools use your-project-id
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

### 6. Seed the curated library

```bash
npm run seed
```

This writes the 35 records in `firebase/seed/resources.json` into the `resources` collection with deterministic IDs (for example `python`, `cs50x`). The script is idempotent (`merge: true`).

### 7. Create your first admin

1. Start the app and **sign up** with the email in `ADMIN_EMAILS`.
2. Run:

```bash
# from the repository root
npm run set-admin -w server -- --email=you@example.com
# or: cd server && npm run set-admin -- --email=you@example.com
```

The script sets both a custom claim (`admin: true`) and `users/{uid}.role = "admin"`. **Sign out and back in** so the new token claim is applied, then open `/admin`.

### 8. Run

```bash
npm run dev
```

## LearnMate AI setup

LearnMate is optional. Without a key, `/api/ai/chat` returns a clear `503` and the UI explains that the assistant is not configured.

1. Pick a provider with an OpenAI-compatible chat-completions API (OpenAI, Groq, Together, OpenRouter, a self-hosted gateway, etc.).
2. Put the key **only** in `server/.env`:

```dotenv
LLM_API_KEY=sk-...
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=30000
LLM_MAX_OUTPUT_TOKENS=700
```

3. Restart the API.

How it behaves:

- Requires a valid Firebase ID token (`Authorization: Bearer <token>`).
- Rate-limited per user (`AI_RATE_LIMIT_PER_HOUR`, default 25/hour).
- Retrieves matching resources from the local seed/Firestore and passes them to the model, then returns `reply` plus `sources`.
- The key never reaches the browser; there is no `VITE_LLM_*` variable.

## Environment variables

### Client (`client/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | For Firebase | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | For Firebase | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | For Firebase | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | For Firebase | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | For Firebase | Sender ID |
| `VITE_FIREBASE_APP_ID` | For Firebase | Web app ID |
| `VITE_API_URL` | Production | Full API origin, e.g. `https://openlearn-api.onrender.com`. Empty means relative `/api` (works with the dev proxy). |
| `VITE_USE_FIREBASE_EMULATOR` | No | `true` to connect to local emulators |
| `VITE_CONTACT_EMAIL` | No | Public contact address |
| `VITE_LEGAL_EMAIL` | No | Address for copyright notices |
| `VITE_SITE_URL` | No | Canonical site URL |

Leaving all six Firebase values empty is supported and enables preview mode.

### Server (`server/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production | `production` enables stricter logging/CORS checks |
| `PORT` | No | Default `8080` (Render supplies its own) |
| `CLIENT_ORIGIN` | Production | Comma-separated allowed browser origins. Never `*`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | One auth option | Service-account JSON on one line |
| `GOOGLE_APPLICATION_CREDENTIALS` | One auth option | Path to a service-account file |
| `FIREBASE_PROJECT_ID` | No | Explicit project ID for ADC |
| `FIREBASE_STORAGE_BUCKET` | No | Explicit storage bucket |
| `ADMIN_EMAILS` | Recommended | Default admin email(s) for `set-admin` |
| `LLM_API_KEY` | For LearnMate | Server-side secret |
| `LLM_API_URL` | For LearnMate | OpenAI-compatible endpoint |
| `LLM_MODEL` | For LearnMate | Model name |
| `LLM_TIMEOUT_MS` | No | Default `30000` |
| `LLM_MAX_OUTPUT_TOKENS` | No | Default `700` |
| `REPORT_RATE_LIMIT_PER_HOUR` | No | Default `12` |
| `AI_RATE_LIMIT_PER_HOUR` | No | Default `25` |
| `GLOBAL_RATE_LIMIT_PER_15_MIN` | No | Default `400` |

## Data model and security rules

### `resources/{resourceId}`

```jsonc
{
  "id": "python",
  "type": "course | book | software",
  "title": "Python",
  "slug": "python",
  "provider": "Python Software Foundation",
  "description": "Short summary",
  "longDescription": "Longer summary",
  "url": "https://official-source.example/...",
  "category": "Development Tools",
  "level": "All levels",
  "languages": ["English"],
  "countries": ["Bangladesh", "India", "Pakistan"],
  "platform": ["Windows", "macOS", "Linux"],
  "tags": ["python", "programming"],
  "license": "Free & open source · PSF License",
  "licenseUrl": "https://docs.python.org/3/license.html",
  "author": null,
  "featured": true,
  "thumbnailUrl": null,
  "status": "published | pending | rejected",
  "createdBy": "<uid, for community submissions>",
  "creatorEmail": "<email>",
  "lastVerified": "2026-10-01T00:00:00.000Z",
  "createdAt": "<timestamp>",
  "publishedAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

### `users/{uid}` and `users/{uid}/bookmarks/{resourceId}`

- Profiles are readable/writable only by their owner (admins can read/manage roles).
- Users cannot promote themselves; `role` must stay unchanged on self-update.
- Bookmarks are private to the owner.

### `reports/{reportId}`

- Readable and updatable by admins only.
- **Writes are disabled for clients** (`allow create: if false`). Reports are created by the Express API using the Admin SDK, which validates the payload and bypasses rules. This prevents spam and forged reports.

### Rules summary

- Published resources: public read.
- Pending/rejected resources: visible to the submitter and admins only.
- Resource create: signed-in user, `status: "pending"`, `featured: false`, HTTPS URL, required fields, length limits.
- Resource update/delete: admins only.
- Storage: images under 2 MB, thumbnail paths only.
- Default deny for everything else.

## API

Base URL: `http://localhost:8080` in development.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | Service metadata |
| `GET` | `/api/health` | No | Health + Firebase/LLM configuration flags |
| `POST` | `/api/reports` | Optional Firebase ID token | Create a report about a resource (IP rate-limited) |
| `POST` | `/api/ai/chat` | Firebase ID token | LearnMate reply grounded in curated resources |

### `POST /api/reports`

```json
{
  "resourceId": "python",
  "resourceTitle": "Python",
  "resourceType": "software",
  "resourceUrl": "https://www.python.org/downloads/",
  "reason": "copyright | broken-link | piracy | inaccurate | spam | other",
  "details": "Optional explanation",
  "email": "optional@example.com",
  "locale": "en"
}
```

### `POST /api/ai/chat`

```json
{
  "messages": [{ "role": "user", "content": "How do I start learning Python?" }],
  "locale": "en"
}
```

Response:

```json
{
  "reply": "…",
  "sources": [{ "id": "python", "title": "Python", "url": "https://…", "type": "software" }]
}
```

Errors use a consistent shape: `{ "error": { "code": "…", "message": "…" } }`.

## Deployment

### Frontend — Firebase Hosting

1. Set production values in `client/.env`:

```dotenv
VITE_API_URL=https://your-api-host.example.com
VITE_SITE_URL=https://your-project.web.app
```

2. Build and deploy:

```bash
npm run build
npx firebase-tools deploy --only hosting
```

`firebase.json` rewrites every path to `index.html` (SPA routing), sets long-lived caching for hashed assets, and adds baseline security headers.

`client/public/robots.txt` and `client/public/sitemap.xml` use the placeholder domain `https://openlearnhub.org`. Update both to your real domain before launch, and regenerate the sitemap if you add or remove seeded resources. Set `VITE_SITE_URL` to the same domain.

### SEO and accessibility

Route titles and meta descriptions are set per page via `usePageMeta`. The audited pages score 100 for Accessibility, Best Practices, and SEO in Lighthouse. Keep heading levels ordered (one `<h1>` per page, no skipped levels) and preserve the `sr-only` context on terse links such as "Learn more" and "View all".

### Backend — Render / Railway / Cloud Run

The Express app is a standard Node service. It is independent of Cloud Functions.

**Render:** a `render.yaml` blueprint is included. Create a new Blueprint from the repo, then set the secret env vars in the dashboard (`FIREBASE_SERVICE_ACCOUNT_JSON`, `LLM_API_KEY`, `CLIENT_ORIGIN`, `ADMIN_EMAILS`). Render injects `PORT` and `NODE_ENV=production`.

**Railway:** create a service from the repo, set **Root Directory** to `server`, build `npm install`, start `npm start`, and add the same env vars.

**Cloud Run:**

```bash
cd server
gcloud run deploy openlearn-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,CLIENT_ORIGIN=https://your-project.web.app
```

Use Secret Manager for `FIREBASE_SERVICE_ACCOUNT_JSON` and `LLM_API_KEY` in production.

After deploying the API:

1. Set `VITE_API_URL` to the API origin and rebuild the frontend.
2. Add the Firebase Hosting domain (and custom domain) to `CLIENT_ORIGIN`.
3. Confirm `GET /api/health` reports Firebase as ready.
4. Confirm the browser's CORS preflight succeeds from the deployed site.

### Emulators (optional)

```bash
npx firebase-tools emulators:start
```

Ports are defined in `firebase.json`: Auth `9099`, Firestore `8085`, Storage `9199`, Hosting `5000`, UI `4000`. The API stays on `8080`, so there is no conflict. Set `VITE_USE_FIREBASE_EMULATOR=true` and keep the `VITE_FIREBASE_*` values populated (the emulator ignores the actual project). Seed the emulator with `npm run seed` after setting `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`.

## Moderation workflow

1. A signed-in user submits a resource at `/submit`. It is written with `status: "pending"` and `featured: false`; the rules enforce this.
2. The submitter can see it in `/dashboard`; the public cannot.
3. An admin opens `/admin`, reviews the official link, licence, and metadata.
4. **Publish** sets `status: "published"` and `publishedAt`; **Reject** sets `status: "rejected"` with an optional note.
5. Reports appear in the admin dashboard. Resolving one sets `status: "resolved"`, `resolvedBy`, and `resolvedAt`.
6. If a copyright claim is valid, unpublish or delete the resource and reply to the reporter using the contact email they provided.

Admin access requires either the `admin` custom claim or `users/{uid}.role === "admin"`. Grant it only with `scripts/set-admin.js` (or deliberately in the console).

## Translations and RTL

- Locales live in `client/src/locales/{en,bn,ur}.json`.
- The switcher stores the choice in `localStorage` under `openlearn.language`.
- Urdu sets `<html lang="ur" dir="rtl">` and a `lang-urdu` body class; layouts use logical properties (`ms-*`, `me-*`, `start-*`, `end-*`) so they mirror correctly.
- To add a language: add the JSON file, register it in `client/src/lib/i18n.js`, and add it to `SUPPORTED_LANGUAGES` (used by the switcher). Resource titles/descriptions may be strings or `{ en, bn, ur }` maps; `localized()` in `client/src/lib/utils.js` resolves either shape and falls back to English.

## Design system

- Brand navy `#0B1F4B`, white surfaces, and electric purple `#7C3AED` accents. Tokens live in `client/tailwind.config.js`.
- Theme-aware neutrals (`sand`, `ink`, `surface`, `brand`) are CSS variables defined in `client/src/index.css`; switching the `dark` class on `<html>` recolours the app without per-component overrides.
- Fonts: Inter (English/UI), Noto Sans Bengali (Bangla), Noto Nastaliq Urdu (Urdu).
- The theme choice is stored under `openlearn.theme`; an inline script in `client/index.html` applies it before first paint to avoid a flash.

## Scripts

From the repository root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Client (5173) + API (8080) with `concurrently` |
| `npm run build` | Production build to `client/dist` |
| `npm run preview` | Serve the built client on 4173 |
| `npm start` | Start the API only |
| `npm run seed` | Seed Firestore with the curated library |
| `npm run set-admin -w server -- --email=…` | Grant admin to an existing user |

## Troubleshooting

**The banner says Firebase isn't configured.**
At least one `VITE_FIREBASE_*` value is missing. Copy `client/.env.example` to `client/.env`, fill all six values, and restart Vite (env changes require a restart).

**Reports or LearnMate return "Something went wrong".**
The API is not running or `VITE_API_URL` points to the wrong host. Check `http://localhost:8080/api/health`. In preview mode these features are expected to fail softly.

**`/admin` says "not authorized".**
Sign out and back in after running `set-admin` so the custom claim is refreshed. Confirm `users/{uid}.role` is `admin`.

**CORS errors in production.**
Add the exact frontend origin (scheme + host, no trailing slash) to `CLIENT_ORIGIN` and restart the API. `*` is rejected in production.

**Seeding fails with "Firebase Admin is not configured".**
Set `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` in `server/.env`. `npm run seed` loads that file.

**Firestore "missing index" error.**
Deploy indexes with `npx firebase-tools deploy --only firestore:indexes`, or open the link in the error message to create it.

**Fonts do not load behind a restrictive network.**
The UI falls back to system fonts. Self-host the Google Fonts files if you need offline/air-gapped rendering.

## Legal checklist before launch

This is an engineering checklist, not legal advice. Have a qualified lawyer review your final policy pages.

- [ ] Replace the placeholder contact and legal emails in `client/.env` (`VITE_CONTACT_EMAIL`, `VITE_LEGAL_EMAIL`).
- [ ] Review `CopyrightPage`, `TermsPage`, and `PrivacyPage` with counsel; fill in jurisdiction, entity name, and response times.
- [ ] Confirm every book entry is public domain, openly licensed, or author-approved free.
- [ ] Confirm every software entry links to the official publisher page and states the licence.
- [ ] Confirm no files are hosted on Firebase Storage except optional thumbnails.
- [ ] Keep a takedown log: date received, resource, action, and response.
- [ ] Publish a named DMCA/agent contact and a realistic response window.
- [ ] Add analytics/cookies disclosure if you introduce analytics later.
- [ ] Re-verify links and licences on a schedule (the UI shows `lastVerified`).

---

Built with care for learners in Bangladesh, India, and Pakistan. **No cracked software. No pirated PDFs. No paywalls pretending to be free.**
