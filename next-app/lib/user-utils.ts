// Pure user-account helpers — NO db import (unit-testable in isolation).

/**
 * Checks whether a given account has a password (i.e. is not an OAuth-only
 * account). Returns an error message if `passwordHash` is falsy.
 */
export function assertHasPassword(passwordHash: string | null | undefined): string | null {
  if (!passwordHash) {
    return "OAuth 帳戶無法變更密碼。"
  }
  return null
}

/**
 * Verifies that `currentPasswordValid` is true (caller already ran bcrypt
 * compare). Returns an error message when the current password is wrong.
 */
export function assertCurrentPasswordValid(isValid: boolean): string | null {
  if (!isValid) {
    return "目前密碼錯誤。"
  }
  return null
}

/**
 * Validates that the new password is not identical to the current one.
 * (Optional UX guard — the schema already enforces strength; this prevents
 * a no-op change from silently "succeeding".)
 *
 * Returns an error message if identical, null if OK.
 */
export function assertPasswordChanged(
  currentPassword: string,
  newPassword: string,
): string | null {
  if (currentPassword === newPassword) {
    return "新密碼不能與目前密碼相同。"
  }
  return null
}
