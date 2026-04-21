# Nexus Pusher

A web UI and backend API for uploading artifacts into Sonatype Nexus Repository Manager.

## Architecture

- `frontend/`: React + Vite single-page app
- `backend/`: Express API used for uploads, browse, history, validation, and LDAP/access views
- `frontend/dist/`: static bundle that can be served by your own nginx in closed networks
- `backend/node_modules/` and `frontend/node_modules/`: vendored by the air-gap prep script for offline builds

By default the frontend talks to the backend through relative `/api`. If your nginx does not proxy `/api`, set `Backend URL` in the app settings or provide `VITE_BACKEND_URL` at build time so the browser can call the backend directly.

## Supported Repository Types

| Type   | Flow |
|--------|------|
| Maven  | Browser upload |
| NPM    | Browser upload |
| NuGet  | Browser upload |
| PyPI   | Browser upload |
| Yum    | Browser upload |
| Apt    | Browser upload |
| Helm   | Browser upload |
| Raw    | Browser upload |
| Docker | CLI push only |

Docker images are not uploaded through the browser UI in this deployment model. Use:

```bash
docker push <image>:<tag>
```

## Local Docker Compose

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

The bundled frontend nginx proxies `/api` to the `nexus-backend` service name.

## Air-Gap Preparation

Run this on a connected machine before moving the project into the closed network:

```bash
./scripts/prepare-airgap-bundle.sh
```

Exact handoff checklists for your repo-build-in-closed-network flow live in:

- `airgap/CONNECTED_SIDE_CHECKLIST.md`
- `airgap/CLOSED_SIDE_CHECKLIST.md`

That script will:

- build frontend and backend with online dependency install
- vendor `frontend/node_modules` and `backend/node_modules`
- copy generated `package-lock.json` files into both apps
- build `frontend/dist`
- create a transfer archive under `airgap/`

## Offline Builds

After the vendored dependencies have been prepared, build with offline mode:

```bash
docker build --build-arg INSTALL_MODE=offline -t nexus-pusher-backend ./backend
docker build --build-arg INSTALL_MODE=offline -t nexus-pusher-frontend ./frontend
```

If you want a backend build path with no `apk add` line at all, use:

```bash
docker build -f backend/Dockerfile.offline -t nexus-pusher-backend ./backend
```

If you want the same style for the frontend, use:

```bash
docker build -f frontend/Dockerfile.offline -t nexus-pusher-frontend ./frontend
```

To bake a direct backend URL into the frontend bundle, add:

```bash
docker build -f frontend/Dockerfile.offline \
  --build-arg VITE_BACKEND_URL=https://nexus-pusher-backend.apps.example.com \
  -t nexus-pusher-frontend ./frontend
```

If you are serving the frontend with your own nginx, you only need:

- the backend image
- the `frontend/dist/` directory
- `node:20-alpine` in the closed network if you plan to build the backend there

## External nginx

Your nginx can work in either mode:

1. serve `frontend/dist/` as static files
2. either proxy `/api` to `http://nexus-backend:3001`
3. or leave nginx unchanged and set the app's `Backend URL` to an external backend route

Example location block:

```nginx
location /api {
    proxy_pass         http://nexus-backend:3001;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_request_buffering off;
    proxy_buffering         off;
    proxy_connect_timeout   10s;
    proxy_send_timeout      600s;
    proxy_read_timeout      600s;
    client_max_body_size    1G;
}
```

## OpenShift Notes

- The backend expects writable storage at `/app/data` for the SQLite history database.
- Mount your PVC there and keep `DATA_DIR=/app/data`.
- The backend image permissions are set up for OpenShift-style random UIDs.
- The bundled frontend image now listens on `8080` so it can run under OpenShift's random UID model.
- Ready-to-apply manifests live under `openshift/`:
  - `openshift/backend-only.yaml`
  - `openshift/full-stack.yaml`
- `openshift/backend-only.yaml` now also creates a backend `Route` for frontends hosted outside OpenShift.
- In your environment, serving `frontend/dist/` from your own nginx is still a good path if you do not want the frontend running inside OpenShift.

## Configuration

Set these in the UI on first run:

- Backend URL
- Nexus URL
- Username
- Password

Settings are stored in browser `localStorage`.

## Closed-Network Runtime Assets

The frontend no longer depends on Google-hosted runtime assets:

- app logo is embedded locally
- fonts/icons are bundled through npm and the built frontend assets
