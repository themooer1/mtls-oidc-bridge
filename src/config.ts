import * as v from 'valibot';
import { ProviderConfigSchema } from './provider/config';
import { UserBackendConfigSchema } from './users/config';
import { ClientsBackendConfigSchema } from './clients/config';

/**
 * Full application config schema — intersection of all sub-module schemas.
 * Each module owns its own slice; this file just composes them.
 */
export const AppConfigSchema = v.intersect([
    v.object({ port: v.pipe(v.string(), v.transform(Number)) }),
    ProviderConfigSchema,
    UserBackendConfigSchema,
    ClientsBackendConfigSchema,
]);

export type AppConfig = v.InferOutput<typeof AppConfigSchema>;