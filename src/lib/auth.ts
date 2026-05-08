/**
 * Admin authentication — simple password cookie.
 * Password set via ADMIN_PASSWORD env var (defaults to "ADMIN" if not set).
 * In production, always set a strong ADMIN_PASSWORD.
 */

export const ADMIN_COOKIE = "minthon_admin_session";
export const SESSION_VALUE = "authenticated";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "ADMIN";
}

export function isValidPassword(input: string): boolean {
  return input === getAdminPassword();
}
