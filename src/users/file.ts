import * as v from 'valibot';

import { UserClaimsSchema, type UserBackend, type UserClaims } from "./users";
import { readFile, writeFile } from 'node:fs/promises';

export interface FileUserBackendConfig {
    /** Path to the JSON file used as the user store. */
    userFilePath: string;
}


type UserDN = string;

/** JSON file format which stores user data */
const FileUserDBSchema = v.record(v.string(), UserClaimsSchema);
type FileUserDB = v.InferOutput<typeof FileUserDBSchema>;

/**
 * Simple file-based {@link UserBackend} that stores users as a JSON array of UserClaims.
 *
 * The file is read fresh on every read operation so external edits are always
 * picked up. Writes are atomic (full file rewrite).
 */
export class FileUserBackend implements UserBackend {
    private users: FileUserDB = {};

    constructor(private readonly config: FileUserBackendConfig) {
        this.readAll()
    }

    /**
     * Load users from file
     */
    async readAll() {
        const raw = await readFile(this.config.userFilePath, 'utf-8');
        this.users = v.parse(FileUserDBSchema, JSON.parse(raw))
    }

    /**
     * Write users to file
     */
    async writeAll() {
        await writeFile(this.config.userFilePath, JSON.stringify(this.users, null, 2) + '\n', 'utf-8');
    }

    /**
     * Add a user to the in memory DB (call writeAll to write to file)
     * @param identifier DN of the user 
     * @param claims OIDC claims about the user
     */
    async add(identifier: UserDN, claims: UserClaims) {
        this.users[identifier] = claims;
    }

    /**
     * Gets claims about a user (implements UserBackend)
     * @param identifier DN of the user
     * @returns Claims about the user or null if the user isn't in the DB
     */
    async getClaims(identifier: UserDN): Promise<UserClaims | null> {
        return this.users[identifier] ?? null;
    }
}