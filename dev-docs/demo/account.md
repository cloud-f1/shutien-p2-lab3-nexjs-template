# Account Settings Demo

The `@saas/account` module provides user profile management: display name, password change, and account deletion.

**Module:** `@saas/account` · **Route:** `/dashboard/settings` · [Docs](/modules/account) · [Install Guide](/modules/account#installation)

## Live Demo

<DemoIframe path="/dashboard/settings" title="Account Settings — Live Demo" :height="550" />

## Features

| Feature | Component | Server Action (`actions/user.ts`) |
|---------|-----------|--------------|
| Profile Form | `profile-form.tsx` | `updateProfile(prevState, formData)` |
| Password Change | `password-form.tsx` | `changePassword(prevState, formData)` |
| Delete Account | `delete-account-form.tsx` | `deleteAccount()` *(shipped with the `@saas/account` module)* |

## Server Actions

Test the account Server Actions in the live demo above, or see the [API Reference](/api/server-actions#account-actions) for signatures.

## Security

- Password change requires the current password for verification
- Account deletion is irreversible — a confirmation prompt is shown
- All actions call `requireAuth()` — any authenticated user (viewer/editor/admin) can manage their own account
- Users cannot modify other users' accounts (the user ID is derived from the session, never from the request body)
