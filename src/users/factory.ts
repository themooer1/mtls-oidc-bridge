import type { UserBackendConfig } from "./config";
import { FileUserBackend } from "./file";
import { LdapUserBackend } from "./ldap";
import type { UserBackend } from "./users";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Instantiate the correct {@link UserBackend} from a config object. */
export async function createUserBackend(config: UserBackendConfig): Promise<UserBackend> {
    switch (config.userBackend) {
        case 'file':
            return await FileUserBackend.createInstance(config);
        case 'ldap':
            return await LdapUserBackend.createInstance(config);
    }
}