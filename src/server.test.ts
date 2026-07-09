import { describe, expect, test } from "bun:test";
import { createLocalJWKSet, decodeProtectedHeader, jwtVerify, type JSONWebKeySet } from "jose";
import { Buffer } from "node:buffer";

import type { ClientsBackend, Client } from "./clients/client";
import { createApp, type EndpointMetadataConfig } from "./server";
import type { UserBackend, UserClaims } from "./users/users";

const redirectUri = "https://rp.example/callback";

const createTestApp = async (endpointConfig: EndpointMetadataConfig = {}) => {
    const secret = "s3cr3t";
    const client: Client = {
        id: "oidcc-client",
        type: "private",
        hashed_secret: await Bun.password.hash(secret, { algorithm: "bcrypt" }),
        redirect_uris: [redirectUri],
    };
    const publicClient: Client = {
        id: "public-client",
        type: "public",
        redirect_uris: [redirectUri],
    };

    const clients: ClientsBackend = {
        async getClient(clientId) {
            return {
                [client.id]: client,
                [publicClient.id]: publicClient,
            }[clientId] ?? null;
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
            endpointConfig,
        ),
        client,
        publicClient,
        secret,
    };
};

const authorize = async (
    app: ReturnType<typeof createApp>,
    clientId = "oidcc-client",
): Promise<string> => {
    const url = new URL("http://auth.example/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("nonce", "nonce-123");
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
        expect(decodeProtectedHeader(payload["id_token"] as string).alg).toBe("ES256");

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
            nonce: "nonce-123",
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

    test("enforces connector public and private client auth rules", async () => {
        const { app, publicClient, secret } = await createTestApp();
        const privateCode = await authorize(app);

        const missingSecret = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: privateCode,
                redirect_uri: redirectUri,
                client_id: "oidcc-client",
            }),
        });
        expect(missingSecret.status).toBe(401);

        const publicCode = await authorize(app, publicClient.id);
        const publicAccepted = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: publicCode,
                redirect_uri: redirectUri,
                client_id: publicClient.id,
            }),
        });
        expect(publicAccepted.status).toBe(200);
        expect(await publicAccepted.json()).toMatchObject({
            token_type: "Bearer",
            id_token: expect.any(String),
        });

        const publicSecretCode = await authorize(app, publicClient.id);
        const publicRejected = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: publicSecretCode,
                redirect_uri: redirectUri,
                client_id: publicClient.id,
                client_secret: secret,
            }),
        });
        expect(publicRejected.status).toBe(401);
    });

    test("accepts client_secret_post for private clients", async () => {
        const { app, client, secret } = await createTestApp();
        const code = await authorize(app);

        const response = await app.request("http://auth.example/token", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                client_id: client.id,
                client_secret: secret,
            }),
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            token_type: "Bearer",
            id_token: expect.any(String),
        });
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

    test("uses configured issuer with split public and backchannel endpoints", async () => {
        const { app, client, secret } = await createTestApp({
            issuerUrl: "https://issuer.op.example",
            publicBaseUrl: "https://public.op.example",
            backchannelBaseUrl: "https://backchannel.op.example",
        });

        const discoveryResponse = await app.request("https://backchannel.op.example/.well-known/openid-configuration");
        expect(discoveryResponse.status).toBe(200);
        expect(await discoveryResponse.json()).toMatchObject({
            issuer: "https://issuer.op.example",
            authorization_endpoint: "https://public.op.example/authorize",
            token_endpoint: "https://backchannel.op.example/token",
            userinfo_endpoint: "https://backchannel.op.example/userinfo",
            jwks_uri: "https://backchannel.op.example/.well-known/jwks.json",
        });

        const code = await authorize(app);
        const tokenResponse = await app.request("https://backchannel.op.example/token", {
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

        expect(tokenResponse.status).toBe(200);
        const tokens = await tokenResponse.json() as Record<string, unknown>;
        expect(typeof tokens["access_token"]).toBe("string");
        expect(typeof tokens["id_token"]).toBe("string");

        const jwksResponse = await app.request("https://backchannel.op.example/.well-known/jwks.json");
        expect(jwksResponse.status).toBe(200);
        const jwks = createLocalJWKSet(await jwksResponse.json() as JSONWebKeySet);

        const { payload: idTokenClaims } = await jwtVerify(
            tokens["id_token"] as string,
            jwks,
            {
                issuer: "https://issuer.op.example",
                audience: client.id,
            },
        );
        expect(idTokenClaims.iss).toBe("https://issuer.op.example");

        const { payload: accessTokenClaims } = await jwtVerify(
            tokens["access_token"] as string,
            jwks,
            {
                issuer: "https://issuer.op.example",
                audience: client.id,
            },
        );
        expect(accessTokenClaims.iss).toBe("https://issuer.op.example");

        const userInfoResponse = await app.request("https://backchannel.op.example/userinfo", {
            headers: { authorization: `Bearer ${tokens["access_token"]}` },
        });
        expect(userInfoResponse.status).toBe(200);
        expect(await userInfoResponse.json()).toMatchObject({
            sub: "icecream",
            name: "Ice Cream",
            email: "icecream@cone.example",
        });
    });
});
