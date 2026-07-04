import * as v from 'valibot';
import { HeaderParserConfigSchema } from './header/config';

export const ProviderConfigSchema = 
v.intersect([
    v.object({
        /** The trusted HTTP header injected by the reverse proxy. */
        userCertificateHeader: v.string(),
    }),
    HeaderParserConfigSchema,
])


export type ProviderConfig = v.InferOutput<typeof ProviderConfigSchema>;
