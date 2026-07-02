/**
 * Client model and backend abstraction for managing OIDC Relying Parties.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Client type
// ---------------------------------------------------------------------------

/** Base class for OIDC Relying Party client definitions */
interface ClientBase {
    readonly id: string;
    readonly redirect_uri: string;
}

/** A public client (no client secret — e.g. a SPA or native app). */
export interface PublicClient extends ClientBase {
    readonly type: 'public';
}

/** A private (confidential) client that authenticates with a hashed secret. */
export interface PrivateClient extends ClientBase {
    readonly type: 'private';
    /** bcrypt hash of the client secret. */
    readonly hashed_secret: string;
}

/** An OIDC client registration entry. */
export type Client = PublicClient | PrivateClient;

// ---------------------------------------------------------------------------
// ClientsBackend interface
// ---------------------------------------------------------------------------

/**
 * Pluggable backend for reading and writing client registrations.
 * Swap implementations freely via config without touching the rest of the app.
 */
export interface ClientsBackend {
    /** Retrieve a client by its ID, or `null` if not found. */
    getClient(clientId: string): Promise<Client | null>;
    /** Persist a new or updated client record. */
    saveClient(client: Client): Promise<void>;
    /** Return all registered clients. */
    listClients(): Promise<Client[]>;
}