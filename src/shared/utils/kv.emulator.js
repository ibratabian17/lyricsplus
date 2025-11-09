// src/shared/utils/kv.emulator.js

export class KvEmulator {
    constructor(namespace) {
        this.namespace = namespace;
        this.store = new Map();
    }

    async get(key) {
        return this.store.get(key);
    }

    async put(key, value) {
        this.store.set(key, value);
    }

    async delete(key) {
        this.store.delete(key);
    }

    async list(options = {}) {
        const keys = [];
        for (const key of this.store.keys()) {
            if (!options.prefix || key.startsWith(options.prefix)) {
                keys.push({ name: key });
            }
        }
        return { keys };
    }
}
