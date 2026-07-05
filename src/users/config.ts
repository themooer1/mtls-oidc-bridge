import * as v from 'valibot';

export const UserBackendConfigSchema = v.variant('userBackend', [
    v.object({
        userBackend: v.literal('file'),
        /** Path to the users file on disk. */
        userFilePath: v.string(),
    }),
    v.object({
        userBackend: v.literal('ldap'),
        /** ldap:// URL for the directory server. */
        ldapUrl: v.string(),
        /** Bind DN used to search the directory. */
        ldapBindDn: v.string(),
        /** Bind password for the search user. */
        ldapBindPassword: v.string(),
    }),
]);

export type UserBackendConfig = v.InferOutput<typeof UserBackendConfigSchema>;
