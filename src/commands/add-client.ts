import * as v from 'valibot';
import { Command, Option } from 'commander';
import { createClientsBackend } from '../clients/factory';
import type { Client } from '../clients/client';
import { ClientsBackendConfigSchema } from '../clients/config';
import { clientsBackendOptions } from './shared';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export const AddClientConfigSchema = v.intersect([
    v.object({
        type: v.union([v.literal('public'), v.literal('private')]),
        redirectUris: v.array(v.string()),
    }),
    ClientsBackendConfigSchema,
]);

export type AddClientConfig = v.InferOutput<typeof AddClientConfigSchema>;

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function addClient(clientId: string, config: AddClientConfig): Promise<void> {
    const backend = await createClientsBackend(config);

    const existing = await backend.getClient(clientId);
    if (existing) {
        console.error(`❌  Client "${clientId}" already exists.`);
        process.exit(1);
    }

    let client: Client;

    if (config.type === 'public') {
        client = { id: clientId, type: 'public', redirect_uris: config.redirectUris };
        await backend.setClient(client);
        console.log(`✅  Registered public client "${clientId}" (no secret).`);
    } else {
        // Generate a cryptographically random secret (32 bytes → 64 hex chars)
        const rawSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
        const hashed_secret = await Bun.password.hash(rawSecret, { algorithm: 'bcrypt' });

        client = { id: clientId, type: 'private', hashed_secret, redirect_uris: config.redirectUris };
        await backend.setClient(client);

        console.log(`✅  Registered private client "${clientId}".`);
        console.log(`\n🔑  Client secret (shown once — store it securely):`);
        console.log('─'.repeat(64));
        console.log(rawSecret);
        console.log('─'.repeat(64) + '\n');
    }
}

// ---------------------------------------------------------------------------
// Commander wiring
// ---------------------------------------------------------------------------

export const addClientCmd = new Command('add-client')
    .description('Register a new OIDC client in the clients store')
    .argument('<client_id>', 'Unique client identifier')
    .addOption(
        new Option('--type <type>', 'Client type')
            .choices(['public', 'private'])
            .default('private'),
    )
    .addOption(
        new Option('--redirect-uri <uri>', 'Allowed redirect URI for this client')
            .makeOptionMandatory()
            .argParser((value: string, previous: string[] = []) => {
                previous.push(value);
                return previous;
            })
            ,
    );

clientsBackendOptions().forEach((o) => addClientCmd.addOption(o));

addClientCmd.action(async (clientId: string, opts) =>
    await addClient(clientId, v.parse(AddClientConfigSchema, opts)));
