import * as v from 'valibot';

export const ClientsBackendConfigSchema = v.variant('clientsBackend', [
    v.object({
        clientsBackend: v.literal('file'),
        /** Absolute or relative path to the clients JSON store. */
        clientsFilePath: v.string(),
    }),
]);

export type ClientsBackendConfig = v.InferOutput<typeof ClientsBackendConfigSchema>;
