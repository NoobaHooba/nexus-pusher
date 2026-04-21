# OpenShift Manifests

This directory gives you two deployment paths:

- `backend-only.yaml`: deploy only the API, PVC, service, and a backend `Route`. Use this when your own nginx serves `frontend/dist/`.
- `full-stack.yaml`: deploy backend, PVC, frontend, service, and an OpenShift `Route`.

## Before You Apply

1. Build and push the images you want OpenShift to run.
2. Update the image references in the YAML if your tags differ from:
   - `docker.io/nexus-pusher-backend:latest`
   - `docker.io/nexus-pusher-frontend:latest`
3. If your cluster does not have a default storage class, add `storageClassName` to the PVC.
4. If your registry needs auth, add `imagePullSecrets` to the `Deployment` specs.

## Apply

Backend only:

```bash
oc apply -f openshift/backend-only.yaml
```

Then point the frontend at the backend route host shown by:

```bash
oc get route nexus-pusher-backend
```

Full stack:

```bash
oc apply -f openshift/full-stack.yaml
```

If you use the full stack manifest, get the generated route with:

```bash
oc get route nexus-pusher
```

## Notes

- The backend stores its SQLite history DB on `/app/data`, so the PVC is required.
- The backend service name is `nexus-backend`, which matches the frontend proxy config.
- When the frontend is hosted outside OpenShift and cannot proxy `/api`, set `Backend URL` in the app settings to the `nexus-pusher-backend` route.
- The bundled frontend image listens on `8080` so it can run under OpenShift's random UID model.
- The app supports uploads up to `1G`, but your OpenShift router may still need cluster-side tuning if very large uploads are blocked before they reach the pod.
