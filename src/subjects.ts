import { createSubjects } from "@openauthjs/openauth/subject";
import * as v from "valibot";

export const subjects = createSubjects({
    user: v.intersect([
        // User backends must at least provide 'sub'
        v.object({
            sub: v.string(),
        }),
        // They may provide other claims
        v.record(v.string(), v.union([v.string(), v.number(), v.boolean()]))
    ])
    
})