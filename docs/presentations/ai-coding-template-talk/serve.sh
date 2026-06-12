#!/bin/bash
# Serve the talk deck over HTTP (required for data-markdown fetch + ES modules).
#
# Usage:
#   ./serve.sh              # dev mode — opens index.html (live markdown)
#   ./serve.sh talk         # built mode — opens talk.html (inlined)
#   ./serve.sh talk --build # rebuild talk.html first, then serve it

set -e
cd "$(dirname "$0")"

MODE="${1:-dev}"
DO_BUILD=false
[[ "$2" == "--build" ]] && DO_BUILD=true

# Pick target file
case "$MODE" in
  dev)  TARGET="index.html" ;;
  talk) TARGET="talk.html" ;;
  *) echo "Usage: ./serve.sh [dev|talk] [--build]"; exit 1 ;;
esac

# Optional rebuild before serving talk.html
if $DO_BUILD; then
  echo "Rebuilding talk.html..."
  bash build.sh
  echo ""
fi

# Find first free port in 8080..8090
PORT=""
for p in $(seq 8080 8090); do
  if ! lsof -iTCP:$p -sTCP:LISTEN -P -n >/dev/null 2>&1; then
    PORT=$p
    break
  fi
done
[[ -z "$PORT" ]] && { echo "No free port in 8080-8090"; exit 1; }

URL="http://localhost:$PORT/$TARGET"
echo "Serving $TARGET at $URL"
echo "Press Ctrl+C to stop."
echo ""

# Open browser after a short delay so the server is accepting connections
(sleep 0.5 && open "$URL") &

exec python3 -m http.server "$PORT"
