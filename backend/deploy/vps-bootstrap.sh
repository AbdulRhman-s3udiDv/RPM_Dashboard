#!/usr/bin/env bash
# One-time setup on a fresh Hostinger VPS (Ubuntu/Debian).
# Run once as root: bash vps-bootstrap.sh
set -euo pipefail

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

mkdir -p /opt/rpmcares-backend
echo "Now copy backend/docker-compose.yml to /opt/rpmcares-backend/docker-compose.yml"
echo "and create /opt/rpmcares-backend/.env with production values (see backend/.env.example)."
