import { Option } from 'commander';

/**
 * CLI Options for the user backend, shared by any command that needs to look up users.
 * Returns a fresh array each call so Commander doesn't reuse Option instances.
 */
export const userBackendOptions = () => [
    new Option(
        '--user-backend <backend>',
        'User lookup backend (file | ldap)',
    ).env('USER_BACKEND').choices(['file', 'ldap']).makeOptionMandatory(),

    // file backend
    new Option(
        '--user-file-path <path>',
        '[file backend] Path to the users file',
    ).env('USER_FILE_PATH'),

    // ldap backend
    new Option('--ldap-url <url>',          '[ldap backend] ldap:// URL').env('LDAP_URL'),
    new Option('--ldap-bind-dn <dn>',       '[ldap backend] Bind DN').env('LDAP_BIND_DN'),
    new Option('--ldap-bind-password <pw>', '[ldap backend] Bind password').env('LDAP_BIND_PASSWORD'),
];

/**
 * CLI Options for the clients backend, shared by any command that needs to manage clients.
 * Returns a fresh array each call so Commander doesn't reuse Option instances.
 */
export const clientsBackendOptions = () => [
    new Option(
        '--clients-backend <backend>',
        'Clients store backend (file)',
    ).env('CLIENTS_BACKEND').choices(['file']).makeOptionMandatory(),

    new Option(
        '--clients-file-path <path>',
        '[file backend] Path to the clients JSON store',
    ).env('CLIENTS_FILE_PATH').makeOptionMandatory(),
];

/**
 * CLI Options for the global logger.
 * Returns a fresh array each call so Commander doesn't reuse Option instances.
 */
export const loggerOptions = () => [
    new Option(
        '--log-level <level>',
        'Global log level (debug|info|warn|error)',
    ).env('LOG_LEVEL').choices(['debug', 'info', 'warn', 'error']).default('info'),
];
