Created a transport archive with the app images here:

[nexus-pusher-images-20260420-210102.tar.gz](/home/yahavc/projects/nexus/nexus-pusher/airgap/images/nexus-pusher-images-20260420-210102.tar.gz)  
Checksum: [nexus-pusher-images-20260420-210102.tar.gz.sha256](/home/yahavc/projects/nexus/nexus-pusher/airgap/images/nexus-pusher-images-20260420-210102.tar.gz.sha256)

It’s `204M` and contains the current frontend and backend images:
- `nexus-pusher-backend:latest`
- `nexus-pusher-frontend:latest`

In the closed environment, use:

```bash
sha256sum -c nexus-pusher-images-20260420-210102.tar.gz.sha256
docker load -i nexus-pusher-images-20260420-210102.tar.gz
docker push docker.io/nexus-pusher-backend:latest
docker push docker.io/nexus-pusher-frontend:latest
```

If you want, I can also package the base images (`node:20-alpine` and `nginx:alpine`) so you can still do offline rebuilds there, not just load and push the final app images.
