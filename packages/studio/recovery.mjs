export const RECOVERY_DB = "evir.studio.recovery.v1";
export const LEGACY_PROJECT_KEY = "evir.studio.project.v1";
export class RecoveryConflict extends Error {
  constructor() {
    super(
      "Another tab saved a newer version. Open latest or save your changes as a separate copy.",
    );
    this.name = "RecoveryConflict";
  }
}

// Sources and lightweight metadata are separate: browsing never clones assets.
export class ProjectRecovery {
  constructor(
    indexedDB = globalThis.indexedDB,
    legacy = () => globalThis.localStorage,
  ) {
    Object.assign(this, { indexedDB, legacy, connection: null });
    this.fresh();
  }
  fresh() {
    this.active = { key: globalThis.crypto.randomUUID(), revision: 0 };
  }
  session() {
    return { ...this.active };
  }
  database() {
    if (this.connection) return this.connection;
    this.connection = new Promise((resolve, reject) => {
      if (!this.indexedDB)
        return reject(Error("Browser project storage is unavailable"));
      const request = this.indexedDB.open(RECOVERY_DB, 2);
      let blocked = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("projects"))
          db.createObjectStore("projects");
        db.createObjectStore("library").createIndex("updated", "updated");
        db.createObjectStore("state");
        const tx = request.transaction,
          projects = tx.objectStore("projects");
        const old = projects.get("current");
        old.onsuccess = () => {
          if (!old.result) return;
          try {
            const key = globalThis.crypto.randomUUID();
            projects.put(old.result, key);
            projects.delete("current");
            tx.objectStore("library").put(
              this.summary(old.result, key, 1),
              key,
            );
            tx.objectStore("state").put(key, "last");
          } catch {
            tx.abort();
          }
        };
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(
          Error(
            "Close older Evir tabs, then retry to update browser project storage",
          ),
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
  summary(project, key, revision) {
    return {
      key,
      revision,
      name: project.name,
      updated: Date.now(),
      nodes: project.nodes.length,
      artboards: project.artboards.length,
    };
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
  async read(key, { adopt = true } = {}) {
    const db = await this.database();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(["projects", "library", "state"], "readwrite");
      let result = null,
        failure;
      const load = (key) => {
        if (!key) return;
        const source = tx.objectStore("projects").get(key);
        const meta = tx.objectStore("library").get(key);
        meta.onsuccess = () => {
          try {
            if (!source.result || !meta.result) return;
            result = {
              project: source.result,
              session: { key, revision: meta.result.revision },
            };
            tx.objectStore("state").put(key, "last");
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
      };
      if (key) load(key);
      else {
        const last = tx.objectStore("state").get("last");
        last.onsuccess = () => load(last.result);
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(failure || tx.error || Error("Could not open saved project"));
    });
    if (result) {
      if (adopt) this.active = result.session;
      return result;
    }
    if (key) throw Error("Saved project is no longer available");
    const legacyText = this.legacy()?.getItem(LEGACY_PROJECT_KEY);
    return legacyText ? { legacyText } : null;
  }
  async list({ search = "", page = 0, size = 20 } = {}) {
    const db = await this.database(),
      query = String(search).trim().toLocaleLowerCase();
    page = Number.isSafeInteger(page) && page >= 0 ? page : 0;
    size = Number.isSafeInteger(size) ? Math.max(1, Math.min(50, size)) : 20;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("library", "readonly"),
        items = [];
      let matched = 0,
        more = false;
      const req = tx
        .objectStore("library")
        .index("updated")
        .openCursor(null, "prev");
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const item = cursor.value;
        if (String(item.name).toLocaleLowerCase().includes(query)) {
          if (matched++ >= page * size) {
            if (items.length === size) {
              more = true;
              return;
            }
            items.push(item);
          }
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve({ items, more });
      tx.onabort = tx.onerror = () =>
        reject(tx.error || Error("Could not list saved projects"));
    });
  }
  async write(project, session = this.session()) {
    // Capture key/revision before any await. Compare and write share one transaction.
    const { key, revision } = session,
      db = await this.database();
    const next = await new Promise((resolve, reject) => {
      const tx = db.transaction(["projects", "library", "state"], "readwrite");
      let conflict = false,
        failure;
      const library = tx.objectStore("library"),
        req = library.get(key);
      req.onsuccess = () => {
        try {
          if ((req.result?.revision || 0) !== revision) {
            conflict = true;
            tx.abort();
            return;
          }
          library.put(this.summary(project, key, revision + 1), key);
          tx.objectStore("projects").put(project, key);
          tx.objectStore("state").put(key, "last");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve({ key, revision: revision + 1 });
      tx.onabort = tx.onerror = () =>
        reject(
          conflict
            ? new RecoveryConflict()
            : failure ||
                tx.error ||
                Error("Browser project storage transaction failed"),
        );
    });
    if (this.active.key === key && this.active.revision === revision)
      this.active = next;
    try {
      this.legacy()?.removeItem(LEGACY_PROJECT_KEY);
    } catch {}
    return next;
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
