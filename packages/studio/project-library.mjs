import { sheet } from "./advanced.mjs";
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (text, fn) => {
  const b = el("button", text);
  b.type = "button";
  b.onclick = fn;
  return b;
};

export function mountProjectLibrary(api) {
  const opener = button("Projects in this browser…", show);
  opener.id = "project-library";
  opener.setAttribute("aria-haspopup", "dialog");
  document.querySelector("#project-file-actions").prepend(opener);
  const alert = el("section");
  alert.id = "recovery-conflict";
  alert.hidden = true;
  alert.setAttribute("aria-label", "Project save conflict");
  const message = el(
    "p",
    "Another tab saved this project. Your edits are still here. Open the latest version or save a separate copy.",
  );
  message.setAttribute("role", "alert");
  const latest = button("Open latest", async () => {
    try {
      await api.latest();
    } catch (e) {
      api.notice(e);
    }
  });
  const copy = button("Save a separate copy", async () => {
    copy.disabled = true;
    try {
      await api.copy();
    } catch (e) {
      api.notice(e);
    } finally {
      copy.disabled = false;
    }
  });
  alert.append(message, latest, copy);
  document.querySelector(".topbar").after(alert);
  let channel;
  try {
    channel = new BroadcastChannel("evir.studio.projects.v2");
    channel.onmessage = ({ data }) => {
      const session = api.recovery.session();
      if (
        data?.key === session.key &&
        Number.isSafeInteger(data.revision) &&
        data.revision > session.revision
      )
        conflict();
    };
  } catch {} // Atomic IndexedDB checks still protect saves without this advisory channel.
  function conflict() {
    alert.hidden = false;
    api.status("Newer version in another tab");
  }
  async function show() {
    document.querySelector("#project-menu").hidePopover();
    if (!api.ready()) return;
    const dialog = sheet(
      "Projects in this browser",
      (host) => {
        host.className = "project-library-sheet";
        host.append(
          el(
            "p",
            "Saved on this browser and origin only. Download project copies for backup. Clearing site data removes this library.",
          ),
        );
        const label = el("label", "Search projects"),
          input = el("input");
        input.type = "search";
        input.setAttribute("aria-label", "Search projects");
        label.append(input);
        const list = el("div"),
          status = el("p");
        status.setAttribute("role", "status");
        const previous = button("Previous projects", () => {
            page--;
            load();
          }),
          next = button("Next projects", () => {
            page++;
            load();
          });
        const controls = el("nav");
        controls.setAttribute("aria-label", "Project pages");
        controls.append(previous, next);
        host.append(label, status, list, controls);
        let page = 0,
          request = 0;
        async function load() {
          const token = ++request;
          previous.disabled = next.disabled = true;
          try {
            const result = await api.recovery.list({
              search: input.value,
              page,
            });
            if (token !== request || !host.isConnected) return;
            list.replaceChildren();
            for (const item of result.items) {
              const row = el("article"),
                name = el("h3", item.name);
              const meta = el(
                "p",
                `${item.nodes} layers · ${item.artboards} artboards · ${new Date(item.updated).toLocaleString()}`,
              );
              row.append(name, meta);
              const open = button(`Open ${item.name}`, () => {
                dialog.close();
                api.open(item.key).catch(api.notice);
              });
              if (item.key === api.recovery.session().key) {
                open.textContent = "Current project";
                open.disabled = true;
              }
              row.append(open);
              list.append(row);
            }
            status.textContent = result.items.length
              ? `Page ${page + 1} · ${result.items.length} projects`
              : "No saved projects match.";
            previous.disabled = page === 0;
            next.disabled = !result.more;
          } catch (e) {
            if (token === request)
              status.textContent = `Could not load projects. ${e.message}`;
          }
        }
        input.oninput = () => {
          page = 0;
          load();
        };
        // The dialog is appended synchronously by sheet before requests resolve.
        load();
      },
      () => true,
      api.notice,
      document.querySelector('[aria-label="Project menu"]'),
    );
    dialog.querySelector(".dialog-actions button:last-child").remove();
    dialog.querySelector(".dialog-actions button").textContent = "Done";
  }
  return {
    conflict,
    clear() {
      alert.hidden = true;
    },
    saved(session) {
      alert.hidden = true;
      try {
        channel?.postMessage(session);
      } catch {}
    },
    close() {
      channel?.close();
    },
  };
}
