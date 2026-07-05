import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FileClientsBackend } from "./file";
import { makeClientRedirectVerifier } from "./verifier";

let tempDirs: string[] = [];

const tempJsonPath = async (contents: object): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), "mtls-clients-"));
    tempDirs.push(dir);
    const path = join(dir, "clients.json");
    await writeFile(path, JSON.stringify(contents, null, 2));
    return path;
};

afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
});

describe("FileClientsBackend", () => {
    test("looks up clients by id", async () => {
        const path = await tempJsonPath({
            freezer: {
                id: "freezer",
                type: "public",
                redirect_uris: ["https://rp.cone.com/callback"],
            },
        });
        const backend = await FileClientsBackend.createInstance({ clientsFilePath: path });

        expect(await backend.getClient("freezer")).toEqual({
            id: "freezer",
            type: "public",
            redirect_uris: ["https://rp.cone.com/callback"],
        });
        expect(await backend.getClient("missing")).toBeNull();
    });

    test("persists clients and verifies registered redirect URIs", async () => {
        const path = await tempJsonPath({});
        const backend = await FileClientsBackend.createInstance({ clientsFilePath: path });

        await backend.setClient({
            id: "waffle-cone",
            type: "public",
            redirect_uris: ["https://rp.cone.com/openid/callback"],
        });

        expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
            "waffle-cone": {
                id: "waffle-cone",
                type: "public",
                redirect_uris: ["https://rp.cone.com/openid/callback"],
            },
        });

        const verifier = makeClientRedirectVerifier(backend);
        if (!verifier)
            throw new Error("Expected redirect verifier");

        expect(await verifier({
            clientID: "waffle-cone",
            redirectURI: "https://rp.cone.com/openid/callback",
        }, new Request("https://auth.cone.com/authorize"))).toBe(true);
        expect(await verifier({
            clientID: "waffle-cone",
            redirectURI: "https://evil.example/callback",
        }, new Request("https://auth.cone.com/authorize"))).toBe(false);
    });
});
