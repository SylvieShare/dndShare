#!/usr/bin/env bash
# Certbot deploy hook: make nginx serve the renewed certificate.
set -euo pipefail
nginx -t
systemctl reload nginx
