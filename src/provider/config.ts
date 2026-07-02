import * as v from 'valibot';

export const ProviderConfigSchema = v.object({
    /** The trusted HTTP header injected by the reverse proxy. */
    userCertificateHeader: v.string(),
});

export type ProviderConfig = v.InferOutput<typeof ProviderConfigSchema>;
