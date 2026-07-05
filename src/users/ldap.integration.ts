import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

import { LdapUserBackend } from "./ldap";

let container: StartedTestContainer | undefined;
let backend: LdapUserBackend | undefined;

after(async () => {
    if (backend)
        (backend as unknown as { client: { destroy(): void } }).client.destroy();

    await container?.stop();
});

describe("LdapUserBackend", () => {
    before(async () => {
        container = await new GenericContainer("ghcr.io/rroemhild/docker-test-openldap:master")
            .withExposedPorts(10389)
            .withWaitStrategy(Wait.forListeningPorts())
            .start();

        backend = await LdapUserBackend.createInstance({
            ldapUrl: `ldap://${container.getHost()}:${container.getMappedPort(10389)}`,
            ldapBindDn: "cn=admin,dc=planetexpress,dc=com",
            ldapBindPassword: "GoodNewsEveryone",
        });
    }, { timeout: 120_000 });

    test("maps an LDAP entry to OIDC user claims", async () => {
        if (!backend)
            throw new Error("Expected LDAP backend");

        const claims = await backend.getClaims("cn=Philip J. Fry,ou=people,dc=planetexpress,dc=com");

        assert.deepEqual(claims, {
            sub: "cn=Philip J. Fry,ou=people,dc=planetexpress,dc=com",
            preferred_username: "fry",
            email: "fry@planetexpress.com",
            name: "Fry",
        });
    });

    test("returns null when the LDAP entry does not exist", async () => {
        if (!backend)
            throw new Error("Expected LDAP backend");

        assert.equal(
            await backend.getClaims("cn=Missing Person,ou=people,dc=planetexpress,dc=com"),
            null,
        );
    });
});
