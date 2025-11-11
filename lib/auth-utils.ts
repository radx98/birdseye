/**
 * Check if a given Twitter user ID is an admin
 */
export function isAdmin(twitterId: string | undefined | null): boolean {
  if (!twitterId) return false;

  const adminIds = [
    process.env.ADMIN_ID_1,
    process.env.ADMIN_ID_2,
  ].filter(Boolean);

  return adminIds.includes(twitterId);
}

/**
 * Get admin IDs from environment variables
 */
export function getAdminIds(): string[] {
  return [
    process.env.ADMIN_ID_1,
    process.env.ADMIN_ID_2,
  ].filter(Boolean) as string[];
}
