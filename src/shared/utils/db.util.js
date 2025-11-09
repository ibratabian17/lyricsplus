export class DbHandler {
    constructor(kvNamespace) {
        if (!kvNamespace) {
            throw new Error("KV Namespace must be provided to DbHandler constructor.");
        }
        this.kv = kvNamespace;
    }

    async get(key) {
        try {
            const value = await this.kv.get(key);
            if (typeof value === 'string') {
                return value ? JSON.parse(value) : null;
            }
            return value;
        } catch (error) {
            console.error(`Error getting key ${key}:`, error);
            return null;
        }
    }

    async set(key, value, expirationTtl = null) {
        try {
            const options = expirationTtl ? { expirationTtl } : {};
            const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
            await this.kv.put(key, valueToStore, options);
            return true;
        } catch (error) {
            console.error(`Error setting key ${key}:`, error);
            return false;
        }
    }

    async delete(key) {
        try {
            await this.kv.delete(key);
            return true;
        } catch (error) {
            console.error(`Error deleting key ${key}:`, error);
            return false;
        }
    }

    async list(prefix = null) {
        try {
            const options = prefix ? { prefix } : {};
            const list = await this.kv.list(options);
            return list.keys;
        } catch (error) {
            console.error('Error listing keys:', error);
            return [];
        }
    }
}