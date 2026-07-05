import { describe, expect, test } from "bun:test";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { signingKeys } from "@openauthjs/openauth/keys";
import { Hono } from "hono";
import { SignJWT } from "jose";

import { registerUserInfoRoutes } from "./userinfo";

const createAccessToken = async (
    storage: ReturnType<typeof MemoryStorage>,
    payload: Record<string, unknown>,
): Promise<string> => {
    const key = (await signingKeys(storage))[0];
    if (!key)
        throw new Error("Expected signing key");

    return await new SignJWT(payload)
        .setExpirationTime("1h")
        .setProtectedHeader({ alg: key.alg, kid: key.id, typ: "JWT" })
        .sign(key.private);
};

describe("userinfo routes", () => {
    test("returns claims embedded in a valid user access token", async () => {
        const storage = MemoryStorage();
        const app = new Hono();
        registerUserInfoRoutes(app, storage);

        const token = await createAccessToken(storage, {
            mode: "access",
            type: "user",
            aud: "client",
            iss: "http://localhost",
            sub: "icecream",
            properties: {
                sub: "icecream",
                preferred_username: "icecream",
                name: "Ice Cream",
                email: "icecream@cone.com",
            },
        });

        const response = await app.request("http://localhost/userinfo", {
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            sub: "icecream",
            preferred_username: "icecream",
            name: "Ice Cream",
            email: "icecream@cone.com",
        });
    });

    test("accepts bearer tokens from POST headers and bodies", async () => {
        const storage = MemoryStorage();
        const app = new Hono();
        registerUserInfoRoutes(app, storage);

        const token = await createAccessToken(storage, {
            mode: "access",
            type: "user",
            aud: "client",
            iss: "http://localhost",
            sub: "icecream",
            properties: {
                sub: "icecream",
                name: "Ice Cream",
            },
        });

        const headerResponse = await app.request("http://localhost/userinfo", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
        });
        expect(headerResponse.status).toBe(200);
        expect(await headerResponse.json()).toEqual({
            sub: "icecream",
            name: "Ice Cream",
        });

        const bodyResponse = await app.request("http://localhost/userinfo", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ access_token: token }),
        });
        expect(bodyResponse.status).toBe(200);
        expect(await bodyResponse.json()).toEqual({
            sub: "icecream",
            name: "Ice Cream",
        });
    });

    test("rejects requests without a bearer token", async () => {
        const storage = MemoryStorage();
        const app = new Hono();
        registerUserInfoRoutes(app, storage);

        const response = await app.request("http://localhost/userinfo");

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "invalid_token" });
    });

    test("rejects access tokens for non-user subjects", async () => {
        const storage = MemoryStorage();
        const app = new Hono();
        registerUserInfoRoutes(app, storage);

        const token = await createAccessToken(storage, {
            mode: "access",
            type: "service",
            aud: "client",
            iss: "http://localhost",
            sub: "service",
            properties: {
                sub: "service",
            },
        });

        const response = await app.request("http://localhost/userinfo", {
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "invalid_token" });
    });

    test("advertises supported OIDC capabilities in discovery metadata", async () => {
        const storage = MemoryStorage();
        const app = new Hono();
        registerUserInfoRoutes(app, storage);

        const expected = {
            issuer: "https://auth.cone.com",
            authorization_endpoint: "https://auth.cone.com/authorize",
            token_endpoint: "https://auth.cone.com/token",
            jwks_uri: "https://auth.cone.com/.well-known/jwks.json",
            userinfo_endpoint: "https://auth.cone.com/userinfo",
            response_types_supported: ["code", "token"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            scopes_supported: ["openid", "profile", "email"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["ES256"],
            token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
            claims_supported: ["sub", "name", "email", "preferred_username"],
        };

        const oidcResponse = await app.request("https://auth.cone.com/.well-known/openid-configuration");

        expect(oidcResponse.status).toBe(200);
        expect(await oidcResponse.json()).toEqual(expected);

        const oauthResponse = await app.request("https://auth.cone.com/.well-known/oauth-authorization-server");

        expect(oauthResponse.status).toBe(200);
        expect(await oauthResponse.json()).toEqual(expected);
    });
});
