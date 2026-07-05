import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FileUserBackend } from "./file";

let tempDirs: string[] = [];

const tempJsonPath = async (contents: object): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), "mtls-users-"));
    tempDirs.push(dir);
    const path = join(dir, "users.json");
    await writeFile(path, JSON.stringify(contents, null, 2));
    return path;
};

afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs = [];
});

describe("FileUserBackend", () => {
    test("looks up claims by certificate subject identifier", async () => {
        const path = await tempJsonPath({
            "CN=icecream": {
                sub: "icecream",
                preferred_username: "icecream",
                name: "Ice Cream",
                email: "icecream@cone.com",
            },
        });
        const backend = await FileUserBackend.createInstance({ userFilePath: path });

        expect(await backend.getClaims("CN=icecream")).toEqual({
            sub: "icecream",
            preferred_username: "icecream",
            name: "Ice Cream",
            email: "icecream@cone.com",
        });
        expect(await backend.getClaims("CN=missing")).toBeNull();
    });

    test("persists added users", async () => {
        const path = await tempJsonPath({});
        const backend = await FileUserBackend.createInstance({ userFilePath: path });

        await backend.set("CN=leela", {
            sub: "leela",
            name: "Turanga Leela",
            email: "leela@planetexpress.com",
        });

        expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
            "CN=leela": {
                sub: "leela",
                name: "Turanga Leela",
                email: "leela@planetexpress.com",
            },
        });
    });
});
