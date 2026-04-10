# Nexus Pusher

A modern web UI for uploading artifacts to a local [Sonatype Nexus Repository](https://www.sonatype.com/products/sonatype-nexus-repository) — no CLI knowledge required.

> **Architecture:** 100% frontend — no backend server. The app calls the Nexus REST API v1 directly from the browser using `POST /service/rest/v1/components`.

## Supported Repository Types

| Type   | File Format              | Notes |
|--------|--------------------------|-------|
| Maven  | `.jar`, `.war`, `.pom`   | Requires groupId, artifactId, version |
| NPM    | `.tgz`                   | Standard `npm pack` output |
| NuGet  | `.nupkg`                 | |
| PyPI   | `.whl`, `.tar.gz`        | |
| Docker | `.tar`                   | ⚠️ Not supported via browser API — must use `docker push` |
| Yum    | `.rpm`                   | Optionally set target directory |
| Apt    | `.deb`                   | |
| Helm   | `.tgz`                   | |
| Raw    | Any file                 | Set target directory in options |

## Prerequisites

### Enable CORS in Nexus

The browser needs permission to call your Nexus server cross-origin. Do this once:

1. Log into Nexus as admin
2. Go to **Administration → System → Capabilities**
3. Click **Create capability** → select **CORS**
4. Set **Allowed Origins** to your frontend URL (e.g. `http://localhost:5173`) or `*` for local use
5. Save

> On older Nexus versions (< 3.x) this may be under **Administration → Security → Realms**.

## Quick Start

### Option 1: Docker

```bash
git clone https://github.com/NoobaHooba/nexus-pusher.git
cd nexus-pusher
docker-compose up --build
```

Open [http://localhost:5173](http://localhost:5173).

### Option 2: Local dev

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Configuration

On first launch the Settings modal opens automatically. Enter:
- **Nexus URL** — e.g. `http://192.168.1.100:8081`
- **Username / Password** — Nexus credentials

Settings are saved in `localStorage` (browser, per-device). Repository names are set per format inline on the type selector.

## Upload Flow

1. Configure Nexus URL + credentials in Settings (once, auto-prompted on first visit)
2. Click a repository type (Maven, NPM, Helm, etc.)
3. Enter the Nexus repository name in the inline field that appears
4. Fill in any type-specific options (Maven: groupId/artifactId/version, Raw: directory, etc.)
5. Drag & drop files or click **Select Local Assets**
6. Monitor upload progress in the Live Queue — failed uploads show the real Nexus error message

## How It Works

All uploads go directly to:
```
POST <nexus-url>/service/rest/v1/components?repository=<repo-name>
```
with `multipart/form-data` fields specific to each format (e.g. `maven2.groupId`, `npm.asset`, `helm.asset`).
Progress is tracked via `XMLHttpRequest.upload.onprogress`.

## Docker Note

Docker image uploads require the Docker registry protocol and cannot be done from a browser. Use:
```bash
docker tag <image> <nexus-host>:<port>/<name>:<tag>
docker push <nexus-host>:<port>/<name>:<tag>
```
