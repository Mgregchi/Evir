const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { run } = require("../../tools/browser.cjs");
(async () => {
  const out = "research/results/project-library";
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  await run(async (page, browser) => {
    const origin = "http://127.0.0.1:8776",
      studio = origin + "/apps/web/dist/editor/studio/";
    const saved = (p) =>
      p.waitForFunction(
        () =>
          document.querySelector("#save-status").textContent ===
          "Saved in this browser",
      );
    const library = async (p) => {
      await p
        .getByRole("button", { name: "Project menu", exact: true })
        .click();
      await p.locator("#project-library").click();
      await p.getByLabel("Search projects", { exact: true }).waitFor();
    };
    const importFixture = async (p, id, name) => {
      const project = JSON.parse(
        fs.readFileSync(`apps/web/assets/examples/${id}.evir-project`),
      );
      project.name = name;
      await p.locator("#file").setInputFiles({
        name: `${id}.evir-project`,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(project)),
      });
      await p.locator("#replace-confirm").click();
      await p.waitForFunction(
        (name) => evirStudio.snapshot().name === name,
        name,
      );
      await saved(p);
      return project;
    };
    for (const width of [320, 390, 844, 1440]) {
      console.log(`Library workflow: ${width}px`);
      const height = width === 844 ? 390 : 844,
        context = await browser.newContext({
          viewport: { width, height },
          reducedMotion: "reduce",
        }),
        p = await context.newPage();
      context.setDefaultTimeout(20000);
      if (width === 844)
        await context.addInitScript(() => {
          globalThis.BroadcastChannel = undefined;
        });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(studio);
      await p.waitForFunction(() => window.evirStudio);
      await saved(p);
      const sprig = await importFixture(p, "sprig", "Library sprig");
      await importFixture(p, "signal", "Library signal");
      await library(p);
      await p.getByLabel("Search projects", { exact: true }).fill("sprig");
      await p
        .getByRole("button", { name: "Open Library sprig", exact: true })
        .waitFor();
      await p.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      assert.equal(
        (
          await p.evaluate(() =>
            axe.run(document.querySelector("#advanced-sheet")),
          )
        ).violations.length,
        0,
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await p.screenshot({ path: `${out}/library-${width}x${height}.png` });
      await p
        .getByRole("button", { name: "Open Library sprig", exact: true })
        .focus();
      await p.keyboard.press("Enter");
      await p.locator("#replace-confirm").click();
      await p.waitForFunction(
        () => evirStudio.snapshot().name === "Library sprig",
      );
      assert.deepEqual(
        await p.evaluate(() => evirStudio.snapshot().nodes),
        sprig.nodes,
      );
      // Opening a project can schedule a fitted-camera recovery write after
      // layout. Establish a settled revision before opening the competing tab.
      await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await saved(p);
      const revision = () => p.evaluate(async()=>{
        const {ProjectRecovery}=await import('/packages/studio/recovery.mjs');
        const recovery=new ProjectRecovery();
        try{return (await recovery.read()).session;}finally{await recovery.close();}
      });
      const beforeOpening=await revision();
      // Two actual tabs share one revision. Opening the second tab must not write it.
      const other = await context.newPage();
      await other.goto(studio);
      await other.waitForFunction(() => window.evirStudio);
      await saved(other);
      assert.deepEqual(await revision(),beforeOpening,"opening a second tab preserves the saved project revision");
      await p.locator("#project-name").fill("Sprig from first tab");
      await p.locator("#project-name").dispatchEvent("change");
      await saved(p);
      if (width !== 844)
        await other.locator("#recovery-conflict").waitFor({ state: "visible" });
      await other.locator("#project-name").fill("Sprig from second tab");
      await other.locator("#project-name").dispatchEvent("change");
      // Download does not imply the conflicting browser write succeeded.
      await other.waitForFunction(
        () =>
          document.querySelector("#save-status").textContent ===
          "Newer version in another tab",
      );
      await other
        .getByRole("button", { name: "Save a separate copy", exact: true })
        .click();
      await saved(other);
      await other.reload();
      await other.waitForFunction(
        () =>
          window.evirStudio &&
          evirStudio.snapshot().name === "Sprig from second tab",
      );
      await saved(other);
      await library(other);
      await other.getByLabel("Search projects", { exact: true }).fill("Sprig");
      await other
        .getByRole("button", { name: "Open Sprig from first tab", exact: true })
        .waitFor();
      await other.getByRole("button", { name: "Done", exact: true }).click();
      // Layout changes in the other tab must not reclaim the saved copy as the
      // last active project or create a new authored save revision.
      const beforeResize = await revision();
      await p.setViewportSize({width:width+1,height});
      await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await saved(p);
      assert.deepEqual(await revision(),beforeResize,"automatic refitting must not save a background tab over the last active project");
      await p.setViewportSize({width,height});
      // The first tab's source is retained and a new conflict can resolve to latest.
      await p.reload();
      await p.waitForFunction(
        () =>
          window.evirStudio &&
          evirStudio.snapshot().name === "Sprig from second tab",
      ).catch(async error => {
        console.error('Reload recovery mismatch', {width, current:await p.evaluate(()=>({name:window.evirStudio?.snapshot().name,status:document.querySelector('#save-status')?.textContent})), other:await other.evaluate(()=>({name:window.evirStudio?.snapshot().name,status:document.querySelector('#save-status')?.textContent}))});
        throw error;
      });
      await saved(p);
      await other.locator("#project-name").fill("Latest shared sprig");
      await other.locator("#project-name").dispatchEvent("change");
      await saved(other);
      if (width === 844) {
        await p.locator("#project-name").fill("Stale local edits");
        await p.locator("#project-name").dispatchEvent("change");
      }
      await p.locator("#recovery-conflict").waitFor({ state: "visible" });
      await p.getByRole("button", { name: "Open latest", exact: true }).click();
      await p.locator("#replace-confirm").click();
      await p.waitForFunction(
        () => evirStudio.snapshot().name === "Latest shared sprig",
      );
      assert.equal(await p.locator("#recovery-conflict").isVisible(), false);
      await p
        .getByRole("button", { name: "Project menu", exact: true })
        .click();
      await p.getByRole("button", { name: "New", exact: true }).click();
      await p.locator("#replace-confirm").click();
      await p.waitForFunction(() => evirStudio.snapshot().nodes.length === 0);
      await saved(p);
      await library(p);
      await p
        .getByLabel("Search projects", { exact: true })
        .fill("Latest shared");
      await p
        .getByRole("button", { name: "Open Latest shared sprig", exact: true })
        .waitFor();
      await p.screenshot({ path: `${out}/retained-${width}x${height}.png` });
      if (width === 1440) {
        await p.getByRole("button", { name: "Done", exact: true }).click();
        const caption = await importFixture(p, "caption", "Prepared caption");
        await importFixture(p, "sprig", "Before asset preparation");
        const before = await p.evaluate(() => evirStudio.snapshot());
        await p.evaluate(() => {
          window.originalFontLoad = FontFace.prototype.load;
          FontFace.prototype.load = function () {
            window.assetPreparationPending = true;
            return new Promise((resolve) => {
              window.finishAssetPreparation = () =>
                resolve(window.originalFontLoad.call(this));
            });
          };
        });
        await library(p);
        await p
          .getByLabel("Search projects", { exact: true })
          .fill("Prepared caption");
        await p
          .getByRole("button", { name: "Open Prepared caption", exact: true })
          .click();
        await p.locator("#replace-confirm").click();
        await p.waitForFunction(() => window.assetPreparationPending);
        assert.equal(
          await p.locator("#project-switch-status").isVisible(),
          true,
        );
        assert.equal(
          await p.locator("#workspace").getAttribute("aria-busy"),
          "true",
        );
        assert.equal(await p.locator(".topbar").evaluate((n) => n.inert), true);
        await p.setViewportSize({ width: 1200, height: 844 });
        await p.setViewportSize({ width: 1440, height: 844 });
        await p.keyboard.press("r");
        assert.deepEqual(
          await p.evaluate(() => evirStudio.snapshot().nodes),
          before.nodes,
        );
        await p.screenshot({ path: `${out}/preparation-1440x844.png` });
        await p.evaluate(() => {
          window.finishAssetPreparation();
          FontFace.prototype.load = window.originalFontLoad;
        });
        await p.waitForFunction(
          () =>
            evirStudio.snapshot().name === "Prepared caption" &&
            document.querySelector("#workspace").getAttribute("aria-busy") ===
              "false",
        );
        assert.deepEqual(
          await p.evaluate(() => evirStudio.snapshot().nodes),
          caption.nodes,
        );
        assert.equal(
          await p.locator("#project-switch-status").isVisible(),
          false,
        );
        assert.equal(
          await p.locator(".topbar").evaluate((n) => n.inert),
          false,
        );
        await library(p);
        await p
          .getByLabel("Search projects", { exact: true })
          .fill("Before asset preparation");
        await p
          .getByRole("button", {
            name: "Open Before asset preparation",
            exact: true,
          })
          .waitFor();
      }
      assert.deepEqual(errors, []);
      results.push({
        width,
        height,
        checks: [
          "separate imports retained",
          "search",
          "keyboard open",
          "four-viewport reflow",
          "axe sheet zero violations",
          "cross-tab conflict",
          "save separate copy",
          "reload copy",
          "open latest",
          "New retains previous project",
          ...(width === 1440
            ? [
                "asset preparation keeps old source/save target",
                "busy controls and keyboard guard",
                "preparation feedback and resume",
              ]
            : []),
          ...(width === 844
            ? ["conflicts protected without BroadcastChannel"]
            : []),
        ],
      });
      await context.close();
    }
    // Real IndexedDB v1 migration and transaction-level protection without BroadcastChannel.
    const context = await browser.newContext(),
      p = await context.newPage();
    await p.goto(origin + "/tools/runtime.html");
    const source = JSON.parse(
      fs.readFileSync("apps/web/assets/examples/sprig.evir-project"),
    );
    const storage = await p.evaluate(async (project) => {
      const old = await new Promise((resolve, reject) => {
        const r = indexedDB.open("evir.studio.recovery.v1", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("projects");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = old.transaction("projects", "readwrite");
        tx.objectStore("projects").put(project, "current");
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
      old.close();
      const { ProjectRecovery } = await import("/packages/studio/recovery.mjs");
      const a = new ProjectRecovery(),
        b = new ProjectRecovery();
      const migrated = await a.read();
      if (JSON.stringify(migrated.project) !== JSON.stringify(project))
        throw Error("Migration changed original source");
      await b.read();
      const result = await Promise.allSettled([
        a.write({ ...project, name: "race A" }),
        b.write({ ...project, name: "race B" }),
      ]);
      if (
        result.filter((r) => r.status === "fulfilled").length !== 1 ||
        result.filter((r) => r.reason?.name === "RecoveryConflict").length !== 1
      )
        throw Error("Concurrent writes did not reject stale revision");
      // Page through 43 lightweight metadata rows; source assets remain in a separate store.
      for (let i = 0; i < 43; i++) {
        a.fresh();
        await a.write({
          ...project,
          name: `Paging ${String(i).padStart(2, "0")}`,
        });
      }
      const first = await a.list({ search: "Paging", page: 0 }),
        second = await a.list({ search: "Paging", page: 1 }),
        third = await a.list({ search: "Paging", page: 2 });
      if (
        first.items.length !== 20 ||
        second.items.length !== 20 ||
        third.items.length !== 3 ||
        !first.more ||
        !second.more ||
        third.more
      )
        throw Error("Paging is incorrect");
      if (
        new Set(
          [...first.items, ...second.items, ...third.items].map((x) => x.key),
        ).size !== 43
      )
        throw Error("Paging lost or repeated an entry");
      if (
        first.items.some(
          (x) => "project" in x || "assets" in x || typeof x.nodes !== "number",
        )
      )
        throw Error("Library listing cloned source payloads");
      if ((await a.list({ search: "no match" })).items.length)
        throw Error("Search did not filter");
      const currentSession = a.session();
      const different = first.items.find(
        (item) => item.key !== currentSession.key,
      );
      await a.read(different.key, { adopt: false });
      if (JSON.stringify(a.session()) !== JSON.stringify(currentSession))
        throw Error(
          "Preparing another project changed the save target before installation",
        );
      const session = a.session(),
        stored = await a.read(session.key);
      let rejected = false;
      try {
        await a.transaction("readwrite", (store) => {
          const req = store.put({ ...project, name: "Aborted" }, session.key);
          req.onsuccess = () => store.transaction.abort();
          return req;
        });
      } catch {
        rejected = true;
      }
      if (
        !rejected ||
        (await a.read(session.key)).project.name !== stored.project.name
      )
        throw Error("Abort changed source");
      const prior = a.session(),
        put = IDBObjectStore.prototype.put;
      let quota = false;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "projects")
          throw new DOMException("Storage full", "QuotaExceededError");
        return put.apply(this, args);
      };
      try {
        await a.write({ ...stored.project, name: "Quota write" });
      } catch (e) {
        quota = e.name === "QuotaExceededError";
      } finally {
        IDBObjectStore.prototype.put = put;
      }
      if (
        !quota ||
        JSON.stringify(a.session()) !== JSON.stringify(prior) ||
        (await a.read(prior.key)).project.name !== stored.project.name
      )
        throw Error("Quota failure changed source or revision");
      const stale = a.session();
      a.fresh();
      const fresh = a.session();
      await a.write(stored.project, stale);
      if (a.session().key !== fresh.key || a.session().revision !== 0)
        throw Error("Late old save changed active session");
      await a.close();
      await b.close();
      return {
        migration: "v1 current source retained exactly",
        race: result.map((x) => x.status),
        paging: [first.items.length, second.items.length, third.items.length],
        listing: "metadata only",
        preparation: "read without adoption retains active save target",
        abort: "retained source",
        quota: "source and revision rollback",
        staleCompletion: "cannot change active session",
      };
    }, source);
    results.push({ storage });
    context.setDefaultTimeout(20000);
    await p.goto(studio);
    await p.waitForFunction(() => window.evirStudio);
    await library(p);
    await p.getByLabel("Search projects", { exact: true }).fill("Paging");
    await p.waitForFunction(
      () =>
        document.querySelectorAll(".project-library-sheet article").length ===
        20,
    );
    await p.getByRole("button", { name: "Next projects", exact: true }).click();
    await p.waitForFunction(() =>
      document
        .querySelector(".project-library-sheet [role=status]")
        .textContent.startsWith("Page 2"),
    );
    assert.equal(await p.locator(".project-library-sheet article").count(), 20);
    await p.getByRole("button", { name: "Next projects", exact: true }).click();
    await p.waitForFunction(() =>
      document
        .querySelector(".project-library-sheet [role=status]")
        .textContent.startsWith("Page 3"),
    );
    assert.equal(await p.locator(".project-library-sheet article").count(), 3);
    assert(
      await p
        .getByRole("button", { name: "Next projects", exact: true })
        .isDisabled(),
    );
    await p
      .getByRole("button", { name: "Previous projects", exact: true })
      .focus();
    await p.keyboard.press("Enter");
    await p.waitForFunction(() =>
      document
        .querySelector(".project-library-sheet [role=status]")
        .textContent.startsWith("Page 2"),
    );
    await p.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(
      await p.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Project menu",
    );
    results.push({
      libraryUI: [
        "20-row bound",
        "next/previous pages",
        "last-page disabled Next",
        "keyboard paging",
        "Done restores Project menu focus",
      ],
    });
    await context.close();
  });
  fs.writeFileSync(
    `${out}/browser.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope:
          "Real Chromium IndexedDB and two browser tabs; automated software evidence, no physical/human claim",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Project library browser checks passed");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
