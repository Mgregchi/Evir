export const RECOVERY_DB = "evir.studio.recovery.v1";
export const LEGACY_PROJECT_KEY = "evir.studio.project.v1";

export class ProjectRecovery {
  constructor(
    indexedDB = globalThis.indexedDB,
    legacy = () => globalThis.localStorage,
  ) {
    this.indexedDB = indexedDB;
    this.legacy = legacy;
    this.connection = null;
  }
  database() {
    if (this.connection) return this.connection;
    this.connection = new Promise((resolve, reject) => {
      if (!this.indexedDB) {
        reject(Error("Browser project storage is unavailable"));
        return;
      }
      const request = this.indexedDB.open(RECOVERY_DB, 1);
      let blocked = false;
      request.onupgradeneeded = () =>
        request.result.createObjectStore("projects");
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(
          Error("Close other Evir tabs to update browser project storage"),
        );
      };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          this.connection = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      this.connection = null;
      throw error;
    });
    return this.connection;
  }
  async transaction(mode, operation) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("projects", mode);
      let request;
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(
          tx.error ||
            request?.error ||
            Error("Browser project storage transaction failed"),
        );
      try {
        request = operation(tx.objectStore("projects"));
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }
  async read() {
    const project = await this.transaction("readonly", (store) =>
      store.get("current"),
    );
    if (project) return { project };
    const legacyText = this.legacy()?.getItem(LEGACY_PROJECT_KEY);
    return legacyText ? { legacyText } : null;
  }
  async write(project) {
    await this.transaction("readwrite", (store) =>
      store.put(project, "current"),
    );
    // Remove the old recovery copy only after the new transaction commits.
    try {
      this.legacy()?.removeItem(LEGACY_PROJECT_KEY);
    } catch {}
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = null;
  }
}

// Coalesce edits and serialize writes. A completion from an older project must
// never mark a newer project saved; the host checks the sampled generation.
export class RecoveryQueue {
  constructor({ sample, write, saved, failed, delay = 250 }) {
    Object.assign(this, { sample, write, saved, failed, delay });
    this.sequence = 0;
    this.pending = false;
    this.running = null;
    this.timer = null;
    this.waiters = [];
  }
  request() {
    const id = ++this.sequence;
    this.pending = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
    return new Promise((resolve) => this.waiters.push({ id, resolve }));
  }
  cancel() {
    this.sequence++;
    this.pending = false;
    clearTimeout(this.timer);
    this.timer = null;
    for (const w of this.waiters) w.resolve(false);
    this.waiters = [];
  }
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.running) return this.running;
    if (!this.pending) return Promise.resolve(false);
    this.pending = false;
    const id = this.sequence;
    this.running = (async () => {
      let data,
        ok = false;
      try {
        data = this.sample();
        await this.write(data);
        ok = true;
        if (id === this.sequence) this.saved(data);
      } catch (error) {
        if (id === this.sequence) this.failed(error, data);
      }
      const settled = this.waiters.filter((w) => w.id <= id);
      this.waiters = this.waiters.filter((w) => w.id > id);
      for (const w of settled) w.resolve(ok);
      return ok;
    })().finally(() => {
      this.running = null;
      if (this.pending) return this.flush();
    });
    return this.running;
  }
}
