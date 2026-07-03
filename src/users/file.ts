import * as v from 'valibot';

import { UserClaimsSchema, type UserBackend, type UserClaims } from "./users";
import { ConfigFile } from '../util/config_file';

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
        const configFile: FileUserConfigFile = await ConfigFile.open(
            config.userFilePath,
            create,
        );

        return new FileUserBackend(configFile);
    }

    private constructor(private readonly config: FileUserConfigFile) {}

    /**
     * Gets claims about a user.
     * @param identifier DN of the user.
     * @returns Claims about the user or null if the user isn't in the DB.
     */
    async getClaims(identifier: UserDN): Promise<UserClaims | null> {
        return this.config.data[identifier] ?? null;
    }

    /**
     * Adds or updates a user.
     * @param identifier DN of the user.
     * @param claims OIDC claims about the user.
     */
    async set(identifier: UserDN, claims: UserClaims): Promise<void> {
        this.config.data[identifier] = claims;
        await this.config.save();
    }
}