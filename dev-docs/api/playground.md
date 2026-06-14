# Interactive API Playground

Test live requests against your deployed Next.js app. Enter the base URL of your deployment below.

## Health Check

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/"
/>

## Get Current Session

<ApiPlayground
  defaultEndpoint="/api/auth/session"
  defaultMethod="GET"
  liveAppPath="/dashboard"
/>

## Sign In

<ApiPlayground
  defaultEndpoint="/api/auth/signin"
  defaultMethod="POST"
  defaultBody='{"email":"user@example.com","password":"User123!","redirect":false}'
  liveAppPath="/login"
/>

## Sign In as Admin

<ApiPlayground
  defaultEndpoint="/api/auth/signin"
  defaultMethod="POST"
  defaultBody='{"email":"admin@example.com","password":"Admin123!","redirect":false}'
  liveAppPath="/login"
/>

---

## Notes

- **CORS:** Cross-origin requests work for endpoints that include CORS headers. If you see a CORS error, use the "Try in Live App" link to interact with the endpoint directly in the deployed app's context.
- **Session cookies:** Session cookies are not sent in cross-origin requests by default. Use the same browser session as your deployed app, or configure CORS with `credentials: include` on your Next.js deployment.
- **Server Actions:** Not included here — use the [Live Demo Gallery](/demo/) to test Server Actions in context.
