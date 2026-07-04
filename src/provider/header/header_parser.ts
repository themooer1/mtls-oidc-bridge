import { OauthError } from "@openauthjs/openauth/error";


export type Identifier = string;
export type Header = string;

/**
 * A HeaderParser parses the selected header injected by the identity-aware proxy
 * and extracts the unique identifier used to find that user in the {@link UserBackend}
 */
export type HeaderParser = (h: Header) => Identifier;

export class MalformedHeaderError extends OauthError {
    constructor() {
        super("access_denied", "mTLS header containing user info could not be parsed.")
    }
}