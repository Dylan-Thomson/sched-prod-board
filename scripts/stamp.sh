#!/usr/bin/env bash
# Copies app/ to dist/ with the build sha in the meta tag and footer.
set -euo pipefail
sha="${1:-$(git rev-parse HEAD)}"
rm -rf dist && cp -R app dist
sed -i.bak "s/__BUILD_SHA__/${sha}/g" dist/index.html && rm dist/index.html.bak
echo "stamped ${sha}"
