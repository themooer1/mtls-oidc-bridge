import type { ClientsBackend } from "./client";
import type { IssuerInput } from "@openauthjs/openauth/issuer";

type ClientRedirectVerifier = IssuerInput<{}, {}, any>["allow"]
type ClientRedirectVerifierBuilder = (backend: ClientsBackend) => ClientRedirectVerifier;

// Verifies that a clients /authorize redirect uses an allowed redirect_uri
export const makeClientRedirectVerifier: ClientRedirectVerifierBuilder =
    (backend: ClientsBackend) =>
        async (input) => {
            const client = await backend.getClient(input.clientID);

            if (null === client)
                // This client isn't registered
                return false

            return client.redirect_uri === input.redirectURI
        }
