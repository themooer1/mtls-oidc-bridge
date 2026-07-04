import type { HeaderParser } from "./header_parser";

/**
 * HeaderParser where the header just *is* the user's identifier
 * e.g. if the header was just the user's DN, we return it as-is
 * 
 * @param h Header containing the unique identifier for the user in our UserBackend
 * @returns 
 */
export const IdentityHeaderParser: HeaderParser = h => h