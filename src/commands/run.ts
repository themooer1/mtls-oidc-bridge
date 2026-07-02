import * as v from 'valibot';
import { Command, Option } from 'commander';
import { createApp } from '../server';
import { createUserBackend } from '../users/factory';
import { ProviderConfigSchema } from '../provider/config';
import { UserBackendConfigSchema } from '../users/config';
import { ClientsBackendConfigSchema } from '../clients/config';
import { userBackendOptions, clientsBackendOptions } from './shared';
import { createClientsBackend as createClientBackend } from '../clients/factory';

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export const RunConfigSchema = v.intersect([
    v.object({ port: v.pipe(v.string(), v.transform(Number)) }),
    ProviderConfigSchema,
    UserBackendConfigSchema,
    ClientsBackendConfigSchema,
]);

export type RunConfig = v.InferOutput<typeof RunConfigSchema>;

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function run(config: RunConfig): Promise<void> {
    const clientBackend = createClientBackend(config);
    const userBackend = createUserBackend(config);

    const app = createApp(config.userCertificateHeader, userBackend, clientBackend);

    console.log(`🚀  Starting OpenAuth server on port ${config.port}…`);
    Bun.serve({ port: config.port, fetch: app.fetch });
}

// ---------------------------------------------------------------------------
// Commander wiring
// ---------------------------------------------------------------------------

export const runCmd = new Command('run')
    .description('Start the OpenID Provider HTTP server')
    .addOption(new Option('-p, --port <number>', 'Port to listen on').env('PORT').default('3000'))
    .addOption(new Option(
        '--user-certificate-header <header>',
        'Trusted HTTP header injected by the reverse proxy',
    ).env('USER_CERTIFICATE_HEADER').makeOptionMandatory());

userBackendOptions().forEach((o) => runCmd.addOption(o));
clientsBackendOptions().forEach((o) => runCmd.addOption(o));

runCmd.action((opts) => run(v.parse(RunConfigSchema, opts)));
