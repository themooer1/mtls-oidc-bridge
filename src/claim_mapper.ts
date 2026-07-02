/**
 * Maps the value of the HTTP header identifying the user and returns whatever information about the user
 * we want to put in their OIDC claims.
 */
export type ClaimMapper<Claims extends Record<string, string> = Record<string, string>> = (header: string) => Promise<Claims>;