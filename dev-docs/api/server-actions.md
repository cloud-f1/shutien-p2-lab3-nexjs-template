# Server Actions Reference

Server Actions (`"use server"`) run on the server and are called directly from React components.

> **Cross-Origin Note:** Server Actions cannot be called cross-origin. Use the [Live Demo Gallery](/demo/) to test them in context, or the API endpoints for cross-origin access.

## Pattern

All Server Actions use the `ActionResult` response envelope:

```ts
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }
```

## Account Actions (`@saas/account`)

### `updateProfile(data)`

Update the current user's display name.

```ts
// Signature
async function updateProfile(data: { name: string }): Promise<ActionResult>

// Example call (from a React component)
const result = await updateProfile({ name: 'Alice Smith' })
if (result.success) {
  // profile updated
} else {
  console.error(result.error)
}
```

### `changePassword(data)`

Change the current user's password. Requires the current password for verification.

```ts
async function changePassword(data: {
  currentPassword: string
  newPassword: string
}): Promise<ActionResult>
```

### `deleteAccount()`

Permanently delete the current user's account. This action is irreversible.

```ts
async function deleteAccount(): Promise<ActionResult>
```

## Admin Actions (`@saas/admin`)

> All admin actions require `role === 'admin'`. Lower roles receive a 403 response.

### `listUsers()`

Return all users in the system.

```ts
async function listUsers(): Promise<ActionResult<User[]>>

type User = {
  id: string
  email: string
  name: string | null
  role: 'viewer' | 'editor' | 'admin'
  createdAt: Date
}
```

### `updateUserRole(data)`

Change a user's role.

```ts
async function updateUserRole(data: {
  userId: string
  role: 'viewer' | 'editor' | 'admin'
}): Promise<ActionResult>
```

### `deleteUser(data)`

Permanently delete a user account.

```ts
async function deleteUser(data: { userId: string }): Promise<ActionResult>
```

## Try in Live App

Server Actions are best tested in the deployed app itself:

<DemoIframe path="/dashboard/settings" title="Account Settings — Server Actions" :height="400" />
