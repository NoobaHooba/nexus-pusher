# Connected Side Checklist

Use this on the connected machine before taking the repo into the closed network.

## Copy-Paste Block

```bash
cd /path/to/nexus-pusher

mkdir -p airgap/images

docker save node:20-alpine | gzip > airgap/images/node-20-alpine.tar.gz

sha256sum airgap/images/node-20-alpine.tar.gz > airgap/images/node-20-alpine.tar.gz.sha256

./scripts/prepare-airgap-bundle.sh

LATEST_BUNDLE="$(ls -1t airgap/nexus-pusher-airgap-*.tar.gz | head -n1)"
sha256sum "$LATEST_BUNDLE" > "$LATEST_BUNDLE.sha256"

printf 'Take these files into the closed network:\n%s\n%s\n' \
  "$LATEST_BUNDLE" \
  "$LATEST_BUNDLE.sha256"
```

Notes:

- The base image archives under `airgap/images/` are included inside the repo bundle created by `./scripts/prepare-airgap-bundle.sh`.
- If the closed environment already has `node:20-alpine`, you can skip the `docker save` line.
- For your deployment model, you do not need the frontend image bundle if you are serving `frontend/dist/` as static files.
- Only export `nginx:alpine` if you later decide to build a frontend image in the closed network.
