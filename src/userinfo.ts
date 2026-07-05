import type { StorageAdapter } from "@openauthjs/openauth/storage/storage";
import { legacySigningKeys, signingKeys } from "@openauthjs/openauth/keys";
import type { Hono } from "hono";
import { jwtVerify } from "jose";

type AccessTokenPayload = {
    mode?: unknown;
    type?: unknown;
    properties?: unknown;
};

const isRecord = (value: unknown): value is Record<string, string | number | boolean> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const issuerFor = (url: string): string => new URL(url).origin;

const addDiscoveryCorsHeaders = (headers: Headers): void => {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Access-Control-Allow-Methods", "GET");
};

/**
 * Registers the OIDC UserInfo endpoint alongside metadata that advertises it.
 *
 * OpenAuth access tokens already contain the user claims returned by our backend
 * in the JWT's `properties` field. This endpoint verifies that bearer token with
 * OpenAuth's own storage-backed signing keys, then returns those embedded claims
 * as the UserInfo response for clients that expect a standard OIDC endpoint.
 */
export const registerUserInfoRoutes = (app: Hono, storage: StorageAdapter): void => {
    const discovery = (requestUrl: string) => {
        const issuer = issuerFor(requestUrl);
        return {
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            userinfo_endpoint: `${issuer}/userinfo`,
            response_types_supported: ["code", "token"],
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

    app.get("/userinfo", async (c) => {
        const authorization = c.req.header("authorization");
        const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
        if (!token)
            return c.json({ error: "invalid_token" }, 401);

        const keys = [
            ...await signingKeys(storage),
            ...await legacySigningKeys(storage),
        ];

        const { payload } = await jwtVerify<AccessTokenPayload>(
            token,
            async (protectedHeader) => {
                const key = keys.find((candidate) => candidate.id === protectedHeader.kid);
                if (!key)
                    throw new Error("Unknown signing key");

                return key.public;
            },
            { issuer: issuerFor(c.req.url) },
        );

        if (payload.mode !== "access" || payload.type !== "user" || !isRecord(payload.properties))
            return c.json({ error: "invalid_token" }, 401);

        return c.json(payload.properties);
    });
};
