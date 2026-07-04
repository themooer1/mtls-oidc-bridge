import * as v from 'valibot'

export const HeaderParserConfigSchema =
    v.object({
        userCertificateHeaderType: v.union([v.literal("identity"), v.literal("xfcc")])
    })

export type HeaderParserConfig = v.InferOutput<typeof HeaderParserConfigSchema>;