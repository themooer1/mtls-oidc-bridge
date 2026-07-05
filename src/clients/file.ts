import type { Client, ClientsBackend, ClientID } from "./client";
import { ConfigFile } from '../util/config_file';

// ---------------------------------------------------------------------------
// File-based backend
// ---------------------------------------------------------------------------

export interface FileClientsBackendConfig {
    /** Path to the JSON file used as the client store. */
    clientsFilePath: string;
}

type ClientsConfigFile = ConfigFile<Record<ClientID, Client>>;

/**
 * Simple file-based {@link ClientsBackend} that stores clients as a JSON array.
 *
 * The file is read fresh on every read operation so external edits are always
 * picked up. Writes are atomic (full file rewrite).
 */
export class FileClientsBackend implements ClientsBackend {
    static async createInstance(config: FileClientsBackendConfig, create: boolean = false) {
        const configFile: ClientsConfigFile = await ConfigFile.open(config.clientsFilePath, create);

        return new FileClientsBackend(configFile);
    }

    private constructor(private readonly config: ClientsConfigFile) {}

    async getClient(clientId: ClientID): Promise<Client | null> {
        return this.config.data[clientId] ?? null;
    }

    async setClient(client: Client): Promise<void> {
        this.config.data[client.id] = client;
        await this.config.save();
    }
}
