# Meridian CRM

An AI-assisted CRM built as a portfolio/interview project — lead management for a sales team, with
automatic lead scoring, sentiment analysis on notes, AI-drafted replies, live real-time notifications,
and role-based access control (Admin vs Sales Rep).

## Architecture

| Layer | Tech | Role |
|---|---|---|
| Frontend | React + Tailwind CSS (Vite) | Dashboard, lead list/detail, team admin |
| Backend | Node.js + Express | REST API |
| Database | MongoDB + Mongoose | Users, leads, notes, activity |
| Auth | JWT | Login sessions, protected routes |
| AI | OpenAI API + LangChain (`@langchain/openai`) | Lead scoring, note sentiment, auto-reply drafts |
| Real-time | Socket.io | Live "new lead" / "lead scored" notifications |
| Async queue | Bull + Redis | Runs AI scoring in the background, off the request path |
| RBAC | Custom Express middleware | Admin (see/manage everything) vs Sales Rep (own + unassigned leads only) |
| Deploy | Docker + docker-compose | `mongo`, `redis`, `api`, `worker`, `client` (nginx) services |

**Request flow for a new lead:** the API saves the lead and immediately responds (never blocks on AI),
enqueues a `score` job on the Bull/Redis queue, and publishes a `lead:new` event over Redis pub/sub.
A separate **worker process** picks up the job, calls the AI provider, saves the score back to Mongo,
and publishes `lead:scored`. The API process's Socket.io server is subscribed to that same Redis
channel and relays both events to connected browsers in real time — so a rep sees the new lead appear,
then sees its AI score fill in a few seconds later, with no page refresh.

## AI mode: mock vs live

The AI layer (`server/src/services/ai.js`) has two implementations behind one interface:

- **No `OPENAI_API_KEY` set** → deterministic mock scoring/sentiment/replies. The app is fully
  functional and demoable for free, with no external calls.
- **`OPENAI_API_KEY` set** → real calls via LangChain's `ChatOpenAI`, using `withStructuredOutput`
  (Zod schemas) for lead scoring and sentiment, so the model's output is parsed reliably.

Every AI response includes a `mock: true/false` flag, and the UI labels mock output so it's never
mistaken for a live model call.

## Roles

- **Admin**: sees every lead, can reassign leads to reps, manages the team roster (`/team`).
- **Sales Rep**: only sees leads assigned to them or unassigned, cannot reassign leads to other reps,
  cannot manage users. Enforced server-side (`server/src/middleware/rbac.js`), not just hidden in the UI.

## Running it locally (no Docker)

Requires Node.js 18+, MongoDB, and a Redis-compatible server (e.g. [Memurai](https://www.memurai.com/)
on Windows) running locally.

```bash
npm run install:all         # installs server + client dependencies
cp server/.env.example server/.env   # then fill in JWT_SECRET etc.
npm run seed                # creates the 3 login accounts, leaves the leads list empty
npm run dev                 # runs the API, the AI worker, and the frontend together
```

Leads start empty so you can add your own. If you want a populated CRM to demo (e.g. for an
interview), run `npm run seed:demo` instead — it adds 24 realistic sample leads with notes and
queues them for AI scoring. Either way, `npm run seed` always resets the 3 accounts below and wipes
existing leads first, so re-run it any time you want a clean slate.

Open **http://localhost:5173**.

**Demo logins:**
| Email | Password | Role |
|---|---|---|
| admin@meridiancrm.com | Admin@123 | Admin |
| james@meridiancrm.com | Sales@123 | Sales Rep |
| priya@meridiancrm.com | Sales@123 | Sales Rep |

To enable live AI calls, put a real key in `server/.env`:
```
OPENAI_API_KEY=sk-...
```

## Running it with Docker

```bash
cp .env.example .env        # fill in real random values for the secrets
docker compose up --build
docker compose run --rm seed   # one-time: seed demo data
```

Open **http://localhost:8080**. The `client` container (nginx) serves the built React app and reverse-proxies
`/api/*` and `/socket.io/*` to the `api` container, so the browser never talks to Mongo/Redis/the API ports directly.

## Project layout

```
server/src/
  models/       Mongoose schemas (User, Lead, Notification)
  routes/       auth, users, leads, dashboard
  middleware/   auth.js (JWT), rbac.js (role + data scoping)
  services/ai.js  OpenAI/LangChain provider + mock fallback
  queues/aiQueue.js  Bull queue definition (shared by api + worker)
  socket/       Socket.io server + Redis pub/sub bridge
  server.js     API process entry point
  worker.js     Background AI worker entry point (separate process)
  seed.js       Deterministic demo data

client/src/
  pages/        Login, Dashboard, Leads, Team
  components/   Sidebar, StatusBadge, Avatar, StatTile, Layout, ToastStack
  context/      AuthContext, SocketContext
```

## Security notes

- Passwords are hashed with bcrypt; JWTs are signed with a secret that must be a long random string
  (generate one, never reuse the example value).
- All secrets (`JWT_SECRET`, `OPENAI_API_KEY`, Mongo/Redis credentials) are read from environment
  variables / `.env` files, which are gitignored — never hardcoded in source.
- The Docker Mongo and Redis services require authentication (username/password, and a Redis
  `requirepass`), configured via the root `.env` — don't run them without credentials in any shared
  environment.
- `legacy-sqlite-mvp/` is an earlier iteration of this project (SQLite-based) kept for reference; it is
  not part of the running app.

## Deploying (Vercel + Render)

The API uses long-lived WebSocket connections and a Bull worker, which don't fit Vercel's serverless
model, so the stack is split:

| Piece | Host | Notes |
|---|---|---|
| React client (`client/`) | **Vercel** | Root directory `client`, framework Vite. `client/vercel.json` handles SPA routing. |
| API (+ embedded AI worker) | **Render** free web service | Defined in `render.yaml`. `EMBED_WORKER=true` runs the queue worker in the API process. |
| Redis | Render Key Value (free) | Created by the same Blueprint; `REDIS_URL` is wired automatically. |
| MongoDB | MongoDB Atlas (free M0) | Dedicated DB user; set `MONGO_URI` in Render. |

1. Create the Atlas cluster, then deploy `render.yaml` as a Blueprint and enter `MONGO_URI` and
   `CLIENT_ORIGIN` (your Vercel URL) when prompted.
2. Seed once from a Render shell: `npm run seed:demo`.
3. In Vercel, set:
   - `VITE_API_URL=https://<your-api>.onrender.com/api`
   - `VITE_SOCKET_URL=https://<your-api>.onrender.com`
4. Optional: set `OPENAI_API_KEY` for live AI; otherwise it runs in mock mode.

`CLIENT_ORIGIN` accepts a comma-separated list, so a custom domain and preview URLs can coexist. On a
paid plan you can split the worker back out with `npm run worker` as a background worker.
