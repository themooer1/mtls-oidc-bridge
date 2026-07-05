import { describe, expect, test } from "bun:test";

import { MalformedHeaderError } from "./header_parser";
import { XFCCHeaderParser } from "./xfcc";

describe("XFCCHeaderParser", () => {
    test("extracts only the Subject DN from an XFCC header", () => {
        expect(XFCCHeaderParser('Hash=e078a93dc34fdfe8d43a878c1891088dfe3bde65d8df6af6657271a0f98cdaf7;Subject="emailAddress=david@mooblek.com,CN=David Smith,C=US"'))
            .toBe("emailAddress=david@mooblek.com,CN=David Smith,C=US");
    });

    test("extracts subjects on repeated parses", () => {
        expect(XFCCHeaderParser('Hash=aaa;Subject="CN=Alice,O=Example Corp,C=US"'))
            .toBe("CN=Alice,O=Example Corp,C=US");
        expect(XFCCHeaderParser('Hash=bbb;Subject="CN=Bob,O=Example Corp,C=US"'))
            .toBe("CN=Bob,O=Example Corp,C=US");
    });

    test("rejects headers without a subject", () => {
        expect(() => XFCCHeaderParser("Hash=aaa;By=proxy")).toThrow(MalformedHeaderError);
    });
});
