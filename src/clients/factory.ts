import type { ClientsBackend } from "./client";
import type { ClientsBackendConfig } from "./config";
import { FileClientsBackend } from "./file";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Instantiate the correct {@link ClientsBackend} from a config object. */
export function createClientsBackend(config: ClientsBackendConfig): ClientsBackend {
    switch (config.clientsBackend) {
        case 'file':
            return new FileClientsBackend(config);
    }
}