# Nexus Pusher

A modern web UI for uploading artifacts to a local [Sonatype Nexus Repository](https://www.sonatype.com/products/sonatype-nexus-repository) — no CLI knowledge required.

![Nexus Pusher UI](https://lh3.googleusercontent.com/aida/ADBb0uhJAgGgzva0ScflAODe8l4LMeZezCQyPlBcHfUAH-CAxD_MYx7wvT5O-ITn9Abyf95i_KO-P8Bncj9y9pRJ23POSAynBfpNXXiBJGDd9Z5h9G1ApNqrk7ui-cSUcJeebjx_V-WcR0LuUhaiFKy4Kw0IyjBU0lTYciWLKOpJJrgl2YrNM_jWcLJaDgIyMbsCsproxqG7eN_j4owNPpSb2t9u3IuRwR4tVYZOCiy6RdLlYI3uuhzHUK0yeYOt7-aWN5NOTGHDCCBs4Q)

## Supported Repository Types

| Type   | File Format         | Notes |
|--------|---------------------|-------|
| Maven  | `.jar`, `.war`, `.pom` | Requires groupId, artifactId, version |
| NPM    | `.tgz`              | Standard npm pack output |
| NuGet  | `.nupkg`            | Uses NuGet v2 push API |
| PyPI   | `.whl`, `.tar.gz`   | Uses twine-compatible endpoint |
| Docker | `.tar`              | Requires Docker installed on backend host |
| Yum    | `.rpm`              | Optionally set target directory |
| Apt    | `.deb`              | Nexus Apt hosted repo |
| Helm   | `.tgz`              | Helm chart archives |
| Raw    | Any file            | Set target directory in options |

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/NoobaHooba/nexus-pusher.git
cd nexus-pusher
docker-compose up --build
```

Then open [http://localhost:5173](http://localhost:5173).

### Option 2: Manual

**Backend:**
```bash
cd backend
cp .env.example .env   # Edit with your Nexus defaults if desired
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Configuration

Click **Settings** in the sidebar or header to configure:
- **Nexus URL** — e.g. `http://192.168.1.100:8081`
- **Default Repo Name** — the Nexus repository name to upload into
- **Username / Password** — Nexus credentials

Settings are saved to `backend/settings.json` and pre-filled on page load.

## Upload Flow

1. Open the app and configure Nexus settings (once)
2. Select the target repository type (Maven, NPM, etc.)
3. Fill in any type-specific fields (Maven: groupId/artifactId/version, Docker: image name/tag, etc.)
4. Drag & drop files or click **Select Local Assets**
5. Files are queued and uploaded automatically — monitor progress in the Live Queue
6. Failed uploads can be retried with one click

## Architecture

```
nexus-pusher/
├── frontend/          React + Vite + Tailwind CSS
│   └── src/
│       ├── components/   UI components
│       └── hooks/        useUpload (queue management, axios uploads)
├── backend/           Node.js + Express
│   └── src/
│       ├── routes/       /api/upload/:type, /api/settings
│       └── uploaders/    One module per repo type
└── docker-compose.yml
```

## Notes

- **Docker uploads** require Docker to be installed on the machine running the backend, as they use `docker load` + `docker push`.
- Settings (Nexus URL/credentials) are stored in plaintext in `backend/settings.json`. Do not commit this file — it is gitignored.
- The backend uses `/tmp/nexus-pusher-uploads` as a temp staging area and cleans up automatically.
