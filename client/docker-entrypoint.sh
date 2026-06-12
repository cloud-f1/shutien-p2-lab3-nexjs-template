#!/bin/sh
# Runtime config injection at container start.

# 1. Nginx PORT templating — Cloud Run injects $PORT; default 3000 for Zeabur/local.
export PORT="${PORT:-3000}"
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# 2. VITE_API_URL injection into JS bundle.
# The JS bundle is built with a placeholder; this replaces it at container start.
# If VITE_API_URL is not set or is the placeholder, skip replacement.

if [ -n "$VITE_API_URL" ] && [ "$VITE_API_URL" != "__VITE_API_URL_PLACEHOLDER__" ]; then
  find /usr/share/nginx/html/assets -name '*.js' -exec \
    sed -i "s|__VITE_API_URL_PLACEHOLDER__|${VITE_API_URL}|g" {} +
fi

exec "$@"
