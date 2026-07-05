import { describe, expect, test } from "bun:test";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

import type { ClientsBackend, Client } from "./clients/client";
import { createApp } from "./server";
import type { UserBackend, UserClaims } from "./users/users";

const redirectUri = "https://rp.example/callback";

const createTestApp = async () => {
    const secret = "s3cr3t";
    const client: Client = {
        id: "oidcc-client",
        type: "private",
        hashed_secret: await Bun.password.hash(secret, { algorithm: "bcrypt" }),
        redirect_uris: [redirectUri],
    };

    const clients: ClientsBackend = {
        async getClient(clientId) {
            return clientId === client.id ? client : null;
        },
        async setClient() {},
    };

    const userClaims: UserClaims = {
        sub: "icecream",
        name: "Ice Cream",
        email: "icecream@cone.example",
    };
    const users: UserBackend = {
        async getClaims(identifier) {
            return identifier === "CN=icecream" ? userClaims : null;
        },
    };

    return {
        app: createApp(
            {
                userCertificateHeader: "x-cert",
                userCertificateHeaderType: "identity",
            },
            users,
            clients,
        ),
        client,
        secret,
    };
};

const authorize = async (app: ReturnType<typeof createApp>): Promise<string> => {
    const url = new URL("http://auth.example/authorize");
    url.searchParams.set("client_id", "oidcc-client");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", "state-123");

    let response: Response | null = null;
    let currentUrl = url;
    const cookies: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
        response = await app.request(currentUrl, {
            headers: {
                "x-cert": "CN=icecream",
                ...(cookies.length ? { cookie: cookies.join("; ") } : {}),
            },
        });

        expect(response.status).toBe(302);
        response.headers.getSetCookie().forEach((cookie) => {
            cookies.push(cookie.split(";", 1)[0] ?? cookie);
        });

        const location = response.headers.get("location");
        expect(location).toBeTruthy();

        const redirectedTo = new URL(location ?? "", currentUrl);
        const code = redirectedTo.searchParams.get("code");
        if (redirectedTo.origin === new URL(redirectUri).origin && code) {
            expect(redirectedTo.searchParams.get("state")).toBe("state-123");
            return code;
        }

        currentUrl = redirectedTo;
    }

    throw new Error(`Expected authorization code redirect, got ${response?.headers.get("location") ?? "no redirect"}`);
};

const basic = (clientId: string, secret: string): string =>
    `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`).toString("base64")}`;

describe("createApp", () => {
    test("accepts client_secret_basic at the token endpoint", async () => {
        const { app, client, secret } = await createTestApp();
        const code = await authorize(app);

        const rejected = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                authorization: basic(client.id, "wrong"),
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
            }),
        });

        expect(rejected.status).toBe(401);
        expect(await rejected.json()).toEqual({ error: "invalid_client" });

        const accepted = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                authorization: basic(client.id, secret),
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
            }),
        });

        expect(accepted.status).toBe(200);
        const payload = await accepted.json() as Record<string, unknown>;
        expect(payload).toMatchObject({
            token_type: "Bearer",
            expires_in: expect.any(Number),
        });
        expect(typeof payload["access_token"]).toBe("string");
        expect(typeof payload["refresh_token"]).toBe("string");
        expect(typeof payload["id_token"]).toBe("string");

        const jwksResponse = await app.request("http://auth.example/.well-known/jwks.json");
        expect(jwksResponse.status).toBe(200);

        const { payload: idTokenClaims } = await jwtVerify(
            payload["id_token"] as string,
            createLocalJWKSet(await jwksResponse.json() as JSONWebKeySet),
            {
                issuer: "http://auth.example",
                audience: client.id,
            },
        );
        expect(idTokenClaims).toMatchObject({
            iss: "http://auth.example",
            sub: "icecream",
            aud: client.id,
            name: "Ice Cream",
            email: "icecream@cone.example",
        });
        expect(typeof idTokenClaims["iat"]).toBe("number");
        expect(typeof idTokenClaims["exp"]).toBe("number");

        const refreshed = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                authorization: basic(client.id, secret),
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: payload["refresh_token"] as string,
            }),
        });

        expect(refreshed.status).toBe(200);
        const refreshedPayload = await refreshed.json() as Record<string, unknown>;
        expect(typeof refreshedPayload["access_token"]).toBe("string");
        expect(refreshedPayload["id_token"]).toBeUndefined();
    });

    test("rejects malformed client_secret_basic credentials", async () => {
        const { app } = await createTestApp();
        const response = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                authorization: `Basic ${Buffer.from("%:secret").toString("base64")}`,
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: "unused",
                redirect_uri: redirectUri,
            }),
        });

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "invalid_client" });
    });
});
