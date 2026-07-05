import { MalformedHeaderError, type HeaderParser } from "./header_parser";

const SubjectRegex = /Subject="((?:\\.|[^\\"])+)"/;

/**
 * HeaderParser where the header is in Envoy Proxy's X-Forwarded-Client-Cert format.
 * We just want the Subject field, which we return as the user's unique identifier.
 * 
 * You need to request that the Subject field be included by Envoy:
 * https://gateway.envoyproxy.io/latest/api/extension_types/#xforwardedclientcert
 * 
 * This should also work for Traefik's X-Forwarded-Tls-Client-Cert-Info:
 * https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/passtlsclientcert/#info
 * 
 * 
 * e.g. X-Forwarded-Client-Cert could be: By=...,Hash=...,Cert=-----BEGIN...-----END CERTIFICATE-----,Subject="CN=Alice \\\"The Boss\\\" Smith,O=Example Corp,C=US"
 * 
 * @param h Header containing Envoy Proxy's X-Forwarded-Client-Cert header
 * @returns The contents of the Subject field i.e. the user's DN
 */
export const XFCCHeaderParser: HeaderParser = h => {
    const match = SubjectRegex.exec(h)

    if (match?.[1])
        return match[1];

    throw new MalformedHeaderError();
}
