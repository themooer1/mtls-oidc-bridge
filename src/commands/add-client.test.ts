import { afterEach, describe, expect, test } from "bun:test";
import * as v from "valibot";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { addClient, AddClientConfigSchema, normalizeAddClientOptions } from "./add-client";

let tempDirs: string[] = [];

const tempJsonPath = async (contents: object): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), "mtls-add-client-"));
    tempDirs.push(dir);
    const path = join(dir, "clients.json");
    await writeFile(path, JSON.stringify(contents, null, 2));
    return path;
};

afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
});

describe("add-client command", () => {
    test("maps repeated --redirect-uri options to redirectUris config", () => {
        const config = v.parse(AddClientConfigSchema, normalizeAddClientOptions({
            clientsBackend: "file",
            clientsFilePath: "/tmp/clients.json",
            type: "public",
            redirectUri: [
                "https://rp.cone.com/callback",
                "https://rp.cone.com/alt-callback",
            ],
        }));

        expect(config.redirectUris).toEqual([
            "https://rp.cone.com/callback",
            "https://rp.cone.com/alt-callback",
        ]);
    });

    test("persists every registered redirect URI", async () => {
        const path = await tempJsonPath({});

        await addClient("waffle-cone", {
            clientsBackend: "file",
            clientsFilePath: path,
            type: "public",
            redirectUris: [
                "https://rp.cone.com/callback",
                "https://rp.cone.com/alt-callback",
            ],
        });

        expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
            "waffle-cone": {
                id: "waffle-cone",
                type: "public",
                redirect_uris: [
                    "https://rp.cone.com/callback",
                    "https://rp.cone.com/alt-callback",
                ],
            },
        });
    });
});
