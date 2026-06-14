# GET /api/health

Health check endpoint. Returns `200 OK` when the Next.js app is running.

## Response

```json
{
  "status": "ok",
  "timestamp": "2026-06-14T12:00:00.000Z"
}
```

## Usage

Use this endpoint to:
- Verify your app is deployed and reachable
- Configure the API playground base URL
- Uptime monitoring (ping every 60s)

## Try It

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/"
/>
