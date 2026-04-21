# Closed Side Checklist

Use this after copying the repo bundle into the closed network.

## Copy-Paste Block

```bash
sha256sum -c nexus-pusher-airgap-*.tar.gz.sha256
tar -xzf nexus-pusher-airgap-*.tar.gz
cd nexus-pusher

sha256sum -c airgap/images/node-20-alpine.tar.gz.sha256

gunzip -c airgap/images/node-20-alpine.tar.gz | docker load

docker build -f backend/Dockerfile.offline -t docker.io/nexus-pusher-backend:latest ./backend
docker push docker.io/nexus-pusher-backend:latest

# Optional: if you already have your own PVC, change the claim name first.
# sed -i 's/claimName: nexus-pusher-data/claimName: YOUR_EXISTING_PVC/' openshift/backend-only.yaml

oc apply -f openshift/backend-only.yaml
oc get route nexus-pusher-backend
```

## After Deploy

- Serve `frontend/dist/` from your static web server.
- Open the app and set `Backend URL` to the `nexus-pusher-backend` route host.
- Set `Nexus URL` to your existing Nexus HA URL.
- Set your Nexus `Username` and `Password`.

## Optional Frontend Build

If you later want to build a frontend image in the closed environment too:

```bash
sha256sum -c airgap/images/nginx-alpine.tar.gz.sha256
gunzip -c airgap/images/nginx-alpine.tar.gz | docker load

docker build -f frontend/Dockerfile.offline -t docker.io/nexus-pusher-frontend:latest ./frontend
docker push docker.io/nexus-pusher-frontend:latest
```
