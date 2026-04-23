# Nexus Pusher

Nexus Pusher is a developer-focused UI for publishing artifacts to Sonatype Nexus Repository Manager with less manual typing and less Nexus navigation overhead.

It keeps the deployer-owned infrastructure concerns on the server side and keeps the user-owned login and workflow preferences in the browser. The product goal is simple: pick a format, drop files, review inferred metadata, and publish.

## What Problem This Solves

Nexus is powerful, but routine uploads are noisy:

- Maven coordinates often have to be typed manually.
- Repository selection is repetitive.
- Duplicate checks are easy to miss.
- Browser links frequently need internal Nexus knowledge.

This app wraps those tasks in a guided upload flow with preflight inspection, repository suggestions, upload history, search, and Nexus browse links.

## Current Product Model

- Primary audience: developers uploading artifacts
- Usage model: personal browser session
- Deployer-managed config:
  - Nexus API base URL
  - Nexus browser URL
  - backend host and proxying
  - persistent history volume
- User-managed state:
  - Nexus username
  - Nexus password
  - selected page and upload format
  - recent repositories, favorites, search state, and upload preferences

## Repo Layout

```text
.
├── README.md
├── docker-compose.yml
├── airgap/
├── backend/
│   └── src/
│       ├── app/
│       ├── features/
│       │   ├── browse/
│       │   ├── health/
│       │   ├── history/
│       │   ├── ldap/
│       │   ├── preflight/
│       │   ├── runtime-config/
│       │   ├── upload/
│       │   └── validate/
│       └── shared/
│           ├── artifacts/
│           ├── http/
│           ├── nexus/
│           └── persistence/
├── frontend/
│   └── src/
│       ├── app/
│       ├── features/
│       │   ├── browser/
│       │   ├── history/
│       │   ├── ldap/
│       │   └── upload/
│       └── shared/
│           ├── components/
│           ├── hooks/
│           └── lib/
├── openshift/
├── proxy/
└── scripts/
```

### Folder ownership

- `frontend/src/app`: app shell state, runtime config loading, login state, top-level layout
- `frontend/src/features/*`: feature-owned pages, storage, and hooks
- `frontend/src/shared/*`: reusable UI, hooks, and API helpers
- `backend/src/app`: backend bootstrap and config
- `backend/src/features/*`: route-owned API surfaces and feature services
- `backend/src/shared/*`: Nexus HTTP helpers, artifact inspection, SQLite persistence

## Supported Repository Types

| Type | Upload path |
| --- | --- |
| Maven | Browser upload with inferred coordinates |
| NPM | Browser upload with tarball metadata inspection |
| NuGet | Browser upload with `.nuspec` inspection |
| PyPI | Browser upload with filename-based package inference |
| Helm | Browser upload with `Chart.yaml` inspection |
| Yum | Browser upload |
| Apt | Browser upload |
| Raw | Browser upload |
| Docker | CLI push only |

Docker is intentionally not uploaded from the browser UI. The app only gives guidance for Docker registry usage.

## Upload Flow

The current upload flow is preflight-driven:

1. Select a repository format.
2. Drop one or more files.
3. The backend inspects each file and infers metadata where possible.
4. The UI shows detected fields, missing fields, duplicate warnings, and ranked repository suggestions.
5. The user confirms only the missing or overridden values.
6. The backend uploads and returns normalized results with Nexus browse links.

## Browser-Stored User State

The browser stores:

- login username and password
- theme
- active page
- active upload format
- repo names per format
- upload favorites and recent repos
- upload history shortcuts
- browser search, filters, sort state, and recent searches
- history page filters and pagination state

This state lives in `localStorage`. It is intentionally browser-local and is not shared between users.

## Runtime Configuration Model

### Deployer-managed environment

The backend exposes runtime config to the frontend from `/api/runtime-config`.

Important environment variables:

- `PORT`: backend listen port, default `3001`
- `DATA_DIR`: directory for SQLite upload history
- `NEXUS_URL`: Nexus API URL reachable from the backend
- `NEXUS_BROWSER_URL`: Nexus URL reachable from the user’s browser
- `DOCKER_REGISTRY`: optional Docker registry hint shown in the UI

Typical container values:

```env
PORT=3001
DATA_DIR=/app/data
NEXUS_URL=http://nexus:8081
NEXUS_BROWSER_URL=http://localhost:8081
```

### User-managed login

Users only provide:

- `username`
- `password`

