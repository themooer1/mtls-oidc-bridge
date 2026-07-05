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
            sub: "david",
            properties: {
                sub: "david",
                preferred_username: "david",
                name: "David Smith",
                email: "david@mooblek.com",
            },
        });

        const response = await app.request("http://localhost/userinfo", {
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            sub: "david",
            preferred_username: "david",
            name: "David Smith",
            email: "david@mooblek.com",
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

    test("advertises the userinfo endpoint in discovery metadata", async () => {
        const storage = MemoryStorage();
        const app = new Hono();
        registerUserInfoRoutes(app, storage);

        const response = await app.request("https://moqi.mooblek.com/.well-known/openid-configuration");

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            issuer: "https://moqi.mooblek.com",
            authorization_endpoint: "https://moqi.mooblek.com/authorize",
            token_endpoint: "https://moqi.mooblek.com/token",
            jwks_uri: "https://moqi.mooblek.com/.well-known/jwks.json",
            userinfo_endpoint: "https://moqi.mooblek.com/userinfo",
        });
    });
});
