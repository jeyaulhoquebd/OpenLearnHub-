# OpenLearn Hub

**Knowledge for Everyone** — a curated hub of legal, free learning resources for learners in Bangladesh, India, and Pakistan.

OpenLearn Hub lists free courses, lawfully available books (open textbooks, public-domain works, and author-approved free editions), and open-source software. It links out to official sources, never re-hosts copyrighted files, and never hosts installers.

**Maintained by [Jeyaul Hoque](https://jeyaulhoque.pages.dev/)** · [jeyaulhoquejaber@gmail.com](mailto:jeyaulhoquejaber@gmail.com)

---

## Contents

- [Maintainer](#maintainer)
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
- [Authentication](#authentication)
- [Translations and RTL](#translations-and-rtl)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Legal checklist before launch](#legal-checklist-before-launch)

---

## Maintainer

OpenLearn Hub is designed, built, and maintained by **Jeyaul Hoque**.

- Website: [https://jeyaulhoque.pages.dev/](https://jeyaulhoque.pages.dev/)
- Email: [jeyaulhoquejaber@gmail.com](mailto:jeyaulhoquejaber@gmail.com)

---

## What it does

- **Browse and filter** 35 hand-checked resources by type, subject, level, language, region, platform, minimum rating, and search terms — with sorting and pagination.
- **Dedicated search page** (`/search`) that spans courses, books, and software with per-type result counts.
- **Detail pages** with provider, licence, last-verified date, official link, rating summary, related resources, sharing, "open official link", and a report button.
- **Ratings and reviews** from signed-in, email-verified learners (one review per resource, editable).
- **Progress tracking** (Not started / In progress / Completed) per resource.
- **Free Alternatives to Paid Software** on the home page (Photoshop → GIMP, MS Office → LibreOffice, and more).
- **Accounts** with email/password, Google, GitHub, and Apple sign-in (Firebase Auth).
- **Personal dashboard** with saved resources, progress, review history, submissions, and account settings.
- **Community submissions** that enter a moderation queue (`status: "pending"`).
- **Admin dashboard** for approving/rejecting submissions, a reports queue with legal-priority highlighting and one-click unpublish, plus a link checker that flags dead official links.
- **Report this resource** on every card and detail page for copyright, piracy, broken-link, and accuracy issues.
- **LearnMate**, a public-site guide and study assistant that links to relevant pages and grounds resource recommendations in the published library. It cannot access admin pages or private account data.
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
| Auth / data | Firebase Web SDK v11 (Auth, Firestore) |
| Images | Cloudinary unsigned uploads (thumbnail delivery URLs stored in Firestore) |
| Courses | YouTube Data API v3 (server-side import) + official IFrame Player API (on-site playback) |
| Backend | Node.js 20+, Express 4, firebase-admin, zod, helmet, express-rate-limit |
| Hosting | Firebase Hosting (frontend); Render / Railway / Cloud Run (API) |
| AI | Groq via the official `groq-sdk` package, called server-side only |

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
│   │   ├── locales/        en / bn / ur translation files
│   │   └── pages/          Route-level pages (lazy loaded)
│   ├── public/             favicon, OG image, robots.txt
│   ├── .env.example
│   └── vite.config.js
├── server/                 Express API
│   ├── src/
│   │   ├── routes/         /api/health, /api/reports, /api/ai, /api/admin
│   │   ├── middleware/     Firebase ID-token verification, admin claim guard
│   │   ├── lib/            AI grounding, encrypted settings, quotas, HTTP helpers
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
- A **Firebase project** (Blaze plan is not required for Hosting/Firestore at this scale, but check current quotas)
- **Firebase CLI** for rules and hosting: `npm install -g firebase-tools` (or use `npx firebase-tools`)
- A **YouTube Data API v3 key** for admin playlist imports ([Google Cloud credentials](https://console.cloud.google.com/apis/credentials))
- A **Cloudinary account** with an unsigned upload preset for thumbnails ([console.cloudinary.com](https://console.cloudinary.com/))
- Optional: a **Groq API key** for LearnMate ([console.groq.com/keys](https://console.groq.com/keys))

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

- **Authentication** → Sign-in method → enable **Email/Password**, **Google**, **GitHub**, and **Apple**.
- **Firestore Database** → create a database (production mode is fine; rules come next).
- Firebase Storage is **not required** for new installs. Thumbnails go to Cloudinary; any existing Storage bucket is kept read-only for legacy images.

### 3. Configure the client

```bash
cp client/.env.example client/.env
```

Fill in the required `VITE_FIREBASE_*` values from the web app config (`VITE_FIREBASE_MEASUREMENT_ID` is optional — it only enables Analytics in production builds; `VITE_FIREBASE_STORAGE_BUCKET` is only needed for legacy Storage URLs). Keep `VITE_API_URL=http://localhost:8080` for local development. A production build **fails** without `VITE_API_URL`, because Firebase Hosting rewrites `/api` to `index.html` (set `VITE_ALLOW_RELATIVE_API=true` only if your host proxies `/api`).

Add the public Cloudinary values too:

```dotenv
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
```

These are public by design because unsigned uploads run in the browser, and there is no built-in fallback account. Restrict the unsigned preset in the Cloudinary console (allowed formats `jpg,png,webp`, a small max file size, a fixed folder, incoming transformation `c_limit,w_800`) so it cannot be abused. Never put the Cloudinary API secret in a `VITE_*` variable.

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

**Option B — three discrete values (also good for Render/Railway/Cloud Run):**

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the `\n` sequences in `FIREBASE_PRIVATE_KEY` escaped on a single line.

**Option C — point to a file (local development):**

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
```

Never commit `serviceAccount.json` or `.env` — both are ignored by `.gitignore`.

Set `ADMIN_EMAILS` to your own email. Set `CLIENT_ORIGIN` to your frontend origin(s), comma-separated.

For on-site YouTube courses, enable **YouTube Data API v3** in Google Cloud and add the key to `server/.env`:

```dotenv
YOUTUBE_API_KEY=your-youtube-data-api-key
```

The key is read only by the Express server. It is never sent to the browser. Playback uses YouTube's official IFrame player, so video bytes are never downloaded or rehosted.

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

1. Start the app and **sign up** (with the email in `ADMIN_EMAILS` if you set one).
2. Run:

```bash
# from the repository root — accepts a UID or an email address
npm run set-admin -w server -- <firebase-uid>
npm run set-admin -w server -- you@example.com
# revoke admin access again
npm run set-admin -w server -- you@example.com --remove
# or run it directly: cd server && node scripts/set-admin.js <uid-or-email>
```

With no argument, the script uses the first address in `ADMIN_EMAILS`; with neither, it stops instead of guessing an account. It sets (or clears) the `admin: true` **custom claim** and appends an `admin.grant` / `admin.revoke` entry to the server-only audit log.

**Sign out and back in** (or refresh the ID token) so the new claim is applied, then open `/admin`. The client reads admin rights from `getIdTokenResult()` — there is no client-writable `role` field.

### 8. Run

```bash
npm run dev
```

## LearnMate AI setup

LearnMate uses **Groq** through the official `groq-sdk` package, called only from the Express server. Without a key, `/api/ai/chat` and `/api/ai/roadmap` return a clear `503` with the message “AI is not configured yet”, and the UI explains that the assistant needs an administrator.

There are **two ways** to provide the key. A key stored from the admin panel always wins over the environment fallback:

1. **Server environment (simplest).** Put the key **only** in `server/.env`:

```dotenv
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_TIMEOUT_MS=15000
GROQ_MAX_OUTPUT_TOKENS=1024
GROQ_ROADMAP_MAX_OUTPUT_TOKENS=2048
AI_DAILY_LIMIT_PER_USER=10
```

   Groq retires model names over time. Check the current list at
   [console.groq.com/docs/models](https://console.groq.com/docs/models) before
   changing `GROQ_MODEL`.

2. **Admin panel (no redeploy).** Sign in as an admin, open **Admin → AI settings** (`/admin/ai-settings`), paste the key there. The server encrypts it with AES-256-GCM using `SETTINGS_ENCRYPTION_KEY` and stores it in the server-only `settings/ai` document:

```dotenv
# Generate with: openssl rand -hex 32
SETTINGS_ENCRYPTION_KEY=your-64-hex-char-secret
```

Rotating `SETTINGS_ENCRYPTION_KEY` makes previously stored keys undecryptable — open the admin page and save the key again afterwards.

How it behaves:

- Requires a valid Firebase ID token (`Authorization: Bearer <token>`). Roadmaps additionally require a **verified email**.
- Resolution order: Firestore `settings/ai` → `GROQ_API_KEY`. If neither is set, the API returns `503 llm_unavailable` with a clear “AI is not configured” message.
- The admin can switch AI features off entirely; both endpoints then return `503 ai_disabled`.
- Chat is rate-limited per user (`AI_RATE_LIMIT_PER_HOUR`, default 25/hour); roadmaps have both an hourly limit (`ROADMAP_RATE_LIMIT_PER_HOUR`, default 10) and a per-user daily limit from `settings/ai` (`AI_DAILY_LIMIT_PER_USER` is the fallback, default 10), counted in `aiUsage/{uid}_{YYYY-MM-DD}`.
- Up to **40** matching published resources are retrieved from Firestore and passed to Groq as the only allowed resource context. The model cannot cite anything outside that list.
- Chat also receives a small, maintained guide to public pages and features. It returns relevant `sitePages` links from a fixed public-route allowlist; admin pages, source code, and private account data are excluded.
- `POST /api/ai/chat` returns a free-form `reply`, published-resource `sources`, and verified public `sitePages`.
- `POST /api/ai/roadmap` requests strict JSON (`response_format: json_object`), validates it with zod, drops any unknown resource id, and returns `title`, `summary`, and `steps[{ title, explanation, resourceIds[] }]` plus resolved resource cards. Every step links to real curated resources.
- Both prompts instruct the model to treat user text as data, not instructions, and to ignore attempts to change the rules or reveal the prompt. The chat prompt also excludes admin dashboard information and personal account data.
- Groq calls have a hard 15s timeout. A Groq `429` becomes a friendly response with a `Retry-After` header when the provider supplies one.
- The key never reaches the browser; there is no `VITE_GROQ_*` variable, and `settings/ai` is unreadable from clients by rule.

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
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Enables Analytics in production builds only |
| `VITE_API_URL` | Production | Full API origin, e.g. `https://openlearn-api.onrender.com`. Empty means relative `/api` (works with the dev proxy). |
| `VITE_USE_FIREBASE_EMULATOR` | No | `true` to connect to local emulators |
| `VITE_CONTACT_EMAIL` | No | Public contact address |
| `VITE_LEGAL_EMAIL` | No | Address for copyright notices |
| `VITE_SITE_URL` | No | Canonical site URL |

Leaving the six required Firebase values empty is supported and enables preview mode.

### Server (`server/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production | `production` enables stricter logging/CORS checks |
| `PORT` | No | Default `8080` (Render supplies its own) |
| `CLIENT_ORIGIN` | Production | Comma-separated allowed browser origins. Never `*`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | One auth option | Service-account JSON on one line |
| `FIREBASE_PROJECT_ID` | One auth option | With the two values below, for the three-variable credential |
| `FIREBASE_CLIENT_EMAIL` | One auth option | `client_email` from the service account |
| `FIREBASE_PRIVATE_KEY` | One auth option | `private_key` (keep the `\n` escapes) |
| `GOOGLE_APPLICATION_CREDENTIALS` | One auth option | Path to a service-account file (local dev / ADC) |
| `FIREBASE_STORAGE_BUCKET` | No | Explicit storage bucket |
| `ADMIN_EMAILS` | Optional | Default target email for `set-admin` when no argument is given |
| `GROQ_API_KEY` | For LearnMate | Server-side Groq key (fallback when none is stored) |
| `GROQ_MODEL` | No | Default `qwen/qwen3.8-27b` |
| `GROQ_TIMEOUT_MS` | No | Default `15000` |
| `GROQ_MAX_OUTPUT_TOKENS` | No | Default `1024` |
| `GROQ_ROADMAP_MAX_OUTPUT_TOKENS` | No | Default `2048` |
| `AI_DAILY_LIMIT_PER_USER` | No | Default daily roadmap limit per user when `settings/ai` has no value (`10`) |
| `AI_CHAT_DAILY_LIMIT_PER_USER` | No | Daily LearnMate chat messages per user (`60`), on top of the hourly limit |
| `SETTINGS_ENCRYPTION_KEY` | For admin AI settings | AES-256-GCM key (`openssl rand -hex 32`) that encrypts the key stored in `settings/ai` |
| `REPORT_RATE_LIMIT_PER_HOUR` | No | Default `12` |
| `AI_RATE_LIMIT_PER_HOUR` | No | Default `25` |
| `ROADMAP_RATE_LIMIT_PER_HOUR` | No | Default `10` |
| `GLOBAL_RATE_LIMIT_PER_15_MIN` | No | Default `400` |

## Data model and security rules

### `resources/{resourceId}`

```jsonc
{
  "id": "python",
  "type": "course | book | software",
  "title": { "en": "Python", "bn": "…", "ur": "…" },
  "slug": "python",
  "sourceName": "Python Software Foundation",
  "description": { "en": "Short summary", "bn": "…", "ur": "…" },
  "longDescription": { "en": "Longer summary" },
  "sourceUrl": "https://official-source.example/...",
  "category": "Development Tools",
  "level": "All levels",
  "language": ["English"],
  "countries": ["Bangladesh", "India", "Pakistan"],
  "platform": ["Windows", "macOS", "Linux"],
  "tags": ["python", "programming"],
  "license": "Free & open source · PSF License",
  "licenseUrl": "https://docs.python.org/3/license.html",
  "author": null,
  "featured": true,
  "thumbnailUrl": null,
  "ratingAvg": 4.6,
  "ratingCount": 128,
  "viewCount": 5120,
  "saveCount": 340,
  "status": "published | draft | flagged",
  "createdBy": "<uid, for community submissions>",
  "creatorEmail": "<email>",
  "lastVerified": "2026-10-01T00:00:00.000Z",
  "createdAt": "<timestamp>",
  "publishedAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

`title` and `description` are stored as `{ en, bn, ur }` maps; the client
resolves them for the active language with `localized()` and falls back to
English. The seed script (`server/scripts/seed.js`) wraps the English source
text into these maps, and will merge in `firebase/seed/translations.json` when
it exists. The client also tolerates the older flat shape (`title` as a string,
`provider`, `url`, `languages`, `status: "pending" | "rejected"`), so existing
data keeps rendering during the migration.

### `users/{uid}`, `users/{uid}/bookmarks/{resourceId}` and `users/{uid}/roadmaps/{roadmapId}`

- Profiles are readable/writable only by their owner; the profile stores `displayName`, `email`, `photoURL`, `provider`, `preferredLanguage`, and timestamps.
- Users **cannot** set or change `role` — admin access comes from the `admin` custom claim. The client never writes a role.
- Owners may delete their own profile (the delete-account flow).
- Bookmarks and saved AI roadmaps are private to the owner. Roadmap creation is bounded (`goal` ≤ 300 chars, `title` ≤ 200, ≤ 20 steps) and updates are denied.

### Refined collections

| Collection | Read | Write |
| --- | --- | --- |
| `categories/{id}` | public | **Express API only** (Admin SDK) |
| `alternatives/{id}` | public | **Express API only** (Admin SDK) |
| `bookmarks/{userId_resourceId}` | owner | owner (id must be `<uid>_<resourceId>`) |
| `progress/{userId_resourceId}` | owner | owner (id must be `<uid>_<resourceId>`) |
| `reviews/{resourceId_userId}` | public (hidden reviews: author/admin only) | verified, signed-in owner (one review per resource); `hidden` is server-only |
| `reports/{id}` | admins | **Express API only** (Admin SDK) |
| `roadmaps/{id}` (legacy) | owner | no longer written; new roadmaps use the subcollection below |
| `users/{uid}/roadmaps/{id}` | owner only | owner only (bounded content, no updates) |
| `aiUsage/{uid_YYYY-MM-DD}` | **nobody** | **nobody** (Admin SDK only; per-user daily AI quota) |
| `aiUsage/{YYYY-MM-DD}` | **nobody** | **nobody** (Admin SDK only; global request/failure counters) |
| `settings/site` | **public** (banner + maintenance only) | **Express API only** (Admin SDK) |
| `settings/{other}` | **nobody** | **nobody** (Admin SDK only; includes `settings/ai`) |
| `auditLogs/{id}` | **nobody** | **nobody** (Admin SDK only; admin action trail) |

`categories` seed data lives in `firebase/seed/categories.json` and
`alternatives` (the "free alternatives to paid software" pairs) in
`firebase/seed/alternatives.json`. Both are written by `npm run seed`.

### `reports/{reportId}`

- Readable by admins (the shell counter and dashboard feed).
- **All writes are server-only** (`allow create, update, delete: if false`). Reports are created by the public `POST /api/reports` endpoint, and moderation (status, admin note, unpublish) goes through `/api/admin/reports` so every change is validated and audited.
- Signed-in reporters must have a verified email; anonymous copyright notices are still accepted and stored with `verifiedReporter: false`.

### `settings/ai` (server-only)

Written exclusively by the Express API through the Admin SDK. Clients are denied all access by rule.

```jsonc
{
  "provider": "groq",
  "model": "qwen/qwen3.8-27b",
  "apiKeyCiphertext": "…", // AES-256-GCM, base64
  "apiKeyIv": "…",
  "apiKeyTag": "…",
  "apiKeyPrefix": "gsk_",  // for the masked hint only
  "apiKeySuffix": "1234",
  "enabled": true,
  "dailyLimitPerUser": 10,
  "updatedAt": "<timestamp>",
  "updatedBy": "<admin uid>"
}
```

### `settings/site` (public read, server write)

The only settings document readable by the browser. It contains public site
configuration and never an API key or an administrator identifier:

```jsonc
{
  "siteName": "OpenLearn Hub",
  "tagline": { "en": "Knowledge for Everyone", "bn": "…", "ur": "…" },
  "contactEmail": "…",
  "legalEmail": "…",
  "socialLinks": { "facebook": "", "twitter": "", "instagram": "", "youtube": "", "linkedin": "", "github": "", "website": "…" },
  "announcement": {
    "enabled": false,
    "type": "info", // info | warning | success | critical
    "text": { "en": "", "bn": "", "ur": "" }
  },
  "maintenanceMode": false
}
```

The public layout reads this document directly to show the announcement banner
and, for signed-out visitors and non-admins, the maintenance screen. Saving is
restricted to `POST /api/admin/settings/site`; `firestore.rules` denies every
client write. Sign-in (`/login`, `/forgot-password`) stays reachable during
maintenance so an administrator can turn it off again.

### Rules summary

- Published resources: public read.
- Pending/rejected resources: visible to the submitter and admins only.
- Resource create: signed-in user, `status: "pending"`, `featured: false`, `title`/`description` maps with an English value, HTTPS `sourceUrl`, required fields, length limits, and a key whitelist (counters such as `ratingAvg`/`viewCount` cannot be pre-filled).
- Resource update/delete, categories, alternatives: server-only (admin API). Direct browser writes are denied even for admins, so every change is audited and a revoked admin token cannot be used.
- Profiles: owner-only writes limited to the profile fields (`displayName`, `photoURL`, `preferredLanguage`, login timestamps…); `createdAt` is immutable; deletion goes through `DELETE /api/me`.
- Bookmarks: server-only writes (`/api/bookmarks/:resourceId`) so `saveCount` stays exact; owner-only reads.
- Progress: owner-only, composite id `<uid>_<resourceId>`, key whitelist. Course progress may also store `completedVideoIds` (≤ 5,000 ids) and `lastVideoId`.
- YouTube lessons: `resources/{resourceId}/videos/{lessonId}` is written only by the Admin SDK. Client reads follow the parent resource: published courses are public; drafts are limited to admins and the original submitter.
- Course notes: `users/{uid}/courseNotes/{noteId}` is owner-only, capped at 4,000 characters per note.
- Roadmaps: `users/{uid}/roadmaps` is owner-only read/delete; create is limited to bounded content (`goal` ≤ 300 chars, `title` ≤ 200, ≤ 20 steps); updates are denied. The top-level `roadmaps` collection is legacy and no longer written.
- Reviews: public read of visible reviews; writes only through `/api/reviews` (verified email, published resource, author name set server-side, rating recomputed in the same transaction). A review hidden by a moderator cannot be deleted and re-posted.
- `settings/site`: public read so every visitor can see the banner and maintenance switch; all writes are server-only.
- Other `settings/*` (including `settings/ai`): completely denied to clients (the server's Admin SDK writes them).
- `auditLogs/*`: completely denied to clients; only admins can read them through `GET /api/admin/audit-logs`.
- Storage: legacy only. Existing thumbnail objects stay publicly readable, but all client writes are denied. New thumbnails are uploaded to Cloudinary.
- Default deny for everything else.

## API

Base URL: `http://localhost:8080` in development.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | Service metadata |
| `GET` | `/api/health` | No | Health + Firebase/LLM configuration flags |
| `POST` | `/api/reports` | Optional Firebase ID token | Create a report about a resource (IP rate-limited) |
| `POST` | `/api/ai/chat` | Firebase ID token | LearnMate reply grounded in curated resources |
| `POST` | `/api/ai/roadmap` | Firebase ID token + verified email | Structured study roadmap grounded in curated resources (hourly + daily limits) |
| `POST` | `/api/reviews` | Firebase ID token + verified email | `{ resourceId, rating (1–5 integer), body }` — create/edit own review; recomputes `ratingAvg`/`ratingCount` |
| `DELETE` | `/api/reviews/:resourceId` | Firebase ID token | Delete own review (refused for moderator-hidden reviews) |
| `POST` / `DELETE` | `/api/bookmarks/:resourceId` | Firebase ID token | Save / remove a bookmark and update `saveCount` |
| `POST` | `/api/resources/:resourceId/view` | Optional Firebase ID token | Count a detail-page view (de-duplicated per visitor for 6 hours) |
| `DELETE` | `/api/me` | Firebase ID token (signed in within 10 min) | Delete the account, profile, bookmarks, progress, notes and roadmaps; reviews are anonymised |
| `POST` | `/api/admin/resources/:id/moderate` | Admin claim | `{ decision: approve\|reject, note? }` — approve (blocklist check, counters reset) or reject a submission |
| `GET` | `/api/admin/me` | Admin claim | Confirms the caller's admin claim and returns basic profile fields |
| `GET` | `/api/admin/stats` | Admin claim | Dashboard aggregates: counts, 30-day series, top resources, latest reports/reviews, auth provider split (cached 60s, `?refresh=1` bypasses) |
| `GET` | `/api/admin/resources` | Admin claim | Resource list: `q`, `type`, `status`, `category`, `language`, `sort`, `cursor`, `limit` |
| `POST` | `/api/admin/resources` | Admin claim | Create a resource (validated, blocklisted, unique slug, audited) |
| `PUT` | `/api/admin/resources/:id` | Admin claim | Update a resource (regenerates the slug when the English title changes) |
| `DELETE` | `/api/admin/resources/:id` | Admin claim | Delete a resource |
| `POST` | `/api/admin/resources/bulk` | Admin claim | Publish/draft/flag/delete up to 100 ids in one batch |
| `POST` | `/api/admin/resources/test-link` | Admin claim | SSRF-safe link reachability check |
| `GET` | `/api/admin/settings/ai/status` | Admin claim | Masked AI configuration status (never returns the key) |
| `POST` | `/api/admin/settings/ai` | Admin claim | Save the encrypted Groq key, model, feature switch and daily limit |
| `POST` | `/api/admin/settings/ai/test` | Admin claim | Verify a candidate or active Groq key with a minimal call |
| `GET` | `/api/admin/settings/ai/models` | Admin claim | List models available to the configured Groq key |
| `GET` | `/api/admin/settings/ai/usage` | Admin claim | Today/7-day AI request and failure counters |
| `DELETE` | `/api/admin/settings/ai/key` | Admin claim | Remove the stored key (falls back to `GROQ_API_KEY`) |
| `GET` | `/api/admin/categories` | Admin claim | Categories with resource counts and order |
| `POST` | `/api/admin/categories` | Admin claim | Create a category (unique slug, icon whitelist, audited) |
| `PUT` | `/api/admin/categories/:id` | Admin claim | Update a category; renaming the English name moves its resources |
| `DELETE` | `/api/admin/categories/:id` | Admin claim | Delete an empty category (`409 category_in_use` otherwise) |
| `POST` | `/api/admin/categories/reorder` | Admin claim | Persist the drag-and-drop order |
| `POST` | `/api/admin/categories/:id/move-resources` | Admin claim | Move resources to another category (used by the delete flow) |
| `GET` | `/api/admin/alternatives` | Admin claim | Paid → free software pairs, ordered |
| `POST` | `/api/admin/alternatives` | Admin claim | Create a pair (paid and free must be published software resources) |
| `PUT` | `/api/admin/alternatives/:id` | Admin claim | Update a pair (duplicate pairs rejected) |
| `DELETE` | `/api/admin/alternatives/:id` | Admin claim | Delete a pair |
| `POST` | `/api/admin/alternatives/reorder` | Admin claim | Persist order |
| `POST` | `/api/admin/alternatives/:id/active` | Admin claim | Show/hide a pair on the public home page |
| `GET` | `/api/admin/users` | Admin claim | Auth users merged with Firestore profiles: `pageToken`, `search`, `verified`, `provider`, `admin`, `disabled` |
| `GET` | `/api/admin/users/:uid` | Admin claim | Account detail plus bookmark/review/progress counts |
| `POST` | `/api/admin/users/:uid/disable`, `/enable` | Admin claim | Toggle sign-in access |
| `POST` | `/api/admin/users/:uid/make-admin`, `/remove-admin` | Admin claim | Set the `admin` claim (self and last-admin guards) |
| `POST` | `/api/admin/users/:uid/revoke-sessions` | Admin claim | Revoke refresh tokens everywhere |
| `DELETE` | `/api/admin/users/:uid` | Admin claim | Delete Auth + profile/bookmarks/progress and anonymise reviews (email confirmation required) |
| `GET` | `/api/admin/reviews` | Admin claim | Moderation queue: `q`, `resourceId`, `rating`, `cursor`, `limit` (hidden included) |
| `POST` | `/api/admin/reviews/:id/hide`, `/show` | Admin claim | Toggle visibility and recompute the resource rating in a transaction |
| `DELETE` | `/api/admin/reviews/:id` | Admin claim | Delete a review and recompute the rating |
| `POST` | `/api/admin/reviews/bulk` | Admin claim | `{ ids, action }` for up to 100 reviews |
| `GET` | `/api/admin/reports` | Admin claim | Report queue with `status`, `reason` (`illegal`/`broken`/`other` or an exact reason), `resourceId` and `q`; illegal reports sorted first, including similar-report counts |
| `PATCH` | `/api/admin/reports/:id` | Admin claim | `{ status?, adminNote? }` — move a report between statuses and/or save an internal note |
| `POST` | `/api/admin/reports/:id/unpublish-resource` | Admin claim | Flag the reported resource and resolve the report in one transaction |
| `GET` | `/api/admin/check-links/results` | Admin claim | Saved `linkCheck` results, summary counts, last full check time and the running-job summary |
| `POST` | `/api/admin/check-links` | Admin claim | Start a background job; `{ ids }` checks selected resources, omit it for the whole library (409 when a job is running) |
| `GET` | `/api/admin/check-links/:jobId` | Admin claim | Live job progress and completed rows |
| `POST` | `/api/admin/check-links/recheck` | Admin claim | `{ id }` — synchronously re-check one resource and save the result |
| `GET` | `/api/admin/import-export/export/:kind` | Admin claim | Server-generated `resources`, `categories` or `alternatives` export (`format=json|csv`; CSV is resources-only) |
| `GET` | `/api/admin/import-export/template` | Admin claim | Downloadable JSON/CSV sample with trilingual fields |
| `POST` | `/api/admin/import/duplicates` | Admin claim | Existing resources keyed by trimmed `sourceUrl` (max 400 URLs) |
| `POST` | `/api/admin/import` | Admin claim | Import up to 400 validated rows; new rows are drafts (`mode: skip\|update`) |
| `GET` | `/api/admin/audit-logs` | Admin claim | Read-only audit trail with `admin`, `action`, `targetType`, `from`, `to`, `cursor`, `limit` |
| `GET` | `/api/admin/settings/site` | Admin claim | Current normalised `settings/site` document |
| `POST` | `/api/admin/settings/site` | Admin claim | Validate and save site name, tagline, contact/social links, banner and maintenance mode |

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

### `POST /api/ai/roadmap`

```json
{
  "goal": "Become a front-end developer",
  "level": "beginner | intermediate | advanced",
  "language": "en | bn | ur"
}
```

Response (step `resources` always come from the curated library):

```json
{
  "goal": "Become a front-end developer",
  "level": "beginner",
  "language": "en",
  "title": "Your front-end path",
  "summary": "…",
  "steps": [
    {
      "order": 1,
      "title": "Learn HTML & CSS",
      "explanation": "…",
      "resourceIds": ["freecodecamp-web"],
      "resources": [{ "id": "freecodecamp-web", "title": "…", "url": "https://…", "type": "course" }]
    }
  ],
  "sources": []
}
```

### Admin AI settings

`GET /api/admin/settings/ai/status` returns `{ hasKey, source: "admin" | "env" | "none", maskedKey, model, enabled, dailyLimitPerUser, updatedAt }` — the API key itself is never returned. `POST /api/admin/settings/ai` accepts `{ apiKey?, model?, enabled?, dailyLimitPerUser? }`; a blank `apiKey` keeps the stored key, and `DELETE /api/admin/settings/ai/key` removes it. `POST /api/admin/settings/ai/test` verifies a candidate or the active key. `GET /api/admin/settings/ai/models` lists the models available to the configured key, and `GET /api/admin/settings/ai/usage` returns the today/7-day counters for the admin usage card.

Saved roadmaps are written by the **client** to `users/{uid}/roadmaps` (owner-only rules), not through the API. The public AI Assistant page (`/assistant`) builds a roadmap and offers **Save roadmap**, which writes to that subcollection.

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

### Frontend — Cloudflare Pages (alternative)

A `*.pages.dev` address only exists after a Pages project with that exact name has been created **and** has at least one successful deployment. Until then the browser shows `DNS_PROBE_POSSIBLE` / "DNS address could not be found". If the name was already taken, Cloudflare adds a suffix (for example `openlearnhub-abc.pages.dev`), so check the real URL in the dashboard.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, pick this repository.
2. Project name: `openlearnhub` (this becomes `openlearnhub.pages.dev`).
3. Build settings: framework preset **None**, build command `npm run build`, build output directory `client/dist`, root directory empty (repository root). Node 20 comes from `.nvmrc`.
4. Environment variables (Production **and** Preview): every `VITE_FIREBASE_*` value, `VITE_API_URL` (your Render URL — the build fails without it), `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`, `VITE_SITE_URL=https://openlearnhub.pages.dev`.
5. Save and deploy, then wait for the first build to succeed.
6. Firebase console → Authentication → Settings → **Authorized domains**: add `openlearnhub.pages.dev`.
7. On the API (Render), add `https://openlearnhub.pages.dev` to `CLIENT_ORIGIN` and redeploy.

`client/public/_redirects` makes client-side routes work and `client/public/_headers` applies the same security headers as Firebase Hosting.

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

Admin access comes **only** from the `admin: true` custom claim (set with `scripts/set-admin.js`). The Express API verifies it in `server/src/middleware/requireAdmin.js`; Firestore rules check `request.auth.token.admin`; the client checks `getIdTokenResult()`. No Firestore field grants admin rights, so a user can never promote themselves.

### Admin panel

`/admin/*` is a separate workspace with its own navy sidebar and top bar — the public header, footer and floating assistant are not rendered there.

| Route | Screen |
| --- | --- |
| `/admin` | Dashboard: headline metrics with 7-day trends, 30-day sign-up/resource charts, type and provider donuts, top viewed/saved, latest reports and reviews with quick actions, submission queue |
| `/admin/resources` | Resource library: search, type/status/category/language filters, sortable columns, row selection + bulk publish/draft/flag/delete, row menu (edit, duplicate, view, publish, delete) |
| `/admin/resources/new`, `/admin/resources/:id/edit` | Five-section editor (basic info, multilingual content, source, thumbnail, publishing) with a live public-card preview |
| `/admin/categories`, `/admin/alternatives` | Categories (courses/books/software tabs, drag-and-drop order, icon picker) and paid → free software pairs |
| `/admin/users` | Accounts: search and filters, verification/provider badges, detail drawer with disable, admin claim, session revoke and typed-email deletion |
| `/admin/reviews` | Moderation: search + rating filters, hide/show/delete (single and bulk), detail modal, automatic rating recalculation |
| `/admin/reports` | Reports queue: board/table views, illegal-first priority, reason/status/search filters, detail drawer with admin note, status changes and one-click unpublish |
| `/admin/link-checker` | Maintenance: full or selected background link checks, live progress, result filters/sort, per-row re-check and bulk flagging of broken links |
| `/admin/import-export` | Server-generated JSON/CSV exports, drag-and-drop import with per-row validation preview, skip/update duplicate handling, 400-row batches, draft defaults, error report and trilingual templates |
| `/admin/ai-settings` | AI Settings — encrypted Groq key, model dropdown, test/remove, feature switch, daily limit and usage counters |
| `/admin/site-settings`, `/admin/audit-log` | Site settings and the read-only action trail |

- **Guard:** `components/admin/AdminRoute.jsx` waits for auth, re-checks the current ID token, and redirects non-admins home with a translated "Access denied" toast. The public navbar shows a small **Admin** link to admins only.
- **Shell:** `components/admin/AdminLayout.jsx` renders a collapsible sidebar (state kept in `localStorage`), a mobile drawer, breadcrumbs, theme and language switches, a report counter, and the account menu. Every admin screen is `React.lazy`-loaded.
- **UI kit:** `components/admin/ui/` provides `PageHeader`, `StatCard`, `DataTable`, `ConfirmDialog`, `Modal`, `Drawer`, `StatusBadge`, `SearchInput`, `FormField`, `ImageUploader`, `Tabs` and the shared toast hook.
- **Audit trail:** `server/src/lib/audit.js` appends every privileged action to the server-only `auditLogs` collection, including the acting admin's UID, email and display name. Entries are never readable from a browser, and failed logging never breaks the action itself. `/admin/audit-log` reads through `GET /api/admin/audit-logs`, which scans the newest 1,000 entries, filters by admin/action/target/date in memory, paginates with an opaque offset cursor and shows the same warnings when the scan cap is reached. The details expander pretty-prints `before`/`after` summaries (resource updates and site-settings saves) and other flat details.
- **Import / export:** exports and templates are generated server-side under `/api/admin/import-export`, so drafts and internal fields never depend on broad client reads. The browser parses the 2 MB upload, previews every row with the resource-form zod schema, and posts only valid rows in batches of 400. Duplicate detection matches trimmed `sourceUrl`; `skip` leaves existing resources untouched and `update` refreshes them while preserving status/counters. New rows are always drafts. The final summary and downloadable CSV error report cover created/updated/skipped/failed rows.
- **Site settings:** `/admin/site-settings` edits `settings/site` through the validated Express endpoint. The public layout reads the same document directly for the site name/tagline, contact and social links (footer, contact and legal pages), dismissible announcement banner, and maintenance gate. Non-admins see the maintenance page (sign-in remains reachable); admins keep full access. Only public fields are stored, and the acting admin is recorded in the audit log instead of the public document.
- **Stats:** `GET /api/admin/stats` (Admin SDK) returns counts via Firestore `count()` aggregations, 30-day series, top resources, latest activity and the auth-provider split (up to 5,000 accounts, marked approximate past the cap). The response is cached in memory for 60 seconds; the dashboard's **Refresh** button sends `?refresh=1` to bypass the cache.
- **Charts:** the dashboard uses `recharts` (its own `charts` chunk, loaded only with `/admin`). Series colours follow the navy → purple ramp, while axes and grids read CSS variables so light and dark mode need no re-render. In Urdu the time axes are reversed and the Y axis moves to the right.
- **Resources CRUD:** all writes go through `/api/admin/resources` (never direct Firestore writes from the panel), so one server-side zod schema, the unique-slug generator, the piracy blocklist (`server/config/blocklist.js`) and the audit log apply to every save. Software listings must have a licence and an official `sourceUrl`; known piracy domains, crack keywords and third-party software mirrors are rejected with a `422` explaining the match.
- **List search:** Firestore cannot substring-search three language fields, so the list endpoint applies equality filters in Firestore and search/language/sort in memory over the 500 most recently updated matches. The opaque cursor is an offset into that filtered set; the UI warns when the scan cap is reached.
- **Test link:** `POST /api/admin/resources/test-link` performs an SSRF-safe reachability check (public http/https only, DNS + every redirect validated, 7 s timeout) and reports the final status.
- **YouTube import:** `POST /api/admin/resources/youtube/preview` loads a public playlist and every video through the server-only YouTube Data API key. Saving the resource writes lesson metadata to `resources/{id}/videos/{lessonId}`; no video bytes are downloaded or rehosted. Updating an unrelated field preserves the lesson list, while changing or removing the playlist reconciles it.
- **On-site courses:** `/course/:id` renders the ordered lesson list, one video at a time through the official YouTube IFrame Player API, per-lesson completion, private notes and practice prompts. Older courses without imported lessons fall back to YouTube's playlist embed until an admin imports the playlist.
- **Categories & alternatives:** both collections are **server-write-only** (rules deny every client write), so ordering, slug uniqueness and the icon whitelist cannot be bypassed. Deleting a category that still has resources returns `409 category_in_use`; the UI offers a "move resources, then delete" flow instead. Resources store the English category **name**, so renaming a category moves its resources in the same request.
- **Users:** the list merges Firebase Auth (identity, providers, disabled flag, metadata, claims) with `users/{uid}` (profile fields). Privileges are claim-only. The API refuses to remove your own admin claim, refuses to demote/delete the last administrator, and deletion requires typing the account email. Deletion removes the Auth user, profile, bookmarks and progress, while reviews are kept and anonymised so ratings stay honest.
- **Reviews:** hide/show/delete runs in a Firestore transaction that re-queries the resource's reviews and rewrites `ratingAvg`/`ratingCount`, so cards and filters stay in sync. Hidden reviews are excluded by the security rules; the public review query filters `hidden == false` (composite index in `firebase/firestore.indexes.json`). Authors cannot change the `hidden` flag themselves.
- **Reports queue:** a bounded scan (500 reports) supports reason groups (`illegal` = copyright/piracy, `broken`, `other`), status, resource and free-text filters. Copyright/piracy reports always sort first and are highlighted. The drawer saves the note and status in one PATCH; unpublishing flags the resource and resolves the report transactionally. Every write is audited and dispatches a shell-counter refresh, so the sidebar and bell badges update immediately.
- **Link checker:** `POST /api/admin/check-links` starts an in-memory job (one at a time), checks with HEAD → GET fallback, a 10-second budget, at most 5 redirects, concurrency 5 and the same SSRF rules as the resource form. Results are written to `resources/{id}.linkCheck` (`ok`, `statusCode`, `finalUrl`, `checkedAt`, `error`, redirect metadata). A full check also stores `settings/linkChecker.lastFullCheckAt`; the client polls job progress, then reloads the saved rows. Broken/timed-out rows can be selected and bulk-flagged through the existing resource bulk endpoint.
- **Thumbnails:** the browser resizes to 800 px, re-encodes as WebP and keeps the file under 1 MB before uploading to Cloudinary with the public unsigned preset. Only the resulting `secure_url` is stored in Firestore; the Cloudinary API secret never reaches the client.
- **Note:** resource `viewCount` / `saveCount` are stored and sorted, but nothing increments them yet, so the "most viewed" and "most saved" lists show zeros on a freshly seeded library.

## Translations and RTL

- Locales live in `client/src/locales/{en,bn,ur}.json`.
- The switcher stores the choice in `localStorage` under `openlearn.language` and, for signed-in users, in `users/{uid}.preferredLanguage`.
- Urdu sets `<html lang="ur" dir="rtl">` and a `lang-urdu` body class; layouts use logical properties (`ms-*`, `me-*`, `start-*`, `end-*`) so they mirror correctly.
- `npm run check:i18n` verifies that **en, bn, and ur have identical key sets** and that **every key used in the UI exists in all three files**. It exits non-zero on any gap, so it can gate CI.
- To add a language: add the JSON file, register it in `client/src/lib/i18n.js`, and add it to `SUPPORTED_LANGUAGES` (used by the switcher). Resource titles/descriptions may be strings or `{ en, bn, ur }` maps; `localized()` in `client/src/lib/utils.js` resolves either shape and falls back to English.

## Authentication

Four sign-in methods: **Email/Password, Google, GitHub, Apple** (`signInWithPopup`, with a `signInWithRedirect` fallback when the popup is blocked or on mobile). Social users are treated as email-verified.

- Email/password sign-up sends a verification email. Until `emailVerified` is true, the app shows a "Verify your email" banner with a 60-second resend cooldown and an "I've verified" button that reloads the Firebase user.
- `auth/account-exists-with-different-credential` is handled explicitly: the app tells the user which provider the account uses and links the new credential with `linkWithCredential()` after they sign in with the original method.
- All common Firebase error codes map to friendly, translated messages (`client/src/lib/authErrors.js`).
- Forgot-password uses `sendPasswordResetEmail`; the dashboard offers a **delete-account** action.
- **Protected routes:** dashboard, submit, admin, and the AI assistant require sign-in. Posting **reviews and reports** additionally requires a verified email.

Text inputs are validated on the client with **zod + react-hook-form** (`client/src/lib/validation.js`) and on the server with **zod** (`server/src/routes/*`), then sanitised (`sanitizeText`) before storage. User content is only ever rendered as text — there is no `dangerouslySetInnerHTML`.

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
| `npm run set-admin -w server -- <uid-or-email>` | Grant the admin claim (`--remove` revokes it) |
| `npm run check:i18n` | Fail if any en/bn/ur translation key is missing |

## Troubleshooting

**The banner says Firebase isn't configured.**
At least one `VITE_FIREBASE_*` value is missing. Copy `client/.env.example` to `client/.env`, fill all six values, and restart Vite (env changes require a restart).

**Reports or LearnMate return "Something went wrong".**
The API is not running or `VITE_API_URL` points to the wrong host. Check `http://localhost:8080/api/health`. In preview mode these features are expected to fail softly.

**LearnMate says "AI is not configured" even though `GROQ_API_KEY` is set.**
Put `GROQ_API_KEY` and `SETTINGS_ENCRYPTION_KEY` in `server/.env`, not `client/.env`. Vite only exposes `VITE_*` variables to the browser, so a non-prefixed key in `client/.env` is invisible to the Express server (and should never live there). Restart the API after editing the file. AI endpoints also require Firebase Admin credentials; without them the API returns `auth_unavailable` before it can reach Groq.

**Groq returns `404` / "model not found".**
The configured model has been retired by Groq. Check the current list at https://console.groq.com/docs/models, then set `GROQ_MODEL` in `server/.env` or update it in Admin → AI Settings. The old default `llama-3.3-70b-versatile` is no longer available; this project now defaults to `qwen/qwen3.8-27b`.

**`/admin` says "not authorized".**
Sign out and back in after running `set-admin` so the custom claim is refreshed (the admin route also force-refreshes the token). Admin access comes only from the `admin` custom claim — no Firestore field is involved.

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
- [ ] Confirm no YouTube video files are downloaded or rehosted; courses must use the official IFrame player and store only metadata/links.
- [ ] Confirm thumbnails are hosted on Cloudinary and that only the public cloud name and unsigned preset are present in client configuration.
- [ ] Keep a takedown log: date received, resource, action, and response.
- [ ] Publish a named DMCA/agent contact and a realistic response window.
- [ ] Add analytics/cookies disclosure if you introduce analytics later.
- [ ] Re-verify links and licences on a schedule (the UI shows `lastVerified`).

---

Built with care for learners in Bangladesh, India, and Pakistan. **No cracked software. No pirated PDFs. No paywalls pretending to be free.**
