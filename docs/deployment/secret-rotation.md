# Secret Rotation Runbook

Zero-downtime JWT secret rotation using dual-key verification.

## How It Works

Both access tokens (`RotatingJWTStrategy`) and refresh tokens (`verify_refresh_token`) try the current secret first. If decoding raises `InvalidSignatureError` **and** a previous secret is configured, they retry with the previous key. Expired or malformed tokens fail immediately — no fallback.

## Rotation Steps

1. **Generate a new secret**: `openssl rand -hex 32`
2. **Set the previous key** to the current value:
   - `SECRET_KEY_PREVIOUS=<current SECRET_KEY>`
   - `REFRESH_SECRET_KEY_PREVIOUS=<current REFRESH_SECRET_KEY>`
3. **Set the new key**:
   - `SECRET_KEY=<new value>`
   - `REFRESH_SECRET_KEY=<new value>`
4. **Deploy** — new tokens use the new key; existing tokens verify via the previous key.
5. **Wait for token TTL** to expire (access: 15 min, refresh: 30 days).
6. **Remove previous keys** — clear `SECRET_KEY_PREVIOUS` and `REFRESH_SECRET_KEY_PREVIOUS`.
7. **Deploy again** to finalize.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Current access token signing key |
| `SECRET_KEY_PREVIOUS` | Old access key (rotation window only) |
| `REFRESH_SECRET_KEY` | Current refresh token signing key |
| `REFRESH_SECRET_KEY_PREVIOUS` | Old refresh key (rotation window only) |
