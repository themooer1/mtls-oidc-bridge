import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { subjects } from "./subjects";
import { TrustedHeaderProvider } from "./provider/provider";
import { MissingUserError, type UserBackend } from "./users/users";
import { makeClientRedirectVerifier } from "./clients/verifier";
import type { ClientsBackend as ClientBackend } from "./clients/client";



/**
 * Build the OpenAuth issuer app.
 *
 * Accepts only what it actually needs so callers aren't coupled to a
 * particular config shape (env vars, CLI options, etc.).
 */
export function createApp(userCertificateHeader: string, userBackend: UserBackend, clientBackend: ClientBackend) {
    return issuer({
        providers: {
            proxy_header: TrustedHeaderProvider({ header: userCertificateHeader }),
        },
        storage: MemoryStorage(),
        subjects,
        success: async (ctx, value) => {
            const claims = await userBackend.getClaims(value.claims.header);

            if (null === claims)
            {
                throw new MissingUserError();
            }

            return ctx.subject(
                "user",
                claims
                
            )
        },
        allow: makeClientRedirectVerifier(clientBackend),
    });
}