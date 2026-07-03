import type { ClientsBackend } from "./client";
import type { ClientsBackendConfig } from "./config";
import { FileClientsBackend } from "./file";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Instantiate the correct {@link ClientsBackend} from a config object. */
export async function createClientsBackend(config: ClientsBackendConfig): Promise<ClientsBackend> {
    switch (config.clientsBackend) {
        case 'file':
            return await FileClientsBackend.createInstance(config, true);
    }
}