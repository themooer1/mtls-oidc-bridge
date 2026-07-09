import { issuer, type IssuerMetadata } from "@openauthjs/openauth/issuer";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { subjects } from "./subjects";
import { TrustedHeaderProvider } from "./provider/provider";
import { MissingUserError, type UserBackend } from "./users/users";
import { makeClientRedirectVerifier } from "./clients/verifier";
import type { ClientsBackend as ClientBackend } from "./clients/client";
import { createHeaderParser } from "./provider/header/factory";
import type { ProviderConfig } from "./provider/config";

export type EndpointMetadataConfig = Pick<
    IssuerMetadata,
    "issuerUrl" | "publicBaseUrl" | "backchannelBaseUrl"
>;

const oidcMetadata = (config: EndpointMetadataConfig): IssuerMetadata => ({
    ...config,
    scopesSupported: ["openid", "profile", "email"],
    claimsSupported: ["sub", "name", "email", "preferred_username"],
});

/**
 * Build the OpenOIDC issuer app.
 *
 * File-backed users and clients stay in this connector. Protocol behavior such
 * as token endpoint client authentication, ID Tokens, metadata, and UserInfo is
 * delegated to the OpenOIDC fork.
 */
export function createApp(
    providerConfig: ProviderConfig,
    userBackend: UserBackend,
    clientBackend: ClientBackend,
    endpointConfig: EndpointMetadataConfig = {},
) {
    return issuer({
        providers: {
            proxy_header: TrustedHeaderProvider({ header: providerConfig.userCertificateHeader, getUserIdentifier: createHeaderParser(providerConfig)}),
        },
        storage: MemoryStorage(),
        subjects,
        success: async (ctx, value) => {
            const claims = await userBackend.getClaims(value.claims.identifier);

            if (null === claims)
            {
                throw new MissingUserError();
            }

            return ctx.subject(
                "user",
                claims,
                { subject: claims.sub },
            )
        },
        allow: makeClientRedirectVerifier(clientBackend),
        metadata: oidcMetadata(endpointConfig),
        clientAuth: async ({ clientID, clientSecret, method }) => {
            const client = await clientBackend.getClient(clientID);
            if (!client)
                return false;

            if (client.type === "public")
                return method === "none" && clientSecret === undefined;

            if (!clientSecret)
                return false;

            return Bun.password.verify(clientSecret, client.hashed_secret);
        },
    });
}
