/** Human codes avoid ambiguous characters (0, 1, I, O). Shared by UI and server. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
