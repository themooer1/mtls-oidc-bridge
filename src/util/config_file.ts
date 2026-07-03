import { readFile, writeFile } from "node:fs/promises";

export class ConfigFile<T extends object> {
    readonly data: T;

    private constructor(
        private readonly path: string,
        data: T,
    ) {
        this.data = data;
    }

    static async open<T extends object>(
        path: string,
        create: boolean = false,
    ): Promise<ConfigFile<T>> {
        try {
            const text = await readFile(path, "utf8");
            return new ConfigFile(path, JSON.parse(text) as T);
        } catch (err: any) {
            if (err.code === "ENOENT" && create) {
                const data = {} as T;
                await writeFile(path, JSON.stringify(data, null, 2));
                return new ConfigFile(path, data);
            }

            throw err;
        }
    }

    async save(): Promise<void> {
        await writeFile(this.path, JSON.stringify(this.data, null, 2));
    }
}