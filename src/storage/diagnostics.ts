/** User-initiated diagnostics; denial is visible and never triggers an in-memory fallback. */
export async function storageStatus(storage: StorageManager | undefined = globalThis.navigator?.storage) {
    if (!storage)
        return { supported: false, persisted: false, usage: null, quota: null };
    const [estimate, persisted] = await Promise.all([storage.estimate(), storage.persisted()]);
    return { supported: true, persisted, usage: estimate.usage ?? null, quota: estimate.quota ?? null };
}
export async function requestPersistence(storage: StorageManager | undefined = globalThis.navigator?.storage): Promise<boolean> {
    if (!storage?.persist)
        return false;
    return storage.persist();
}
