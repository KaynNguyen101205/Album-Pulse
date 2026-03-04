import 'server-only';

export const SPOTIFY_PROFILE_SCOPES = ['user-read-private', 'user-read-email'] as const;
export const SPOTIFY_RECOMMENDATION_SCOPES = [
  'user-top-read',
  'user-read-recently-played',
] as const;

export const SPOTIFY_LOGIN_SCOPES = [
  ...SPOTIFY_PROFILE_SCOPES,
  ...SPOTIFY_RECOMMENDATION_SCOPES,
] as const;

export function serializeScopes(scopes: readonly string[]): string {
  const seen = new Set<string>();
  const uniqueScopes: string[] = [];

  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    uniqueScopes.push(trimmed);
  }

  return uniqueScopes.join(' ');
}

export function getMissingScopes(
  grantedScopeText: string,
  requiredScopes: readonly string[]
): string[] {
  const granted = new Set(
    grantedScopeText
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
  );

  return requiredScopes.filter((scope) => !granted.has(scope));
}
