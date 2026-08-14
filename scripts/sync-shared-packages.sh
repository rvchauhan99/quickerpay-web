#!/usr/bin/env bash
# Copy @quickerpay/money and @quickerpay/shared-types from the sibling API checkout.
# Those packages are authored in quickerpay-api; this repo keeps a working copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ROOT="${QP_API_ROOT:-$(cd "$ROOT/../QuickerPay" && pwd)}"

if [ ! -d "$API_ROOT/packages/money/src" ]; then
  echo "cannot find packages/money in $API_ROOT" >&2
  exit 1
fi

rsync -a --delete --exclude node_modules --exclude dist --exclude '*.tsbuildinfo' \
  "$API_ROOT/packages/money/" "$ROOT/packages/money/"
rsync -a --delete --exclude node_modules --exclude dist --exclude '*.tsbuildinfo' \
  "$API_ROOT/packages/shared-types/" "$ROOT/packages/shared-types/"
echo "copied money and shared-types from $API_ROOT"
