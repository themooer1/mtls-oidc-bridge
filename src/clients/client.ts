/**
 * Client model and backend abstraction for managing OIDC Relying Parties.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Client type
// ---------------------------------------------------------------------------

export type ClientID = string

/** Base class for OIDC Relying Party client definitions */
interface ClientBase {
    readonly id: ClientID;
    readonly redirect_uris: string[];
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
    getClient(clientId: ClientID): Promise<Client | null>;
    /** Persist a new or updated client record. */
    setClient(client: Client): Promise<void>;
}