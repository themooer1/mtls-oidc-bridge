import { OauthError } from '@openauthjs/openauth/error';
import * as v from 'valibot'

/**
 * UserBackend abstraction — look up a user's claims from an identifier
 * (e.g. the value of a trusted proxy header).
 *
 * @packageDocumentation
 */


export const UserClaimsSchema = v.intersect([
    v.object({
        "sub": v.string(),
    }),
    v.record(v.string(), v.union([v.string(), v.number(), v.boolean()])),
]);

/** The normalised claims returned for any authenticated user. */
export type UserClaims = v.InferOutput<typeof UserClaimsSchema>;

/**
 * A backend that can resolve a raw identifier (e.g. a certificate subject)
 * into OIDC claims.
 */
export interface UserBackend {
    getClaims(identifier: string): Promise<UserClaims | null>;
}

// class UserBackendBase implements UserBackend {
//     async getClaims(identifier: string): Promise<UserClaims> {
//         // Calculate "sub" claim as the hash of the identifier header
//         // because it's unique to the user, and this method of generating
//         // it is infallible.
//         const hasher = new Bun.CryptoHasher("sha3-256")
//         hasher.update(identifier);
//         const sub = hasher.digest("hex")
//     }
    
// }

export class MissingUserError extends OauthError {
  constructor() {
    super("access_denied", "mTLS subject header doesn't correspond to a user in the database.")
  }
}


