import * as v from 'valibot';
import { Command, Option } from 'commander';
import { createApp } from '../server';
import { createUserBackend } from '../users/factory';
import { ProviderConfigSchema } from '../provider/config';
import { UserBackendConfigSchema } from '../users/config';
import { ClientsBackendConfigSchema } from '../clients/config';
import { userBackendOptions, clientsBackendOptions } from './shared';
import { createClientsBackend as createClientBackend } from '../clients/factory';
import { log } from '../logger';

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export const RunConfigSchema = v.intersect([
    v.object({
        port: v.pipe(v.string(), v.transform(Number)),
        issuerUrl: v.optional(v.string()),
        publicBaseUrl: v.optional(v.string()),
        backchannelBaseUrl: v.optional(v.string()),
    }),
    ProviderConfigSchema,
    UserBackendConfigSchema,
    ClientsBackendConfigSchema,
]);

export type RunConfig = v.InferOutput<typeof RunConfigSchema>;

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function run(config: RunConfig): Promise<void> {
    const clientBackend = await createClientBackend(config);
    const userBackend = await createUserBackend(config);

    const app = createApp(config, userBackend, clientBackend, {
        issuerUrl: config.issuerUrl,
        publicBaseUrl: config.publicBaseUrl,
        backchannelBaseUrl: config.backchannelBaseUrl,
    });

    log.info(`Starting OpenAuth server on port ${config.port}`);
    Bun.serve({ port: config.port, fetch: app.fetch });
}

// ---------------------------------------------------------------------------
// Commander wiring
// ---------------------------------------------------------------------------

export const runCmd = new Command('run')
    .description('Start the OpenID Provider HTTP server')
    .addOption(new Option('-p, --port <number>', 'Port to listen on').env('PORT').default('3000'))
    .addOption(new Option(
        '--issuer-url <url>',
        'External OIDC issuer URL used for issuer metadata and token issuer claims',
    ).env('OIDC_ISSUER_URL'))
    .addOption(new Option(
        '--public-base-url <url>',
        'External public base URL for browser-facing OIDC endpoints such as /authorize',
    ).env('OIDC_PUBLIC_BASE_URL'))
    .addOption(new Option(
        '--backchannel-base-url <url>',
        'External backchannel base URL for discovery, /token, /userinfo, and JWKS',
    ).env('OIDC_BACKCHANNEL_BASE_URL'))
    .addOption(new Option(
        '--user-certificate-header <header>',
        'Trusted HTTP header injected by the reverse proxy',
    ).env('USER_CERTIFICATE_HEADER').makeOptionMandatory())
    .addOption(new Option(
        '--user-certificate-header-type <type>',
        'Format of the HTTP header injected by the reverse proxy (identity|xfcc). "identity" header value is used as-is to lookup user. "xfcc" header is treated like X-Forwarded-Client-Cert from Envoy or X-Forwarded-Tls-Client-Cert-Info from Traefik and the Subject is parsed out as the user identifier.'

    ).env('USER_CERTIFICATE_HEADER_TYPE').choices(['identity', 'xfcc']).makeOptionMandatory());

userBackendOptions().forEach((o) => runCmd.addOption(o));
clientsBackendOptions().forEach((o) => runCmd.addOption(o));

runCmd.action((opts) => run(v.parse(RunConfigSchema, opts)));
