import * as v from 'valibot';
import { Command, Option } from 'commander';
import { FileUserBackend } from '../users/file';
import type { UserClaims } from '../users/users';

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export const AddUserConfigSchema = v.intersect([
    v.object({
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        // Additional claims as a record of string to string|number|boolean
        claims: v.optional(v.record(v.string(), v.union([v.string(), v.number(), v.boolean()]))),
    }),
]);

export type AddUserConfig = v.InferOutput<typeof AddUserConfigSchema>;

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function addUser(sub: string, config: AddUserConfig, userFilePath: string): Promise<void> {
    const backend = await FileUserBackend.createInstance({userFilePath});

    const existing = await backend.getClaims(sub);
    if (existing) {
        console.error(`❌  User with sub "${sub}" already exists.`);
        process.exit(1);
    }

    // Build the user claims object
    const claims: UserClaims = { sub };
    if (config.name !== undefined) {
        claims['name'] = config.name;
    }
    if (config.email !== undefined) {
        claims['email'] = config.email;
    }
    if (config.claims !== undefined) {
        Object.assign(claims, config.claims);
    }

    await backend.set(sub, claims);

    console.log(`✅  User with sub "${sub}" created.`);
}

// ---------------------------------------------------------------------------
// Commander wiring
// ---------------------------------------------------------------------------

export const addUserCmd = new Command('add-user')
    .description('Add a new user to the users store')
    .argument('<sub>', 'User subject identifier')
    .addOption(
        new Option('--name <name>', 'User name')
    )
    .addOption(
        new Option('--email <email>', 'User email')
    )
    .addOption(
        new Option('--claims <json>', 'Additional claims as JSON object')
            .argParser((value) => {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    throw new Error('Invalid JSON for --claims', {cause: e})
                }
            })
    )
    .addOption(
        new Option('--user-file-path <path>', 'Path to the users JSON file')
            .makeOptionMandatory(true)
    );

addUserCmd.action(async (sub: string, opts) => {
    const config = v.parse(AddUserConfigSchema, opts);
    await addUser(sub, config, opts.userFilePath).catch((err) => {
        console.error('❌  Failed to add user:', err.message);
        process.exit(1);
    });
});