import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// File-based backend
// ---------------------------------------------------------------------------

import type { Client, ClientsBackend } from "./client";

export interface FileClientsBackendConfig {
    /** Path to the JSON file used as the client store. */
    clientsFilePath: string;
}

/**
 * Simple file-based {@link ClientsBackend} that stores clients as a JSON array.
 *
 * The file is read fresh on every read operation so external edits are always
 * picked up. Writes are atomic (full file rewrite).
 */
export class FileClientsBackend implements ClientsBackend {
    constructor(private readonly config: FileClientsBackendConfig) {}

    private readAll(): Client[] {
        const { clientsFilePath: filePath } = this.config;
        if (!existsSync(filePath)) return [];
        const raw = readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as Client[];
    }

    private writeAll(clients: Client[]): void {
        writeFileSync(this.config.clientsFilePath, JSON.stringify(clients, null, 2) + '\n', 'utf-8');
    }

    async getClient(clientId: string): Promise<Client | null> {
        return this.readAll().find((c) => c.id === clientId) ?? null;
    }

    async saveClient(client: Client): Promise<void> {
        const all = this.readAll().filter((c) => c.id !== client.id);
        this.writeAll([...all, client]);
    }

    async listClients(): Promise<Client[]> {
        return this.readAll();
    }
}