The user does not configure Nexus routing in the UI.

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run build
```

For interactive development:

```bash
cd frontend
npm run dev
```

### Backend

```bash
cd backend
npm install
npm start
```

Useful local env overrides:

```bash
PORT=3001
DATA_DIR=./data-local
NEXUS_URL=http://localhost:8081
NEXUS_BROWSER_URL=http://localhost:8081
```

In non-production mode, the backend falls back to `backend/data/` if `DATA_DIR` is unset.

## Docker Compose Workflow

Bring up the stack:

```bash
docker compose up --build
```

Current compose services:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

The provided `docker-compose.yml` expects an external Docker network named `nexus-net`, so the backend can talk to an existing Nexus container or service on that network.

Example runtime values in compose:

- backend talks to Nexus at `http://nexus:8081`
- browser opens Nexus at `http://localhost:8081`

## Deployment Notes

- The backend is the source of truth for Nexus routing.
- The browser should normally call the backend through relative `/api`.
- If you serve the frontend from an external reverse proxy, proxy `/api` to the backend.
- `NEXUS_URL` must be reachable from the backend container or pod.
- `NEXUS_BROWSER_URL` must be reachable from the user’s browser.
- Docker uploads remain CLI-only.

### Optional frontend build-time override

If your deployment cannot proxy `/api`, the frontend still supports `VITE_BACKEND_URL` at build time. That is a deployer concern, not a user-facing setting.

## OpenShift Notes

OpenShift manifests live under `openshift/`:

- `openshift/full-stack.yaml`
- `openshift/backend-only.yaml`
- `openshift/README.md`

Operational assumptions:

- mount writable storage at `/app/data`
- keep `DATA_DIR=/app/data`
- expose frontend and backend through routes as needed
- set `NEXUS_URL` and `NEXUS_BROWSER_URL` per environment

## Air-Gap Workflow

Artifacts for the disconnected workflow live under `airgap/`.

Preparation script:

```bash
./scripts/prepare-airgap-bundle.sh
```

Reference checklists:

- `airgap/CONNECTED_SIDE_CHECKLIST.md`
- `airgap/CLOSED_SIDE_CHECKLIST.md`

The script prepares offline-friendly assets, vendored dependencies, and transfer archives for closed-network builds.

## API Overview

Public API surfaces used by the frontend:

- `POST /api/upload/:type`
- `POST /api/preflight/:type`
- `POST /api/browse/repos`
- `POST /api/browse/search`
- `POST /api/browse/asset`
- `GET /api/history`
- `DELETE /api/history`
- `POST /api/ldap/info`
- `POST /api/ldap/users`
- `POST /api/validate`
- `GET /api/health`
- `GET /api/runtime-config`

Removed legacy routes:

- `/api/settings`
- `/api/check-duplicate`

Duplicate checks now live inside preflight instead of as a separate public endpoint.

## Known Limitations

- Docker image uploads are not handled in-browser.
- Some package formats still rely on filename conventions when archive metadata is unavailable.
- The app stores credentials in browser `localStorage` because the current model is a personal browser session.
- LDAP views are still present but are not the primary product focus.
- Backend startup requires the native `better-sqlite3` dependency to match the target runtime.

## Troubleshooting

### Search or history links open the wrong Nexus host

Set `NEXUS_BROWSER_URL` to the browser-reachable Nexus address, for example:

```env
NEXUS_BROWSER_URL=http://localhost:8081
```

### Backend can’t reach Nexus but the browser can

This usually means `NEXUS_URL` points to a browser hostname instead of a Docker or cluster-reachable hostname. Use the backend-reachable service name or internal route there.

### Frontend build fails because of Rollup native dependency issues

Install dependencies cleanly in the target environment and ensure the matching optional Rollup native package is available for that platform.

### The UI behaves strangely after a refactor or deployment change

Clear browser `localStorage` for the app origin and reload. The app now validates stored state more aggressively, but stale values can still survive across major changes.

## Development Conventions

- Keep frontend feature logic inside `frontend/src/features/<feature>`.
- Keep shared frontend helpers under `frontend/src/shared`.
- Keep backend routes thin and feature-owned.
- Put backend cross-feature infrastructure under `backend/src/shared`.
- Prefer backend-side artifact inspection over frontend-side parsing.
- Centralize `localStorage` access in storage modules instead of ad hoc page code.
- Remove dead code instead of leaving shadow components or unused routes behind.

## Verification

Useful checks after structural changes:

```bash
cd frontend && npm run build
cd ../backend && node -e "require('./src/app/createApp')"
```
