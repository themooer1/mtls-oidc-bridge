import { match } from "ts-pattern";
import type { HeaderParserConfig } from "./config";
import { IdentityHeaderParser } from "./identity";
import type { HeaderParser } from "./header_parser";
import { XFCCHeaderParser } from "./xfcc";


export const createHeaderParser = (config: HeaderParserConfig): HeaderParser =>
    match(config.userCertificateHeaderType)
        .with("identity", () => IdentityHeaderParser)
        .with("xfcc", () => XFCCHeaderParser)
        .exhaustive()