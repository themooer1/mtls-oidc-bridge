import { issuer } from "@openauthjs/openauth";
import { signingKeys } from "@openauthjs/openauth/keys";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { Storage, type StorageAdapter } from "@openauthjs/openauth/storage/storage";
import { Hono } from "hono";
import type { Context } from "hono";
import { SignJWT, type JWTPayload } from "jose";
import { subjects } from "./subjects";
import { TrustedHeaderProvider } from "./provider/provider";
import { MissingUserError, type UserBackend } from "./users/users";
import { makeClientRedirectVerifier } from "./clients/verifier";
import type { ClientsBackend as ClientBackend } from "./clients/client";
import { createHeaderParser } from "./provider/header/factory";
import type { ProviderConfig } from "./provider/config";
import { registerUserInfoRoutes } from "./userinfo";

const parseBasicClientAuth = (authorization: string | undefined): { id: string; secret: string } | null => {
    const match = authorization?.match(/^Basic (.+)$/i);
    if (!match)
        return null;

    const encoded = match[1];
    if (!encoded)
        return null;

    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const separator = decoded.indexOf(":");
    if (separator < 0)
        return null;

    try {
        return {
            id: decodeURIComponent(decoded.slice(0, separator)),
            secret: decodeURIComponent(decoded.slice(separator + 1)),
        };
    } catch {
        return null;
    }
};

const invalidClientResponse = () =>
    Response.json({ error: "invalid_client" }, { status: 401 });

type AuthorizationCodePayload = {
    type: string;
    properties: Record<string, unknown>;
    subject: string;
    redirectURI: string;
    clientID: string;
    pkce?: unknown;
    ttl: {
        access: number;
        refresh: number;
    };
};

const idTokenReservedClaims = new Set([
    "iss",
    "sub",
    "aud",
    "exp",
    "nbf",
    "iat",
    "jti",
    "auth_time",
    "nonce",
    "acr",
    "amr",
    "azp",
    "at_hash",
    "c_hash",
]);

const additionalIdTokenClaims = (properties: Record<string, unknown>): JWTPayload => {
    const claims: JWTPayload = {};
    for (const [key, value] of Object.entries(properties)) {
        if (idTokenReservedClaims.has(key))
            continue;

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
            claims[key] = value;
    }
    return claims;
};

const createIdToken = async (storage: StorageAdapter, requestUrl: string, codePayload: AuthorizationCodePayload) => {
    const keys = await signingKeys(storage);
    const key = keys.find((candidate) => !candidate.expired) ?? keys[0];
    if (!key)
        throw new Error("No OpenAuth signing key available");

    const now = Math.floor(Date.now() / 1000);
    const subject = typeof codePayload.properties["sub"] === "string"
        ? codePayload.properties["sub"]
        : codePayload.subject;

    return await new SignJWT({
        ...additionalIdTokenClaims(codePayload.properties),
        iss: new URL(requestUrl).origin,
        sub: subject,
        aud: codePayload.clientID,
        iat: now,
        exp: now + codePayload.ttl.access,
    })
        .setProtectedHeader({
            alg: key.alg,
            kid: key.id,
            typ: "JWT",
        })
        .sign(key.private);
};

const tokenRequest = (authApp: { fetch: (request: Request) => Response | Promise<Response> }, clientBackend: ClientBackend, storage: StorageAdapter) =>
    async (c: Context) => {
        const body = await c.req.text();
        const form = new URLSearchParams(body);
        const authorization = c.req.header("authorization");
        const basic = parseBasicClientAuth(authorization);

        if (authorization?.match(/^Basic /i) && !basic)
            return invalidClientResponse();

        if (basic) {
            const formClientId = form.get("client_id");
            if (formClientId && formClientId !== basic.id)
                return invalidClientResponse();

            form.set("client_id", basic.id);
            form.set("client_secret", basic.secret);
        }

        const clientId = form.get("client_id");
        const clientSecret = form.get("client_secret");
        if (clientId) {
            const client = await clientBackend.getClient(clientId);
            if (!client)
                return invalidClientResponse();

            if (client.type === "private") {
                if (!clientSecret || !await Bun.password.verify(clientSecret, client.hashed_secret))
                    return invalidClientResponse();
            }
        }

        const codePayload = form.get("grant_type") === "authorization_code" && form.get("code")
            ? await Storage.get<AuthorizationCodePayload>(storage, ["oauth:code", form.get("code") ?? ""])
            : null;

        const headers = new Headers(c.req.raw.headers);
        headers.delete("authorization");
        headers.delete("content-length");
        headers.set("content-type", "application/x-www-form-urlencoded");

        const response = await authApp.fetch(new Request(c.req.url, {
            method: "POST",
            headers,
            body: form.toString(),
        }));

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.includes("application/json"))
            return response;

        const payload = await response.json() as Record<string, unknown>;
        if (typeof payload["access_token"] === "string" && !payload["token_type"])
            payload["token_type"] = "Bearer";
        if (typeof payload["access_token"] === "string" && codePayload)
            payload["id_token"] = await createIdToken(storage, c.req.url, codePayload);

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete("content-length");
        responseHeaders.set("content-type", "application/json");

        return new Response(JSON.stringify(payload), {
            status: response.status,
            headers: responseHeaders,
        });
    };

/**
 * Build the OpenAuth issuer app.
 *
 * Accepts only what it actually needs so callers aren't coupled to a
 * particular config shape (env vars, CLI options, etc.).
 */
export function createApp(providerConfig: ProviderConfig, userBackend: UserBackend, clientBackend: ClientBackend) {
    const storage = MemoryStorage();
    const app = new Hono();

    registerUserInfoRoutes(app, storage);

    const authApp = issuer({
        providers: {
            proxy_header: TrustedHeaderProvider({ header: providerConfig.userCertificateHeader, getUserIdentifier: createHeaderParser(providerConfig)}),
        },
        storage,
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
    });

    app.post("/token", tokenRequest(authApp, clientBackend, storage));
    app.route("/", authApp);
    return app;
}
