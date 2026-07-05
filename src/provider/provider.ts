/**
 * Provider which authenticates a user based on a trusted header injected by a proxy.
 *
 * @packageDocumentation
 */
import type { Provider } from "@openauthjs/openauth/provider/provider";
import { OauthError } from "@openauthjs/openauth/error";
import type { HeaderParser } from "./header/header_parser";
import { log } from "../logger";

class MissingAuthHeaderError extends OauthError {
  constructor() {
    super("access_denied", "mTLS subject header was missing or invalid")
  }
}

export interface TrustedHeaderProviderConfig {
  /**
   * Trusted HTTP header injected by the proxy which identifies the user logging in.
   *
   * @example "X-Forwarded-Client-Cert"
   */
  header: string,

  /**
   * Function which takes the header value and extracts a unique identifier for the user.
   */
  getUserIdentifier: HeaderParser
}

type TrustedHeaderProviderClaims = {
  identifier: string,
}

export function TrustedHeaderProvider
(config: TrustedHeaderProviderConfig): Provider<{ claims: TrustedHeaderProviderClaims }> {
  const { header, getUserIdentifier } = config;

  return {
    type: "mtls",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        // The header from the proxy tells us who is trying to login
        const subject = c.req.header(header) || "someone";
        log.debug("TrustedHeaderProvider subject", subject);

        // If it's not there, redirect to the RP with an error.
        if (subject === undefined) {
          throw new MissingAuthHeaderError();
        }

        const identifier = getUserIdentifier(subject);
        log.debug("TrustedHeaderProvider user identifier", identifier);

        // Log in the subject identified in the proxy header
        return ctx.forward(
            c,
            await ctx.success(c, {claims: {identifier}}))
      })
    },
  }
}

/**
 * @internal
 */
export type TrustedHeaderProviderOptions = Parameters<typeof TrustedHeaderProvider>[0]
