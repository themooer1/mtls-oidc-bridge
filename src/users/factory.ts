import type { UserBackendConfig } from "./config";
import { FileUserBackend } from "./file";
import { LdapUserBackend } from "./ldap";
import type { UserBackend } from "./users";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Instantiate the correct {@link UserBackend} from a config object. */
export function createUserBackend(config: UserBackendConfig): UserBackend {
    switch (config.userBackend) {
        case 'file':
            return new FileUserBackend(config);
        case 'ldap':
            return new LdapUserBackend(config);
    }
}