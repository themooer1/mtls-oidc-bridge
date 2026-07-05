import * as v from 'valibot';

import { UserClaimsSchema, type UserBackend, type UserClaims } from "./users";
import { ConfigFile } from '../util/config_file';
import { log } from '../logger';

export interface FileUserBackendConfig {
    /** Path to the JSON file used as the user store. */
    userFilePath: string;
}


type UserDN = string;

/** JSON file format which stores user data */
const FileUserDBSchema = v.record(v.string(), UserClaimsSchema);
type FileUserDB = v.InferOutput<typeof FileUserDBSchema>;

type FileUserConfigFile = ConfigFile<FileUserDB>;

/**
 * Simple file-based {@link UserBackend} that stores users as a JSON array of UserClaims.
 *
 * The file is read fresh on every read operation so external edits are always
 * picked up. Writes are atomic (full file rewrite).
 */
export class FileUserBackend implements UserBackend {
    static async createInstance(
        config: FileUserBackendConfig,
        create: boolean = false,
    ): Promise<FileUserBackend> {
        log.debug("Opening file user backend", config.userFilePath);

        let configFile: FileUserConfigFile;
        try {
            configFile = await ConfigFile.open(
                config.userFilePath,
                create,
            );
        } catch (err) {
            log.error("Failed to open file user backend", err);
            throw err;
        }

        log.debug("Opened file user backend", config.userFilePath);

        return new FileUserBackend(configFile);
    }

    private constructor(private readonly config: FileUserConfigFile) {}

    /**
     * Gets claims about a user.
     * @param identifier DN of the user.
     * @returns Claims about the user or null if the user isn't in the DB.
     */
    async getClaims(identifier: UserDN): Promise<UserClaims | null> {
        log.debug("Looking up user in file backend", identifier);

        const claims = this.config.data[identifier] ?? null;
        if (claims === null) {
            log.debug("User not found in file backend", identifier);
        } else {
            log.debug("Found user in file backend", identifier);
        }

        return claims;
    }

    /**
     * Adds or updates a user.
     * @param identifier DN of the user.
     * @param claims OIDC claims about the user.
     */
    async set(identifier: UserDN, claims: UserClaims): Promise<void> {
        log.debug("Writing user to file backend", identifier);
        this.config.data[identifier] = claims;

        try {
            await this.config.save();
        } catch (err) {
            log.error("Failed to write user to file backend", err);
            throw err;
        }

        log.debug("Wrote user to file backend", identifier);
    }
}
