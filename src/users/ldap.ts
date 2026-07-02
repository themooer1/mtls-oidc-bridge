import type { UserBackend, UserClaims } from "./users";

import * as ldap from 'ldapjs'

// ---------------------------------------------------------------------------
// LDAP backend
// ---------------------------------------------------------------------------

export interface LdapBackendConfig {
    ldapUrl: string;
    ldapBindDn: string;
    ldapBindPassword: string;
    ldapBaseDn: string;
}

/**
 * Stub LDAP user backend.
 * Replace the body of `getClaims` with a real ldap:// search.
 */
export class LdapUserBackend implements UserBackend {

    public static async createInstance(config: LdapBackendConfig): Promise<LdapUserBackend> {
        const client = new Promise<ldap.Client>((resolve, reject) => {
            let client = ldap.createClient({
                url: config.ldapUrl,
                reconnect: true
            });

            client.bind(config.ldapBindDn, config.ldapBindPassword, (err, res) => {
                if (err) reject(err);
                resolve(client);
            })
        })

        // TODO: get 'uid' subAttribute from config
        return new LdapUserBackend(await client, config.ldapBaseDn, 'uid');
    }

    private constructor(private readonly client: ldap.Client, private readonly userDN: string, private readonly subAttribute: string) {}

    mapClaims(entry: ldap.SearchEntryObject): UserClaims | null {
        if (!entry || !entry.attributes) {
            return null;
        }

        // Helper function to extract the first string value of an attribute safely
        const getSingleValue = (attributeName: string): string | undefined => {
            const attr = entry.attributes.find(a => a.type.toLowerCase() === attributeName.toLowerCase());
            if (!attr || !attr.values || attr.values.length === 0) {
            return undefined;
            }
            return attr.values[0];
        };

        // 1. Determine the 'sub' claim based on your class configuration.
        // If 'subAttribute' is set to 'dn' or 'objectName', use the entry's full DN.
        // Otherwise, look it up dynamically from the attributes array (e.g., 'uid' or 'objectGUID').
        let subClaim: string | undefined;
        
        if (this.subAttribute.toLowerCase() === 'dn' || this.subAttribute.toLowerCase() === 'objectname') {
            subClaim = entry.objectName;
        } else {
            subClaim = getSingleValue(this.subAttribute);
        }

        // If we can't establish a 'sub' claim, the OIDC token profile is invalid.
        if (!subClaim) {
            return null;
        }

        // 2. Map standard LDAP keys to standard OIDC claims

        // Base claims object which might be extended with other claims.
        let claims: UserClaims = {
            sub: subClaim,
        };

        // Typically mapped to 'uid' (OpenLDAP) or 'sAMAccountName' (Active Directory)
        const preferred_username =  getSingleValue('uid') || getSingleValue('sAMAccountName');
        if (preferred_username)
            claims = {...claims, preferred_username};

        const email = getSingleValue('mail');
        if (email)
            claims = {...claims, email};
            
        // Typically mapped to 'displayName' or 'cn'
        const name = getSingleValue('displayName') || getSingleValue('cn');
        if (name)
            claims = {...claims, name};

        return claims;
    }

    /**
     * Searches for claims about a user in an LDAP database
     * @param identifier The proxy-injected header containing the user's DN 
     * @returns UserClaims or null if the user wasn't found
     */
    async getClaims(identifier: string): Promise<UserClaims | null> {
        const entry = new Promise<ldap.SearchEntryObject | null>((resolve, reject) => {
            const opts: ldap.SearchOptions = {
                scope: 'base',
                // TODO: get these from config
                attributes: [this.subAttribute, 'displayName', 'mail']
            };

            this.client.search(identifier, opts, (err, res) => {
                if (err) reject(err);

                let entry: ldap.SearchEntryObject | null = null;
                res.on('searchEntry', e => entry = e.pojo);
                res.on('error', err => reject(err));
                res.on('end', () => resolve(entry))
            })
        })

        return entry.then(e => e ? this.mapClaims(e) : null);
    }
}