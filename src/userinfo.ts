import type { StorageAdapter } from "@openauthjs/openauth/storage/storage";
import { legacySigningKeys, signingKeys } from "@openauthjs/openauth/keys";
import type { Hono } from "hono";
import type { Context } from "hono";
import { jwtVerify } from "jose";

type AccessTokenPayload = {
    mode?: unknown;
    type?: unknown;
    properties?: unknown;
};

export type EndpointMetadataConfig = {
    issuerUrl?: string;
    publicBaseUrl?: string;
    backchannelBaseUrl?: string;
};

type ResolvedEndpointMetadata = {
    issuer: string;
    publicBase: string;
    backchannelBase: string;
};

const isRecord = (value: unknown): value is Record<string, string | number | boolean> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const issuerFor = (url: string): string => new URL(url).origin;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const normalizeEndpointConfig = (config: EndpointMetadataConfig = {}): EndpointMetadataConfig => ({
    issuerUrl: config.issuerUrl ? trimTrailingSlashes(config.issuerUrl) : undefined,
    publicBaseUrl: config.publicBaseUrl ? trimTrailingSlashes(config.publicBaseUrl) : undefined,
    backchannelBaseUrl: config.backchannelBaseUrl ? trimTrailingSlashes(config.backchannelBaseUrl) : undefined,
});

export const resolveEndpointMetadata = (
    requestUrl: string,
    config: EndpointMetadataConfig = {},
): ResolvedEndpointMetadata => {
    const normalized = normalizeEndpointConfig(config);
    const issuer = normalized.issuerUrl ?? issuerFor(requestUrl);

    return {
        issuer,
        publicBase: normalized.publicBaseUrl ?? issuer,
        backchannelBase: normalized.backchannelBaseUrl ?? issuer,
    };
};

const addDiscoveryCorsHeaders = (headers: Headers): void => {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST");
};

/**
 * Registers the OIDC UserInfo endpoint alongside metadata that advertises it.
 *
 * OpenAuth access tokens already contain the user claims returned by our backend
 * in the JWT's `properties` field. This endpoint verifies that bearer token with
 * OpenAuth's own storage-backed signing keys, then returns those embedded claims
 * as the UserInfo response for clients that expect a standard OIDC endpoint.
 */
export const registerUserInfoRoutes = (
    app: Hono,
    storage: StorageAdapter,
    endpointConfig: EndpointMetadataConfig = {},
): void => {
    const discovery = (requestUrl: string) => {
        const endpoints = resolveEndpointMetadata(requestUrl, endpointConfig);
        return {
            issuer: endpoints.issuer,
            authorization_endpoint: `${endpoints.publicBase}/authorize`,
            token_endpoint: `${endpoints.backchannelBase}/token`,
            jwks_uri: `${endpoints.backchannelBase}/.well-known/jwks.json`,
            userinfo_endpoint: `${endpoints.backchannelBase}/userinfo`,
            response_types_supported: ["code", "token"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            scopes_supported: ["openid", "profile", "email"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["ES256"],
            token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
            claims_supported: ["sub", "name", "email", "preferred_username"],
        };
    };

    app.get("/.well-known/oauth-authorization-server", (c) => {
        addDiscoveryCorsHeaders(c.res.headers);
        return c.json(discovery(c.req.url));
    });

    app.get("/.well-known/openid-configuration", (c) => {
        addDiscoveryCorsHeaders(c.res.headers);
        return c.json(discovery(c.req.url));
    });

    const userInfo = async (c: Context) => {
        const authorization = c.req.header("authorization");
        let token = authorization?.match(/^Bearer (.+)$/i)?.[1];
        if (!token && c.req.method === "POST") {
            const form = await c.req.formData();
            token = form.get("access_token")?.toString();
        }
        if (!token)
            return c.json({ error: "invalid_token" }, 401);

        const keys = [
            ...await signingKeys(storage),
            ...await legacySigningKeys(storage),
        ];

        const verified = await jwtVerify<AccessTokenPayload>(
            token,
            async (protectedHeader) => {
                const key = keys.find((candidate) => candidate.id === protectedHeader.kid);
                if (!key)
                    throw new Error("Unknown signing key");

                return key.public;
            },
            { issuer: resolveEndpointMetadata(c.req.url, endpointConfig).issuer },
        ).catch(() => null);
        if (!verified)
            return c.json({ error: "invalid_token" }, 401);

        const { payload } = verified;

        if (payload.mode !== "access" || payload.type !== "user" || !isRecord(payload.properties))
            return c.json({ error: "invalid_token" }, 401);

        return c.json(payload.properties);
    };

    app.get("/userinfo", userInfo);
    app.post("/userinfo", userInfo);
};
