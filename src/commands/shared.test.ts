import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { requireSelectedUserBackendOptions } from "./shared";

const testCommand = (): Command =>
    new Command()
        .exitOverride()
        .configureOutput({ writeOut: () => {}, writeErr: () => {} });

describe("shared command options", () => {
    test("requires file user backend path when file backend is selected", () => {
        expect(() => requireSelectedUserBackendOptions(testCommand(), {
            userBackend: "file",
        })).toThrow("required option '--user-file-path <path>' not specified for file user backend");
    });

    test("requires ldap URL when ldap backend is selected", () => {
        expect(() => requireSelectedUserBackendOptions(testCommand(), {
            userBackend: "ldap",
        })).toThrow("required option '--ldap-url <url>' not specified for ldap user backend");
    });

    test("requires ldap bind DN when ldap backend is selected", () => {
        expect(() => requireSelectedUserBackendOptions(testCommand(), {
            userBackend: "ldap",
            ldapUrl: "ldap://directory.example",
        })).toThrow("required option '--ldap-bind-dn <dn>' not specified for ldap user backend");
    });

    test("requires ldap bind password when ldap backend is selected", () => {
        expect(() => requireSelectedUserBackendOptions(testCommand(), {
            userBackend: "ldap",
            ldapUrl: "ldap://directory.example",
            ldapBindDn: "cn=reader,dc=example,dc=test",
        })).toThrow("required option '--ldap-bind-password <pw>' not specified for ldap user backend");
    });

    test("accepts complete ldap backend options", () => {
        expect(() => requireSelectedUserBackendOptions(testCommand(), {
            userBackend: "ldap",
            ldapUrl: "ldap://directory.example",
            ldapBindDn: "cn=reader,dc=example,dc=test",
            ldapBindPassword: "secret",
        })).not.toThrow();
    });
});
