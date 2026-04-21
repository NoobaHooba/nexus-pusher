#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend"
AIRGAP_DIR="${ROOT_DIR}/airgap"
STAMP="$(date +%Y%m%d-%H%M%S)"

FRONTEND_IMAGE="nexus-pusher-frontend-airgap-builder:${STAMP}"
BACKEND_IMAGE="nexus-pusher-backend-airgap:${STAMP}"

FRONTEND_CID=""
BACKEND_CID=""

cleanup() {
  if [[ -n "${FRONTEND_CID}" ]]; then docker rm -f "${FRONTEND_CID}" >/dev/null 2>&1 || true; fi
  if [[ -n "${BACKEND_CID}" ]]; then docker rm -f "${BACKEND_CID}" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

echo "Building frontend builder image with online dependency install..."
docker build \
  --build-arg INSTALL_MODE=online \
  --target builder \
  -t "${FRONTEND_IMAGE}" \
  "${FRONTEND_DIR}"

echo "Building backend runtime image with online dependency install..."
docker build \
  --build-arg INSTALL_MODE=online \
  -t "${BACKEND_IMAGE}" \
  "${BACKEND_DIR}"

echo "Refreshing vendored frontend dependencies and dist bundle..."
rm -rf "${FRONTEND_DIR}/node_modules" "${FRONTEND_DIR}/dist" "${FRONTEND_DIR}/package-lock.json"
FRONTEND_CID="$(docker create "${FRONTEND_IMAGE}")"
docker cp "${FRONTEND_CID}:/app/node_modules" "${FRONTEND_DIR}/node_modules"
docker cp "${FRONTEND_CID}:/app/package-lock.json" "${FRONTEND_DIR}/package-lock.json"
docker cp "${FRONTEND_CID}:/app/dist" "${FRONTEND_DIR}/dist"

echo "Refreshing vendored backend dependencies..."
rm -rf "${BACKEND_DIR}/node_modules" "${BACKEND_DIR}/package-lock.json"
BACKEND_CID="$(docker create "${BACKEND_IMAGE}")"
docker cp "${BACKEND_CID}:/app/node_modules" "${BACKEND_DIR}/node_modules"
docker cp "${BACKEND_CID}:/app/package-lock.json" "${BACKEND_DIR}/package-lock.json"

mkdir -p "${AIRGAP_DIR}"
BUNDLE_PATH="${AIRGAP_DIR}/nexus-pusher-airgap-${STAMP}.tar.gz"

echo "Creating air-gap transfer bundle at ${BUNDLE_PATH}..."
tar \
  --exclude='.git' \
  --exclude='.codex' \
  --exclude='airgap/*.tar.gz' \
  -czf "${BUNDLE_PATH}" \
  -C "${ROOT_DIR}" \
  .

echo
echo "Air-gap bundle ready:"
echo "  ${BUNDLE_PATH}"
echo
echo "Vendored assets refreshed:"
echo "  ${FRONTEND_DIR}/node_modules"
echo "  ${FRONTEND_DIR}/package-lock.json"
echo "  ${FRONTEND_DIR}/dist"
echo "  ${BACKEND_DIR}/node_modules"
echo "  ${BACKEND_DIR}/package-lock.json"
