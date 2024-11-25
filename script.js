// ==UserScript==
// @name         NexusManager
// @namespace    http://tampermonkey.net/
// @version      2024-04-03
// @description  try to take over the world!
// @author       Timothy Metcalfe
// @match        https://www.nexusmods.com/*/mods/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nexusmods.com
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  const {"3": modId} = {...window.location.pathname.split("/")};

  function create(tag, props = {}) {
    const newEl = document.createElement(tag);
    Object.assign(newEl, props);
    return newEl;
  }

  function hide(query, base = document) {
    find(query, base).style.display = "none";
  }

  function show(query, base = document) {
    find(query, base).style.display = "";
  }

  function find(query, base = document) {
    return base.querySelector(query);
  }

  function findAll(query, base = document) {
    return base.querySelectorAll(query);
  }

  function after(me, you) {
    you.after(me);
  }

  function addTo(el, target = document.querySelector("body")) {
    (typeof target === "string" ? document.querySelector(target) : target).appendChild(el);
  }

  function readEntries() {
    const entries = JSON.parse(localStorage.getItem("tims-nexusmanager")) || {};
    return entries;
  }

  function getEntryValue(k, id = modId) {
    return k.split(".").reduce((acc, ki) => acc?.[ki], readEntries()?.[id]);
  }

  function writeEntries(updatedEntries) {
    localStorage.setItem("tims-nexusmanager", JSON.stringify(updatedEntries));
  }

  function updateEntry(k, v, id = modId) {
    const entries = readEntries();
    const keychain = k.split(".");
    let entry = entries[id];
    if (!entry) {
      entry = entries[id] = {};
    }
    let pointer = entry;
    keychain.slice(0, -1).forEach((k) => {
      pointer = pointer[k] = (pointer[k] || {});
    });
    pointer[keychain.slice(-1)[0]] = typeof v === "function" ? v(pointer[keychain.slice(-1)[0]]) : v;
    writeEntries(entries);
  }

  function addToEntrySet(k, v, id = modId) {
    const entries = readEntries();
    let entry = entries[id];
    if (!entry) {
      entry = entries[id] = {};
    }
    entry[k] = k in entry ? [...new Set(entry[k].concat(v))] : [v];
    writeEntries(entries);
  }

  function updateTitle(newTitle) {
    updateEntry("title", newTitle);
  }

  function setupUi() {
    setupTitle();
    setupNotes();
    setupReqs();
    setupActionMenu();
    setupReview();
  }

  function setupTitle() {
    const titleEl = document.querySelector("#pagetitle > h1");

    if (!titleEl) {
      console.error("Title element not found.");
      return;
    }

    titleEl.setAttribute("contenteditable", "true");
    updateEntry("modTitle", titleEl.innerText.trim());
    const initialTitle = getEntryValue("title") || getEntryValue("modTitle");
    titleEl.textContent = initialTitle;

    titleEl.addEventListener("input", (e) => {
      updateTitle(e.target.textContent.trim());
    }, false);
  }

  function setupNotes() {
    const container = create("div", {
      classList: "tims-nexus-notes-container"
    });
    const input = create("textarea", {
      value: getEntryValue("notes") || "",
      classList: "tim-nexus-notes"
    });
    input.addEventListener("keyup", (e) => {
      updateEntry("notes", e.target.value);
    });
    container.appendChild(input);
    after(container, find("#featured"));
  }

  function updateCustomDeps() {
    const tables = [...document.querySelectorAll(".accordion dd table")];
    const reqTable = tables.find((tableEl) => tableEl.parentNode.querySelector("h3")?.innerText === "Nexus requirements");
    const additionalDeps = getEntryValue("additionalDeps") || [];
    const mods = readEntries();
    document.querySelectorAll(".custom-dep").forEach(e => e.remove());
    for (const depId of additionalDeps) {
      const dep = mods[depId];
      const row = create("tr", {className: "custom-dep", innerHTML: `<td class="table-require-name">
			  <a href="https://www.nexusmods.com/skyrimspecialedition/mods/${depId}" data-tracking="[&quot;Mod Page&quot;,&quot;View Required Mod&quot;,&quot;https:\/\/www.nexusmods.com\/skyrimspecialedition\/mods\/${depId}&quot;]">${dep?.modTitle || depId}</a>
			</td>
		  <td class="table-require-notes">Added manually.</td>`});
      addSwitchToDepRow(row);
      addTo(row, reqTable.querySelector("tbody"));
    }
  }

  function setupReqs() {
    const header = document.querySelector('.accordion:has([data-tracking*="View Requirements"]) dd:first-of-type h3');
    if (header.innerText === "This mod does not have any known dependencies other than the base game.") {
      after(create("table", {className: "table desc-table", innerHTML: `<thead>
				<tr>
					<th class="table-require-name header headerSortDown"><span class="table-header">Mod name</span></th>
					<th class="table-require-notes"><span class="table-header">Notes</span></th>
			</thead>
      <tbody>
      </tbody>`}), header);
      header.innerText = "Nexus requirements";
    }
    const tables = [...document.querySelectorAll(".accordion dd table")];
    const reqTable = tables.find((tableEl) => tableEl.parentNode.querySelector("h3")?.innerText === "Nexus requirements");
    if (!reqTable) {
      return;
    }
    const headerRow = reqTable.querySelector("thead tr");
    const headerCell = create("th");
    headerCell.innerText = "Req";
    headerRow.appendChild(headerCell);
    const tableRows = [...reqTable.querySelectorAll("tbody tr")];
    tableRows.forEach(addSwitchToDepRow);
    updateCustomDeps();
  }

  function addSwitchToDepRow(tableRow) {
    const reqModId = tableRow.querySelector(".table-require-name a")?.href.split("/").pop();
    if (!reqModId) return;
    updateEntry(`reqs.${reqModId}`, (p) => p === undefined ? null : p);
    const actionCell = create("td");
    const label = create("label");
    const span = create("span");
    const addReqButton = create("input");

    label.appendChild(addReqButton);
    label.appendChild(span);
    actionCell.appendChild(label);
    tableRow.appendChild(actionCell);

    label.classList = "tim-global-switch";
    span.classList = "tim-global-slider tim-global-round";

    addReqButton.setAttribute("type", "checkbox");
    const required = getEntryValue(`reqs.${reqModId}`);
    if (required === null) {
      addReqButton.indeterminate = true;
    } else {
      addReqButton.checked = required;
    }
    addReqButton.addEventListener("click", (e) => {
      updateEntry(`reqs.${reqModId}`, e.target.checked);
    });
  }

  function addToPack() {
    updateEntry("added", true);
    hide("#action-custom-add");
    show("#action-custom-remove");
  }

  function removeFromPack() {
    updateEntry("added", false);
    hide("#action-custom-remove");
    show("#action-custom-add");
  }

  function reviewPack() {
    find("#review-dialog").open = true;
    updatePackDialog();
  }

  function addDep() {
    const depId = prompt("What's the dep's ID?")?.trim();
    if (!depId) return;
    addToEntrySet("additionalDeps", depId);
    updateEntry(`reqs.${depId}`, true);
    updateCustomDeps();
  }

  function setupActionMenu() {
    addAction("Remove", removeFromPack);
    addAction("Add", addToPack);
    if (getEntryValue("added")) {
      hide("#action-custom-add");
    } else {
      hide("#action-custom-remove");
    }
    addAction("Add Dep", addDep)
    addAction("Review Pack", reviewPack);
  }

  function addAction(label, action) {
    const copier = document.querySelector("#action-manual").cloneNode(true);
    copier.id = `action-custom-${label.toLowerCase()}`;
    copier.classList.add("action-custom");
    copier.querySelector("a").removeAttribute("href");
    copier.querySelector("a").removeAttribute("data-tracking");
    copier.querySelector("a").classList.remove("download-open-tab");
    copier.querySelector("svg").remove();
    copier.querySelector(".flex-label").innerText = label;
    copier.addEventListener("click", action);
    addTo(copier, ".modactions");
  }

  function setupReview() {
    const content = create("div");
    const reviewPopup = createPopup("review-dialog", "Review Pack", content);
    addTo(reviewPopup);
  }

  function updatePackDialog() {
    const mods = readEntries();
    const packMods = [];

    function getModById(modId) {
      const mod = mods[modId];
      if (!mod) {
        throw new Error(`Missing mod ${modId}`);
      }
      return mod;
    }

    function getDependencies(depList, parentId) {
      for (const dep of depList) {
        if (!packMods.find(({ modId }) => dep === modId)) {
          try{
            const mod = getModById(dep);
            packMods.push({
              modId: dep,
              mod,
              req: true,
              missingDeps: [],
            });

            if (!mod.reqs) continue;
            const reqs = Object.entries(mod.reqs)
            .filter(([_modId, enabled]) => enabled)
            .map(([modId]) => modId);
            getDependencies(reqs, dep);
          } catch(e) {
            packMods.find(packMod => packMod.modId === parentId).missingDeps.push(dep);
          }
        }
      }
    }

    for (const modId in mods) {
      try {
        const mod = getModById(modId);
        if (mod.added) {
          packMods.push({
            modId,
            mod,
            added: true,
            missingDeps: [],
          });
        }
      } catch (e) {
        if (confirm(`Could not find added mod ${modId}. Go get the info?`)) {
          window.location.href =
            window.location.href.split("/").slice(0, -1).concat(modId).join("/");
        }
      }
    }

    for (const { mod, modId } of packMods) {
      if (!mod.reqs) continue;
      const reqs = Object.entries(mod.reqs)
      .filter(([_modId, enabled]) => enabled)
      .map(([modId]) => modId);
      getDependencies(reqs, modId);
    }

    const dialogBody = find("#review-dialog main");
    dialogBody.innerHTML = "";

    packMods.forEach((packMod) => {
      const unreviewedDeps = packMod.mod.reqs ? Object.entries(packMod.mod.reqs).filter(([k, v]) => v === null && !(packMods.find(e => e.modId === k)?.req === true || packMods.find(e => e.modId === k)?.added === true)).map(([k]) => k) : [];
      const card = create("div");
      card.classList.add("mod-card");
      if (packMod.missingDeps.length + unreviewedDeps.length) {
        card.classList.add("pull-up");
      }
      dialogBody.appendChild(card);

      const body = create("div");
      card.innerHTML += `<h2>
          <a href="${window.location.href.split("/").slice(0, -1).concat(packMod.modId).join("/")}">${packMod.mod.modTitle}</a>
        </h2>
        <div class="${packMod.missingDeps.length ? "" : "hidden"}">
          <h3>Unknown Deps</h3>
          ${packMod.missingDeps.map(dep => `<a href="${window.location.href.split("/").slice(0, -1).concat(dep).join("/")}">${dep}</a>`).join(" ")}
        </div>
        <div class="${unreviewedDeps.length ? "" : "hidden"}">
          <h3>Unreviewed Deps</h3>
          ${unreviewedDeps.map(dep => `<a href="${window.location.href.split("/").slice(0, -1).concat(dep).join("/")}">${mods[dep]?.modTitle || dep}</a>`).join(" ")}
        </div>`;
      addTo(body, card);
    });
  }

  function createPopup(id, title, content) {
    const popup = create("dialog", {id});

    const header = create("header");
    addTo(create("h1", {innerText: title}), header);
    const closeEl = create("button", {innerText: "x"});
    closeEl.addEventListener("click", () => {popup.open = false});
    addTo(closeEl, header);
    addTo(header, popup);

    const main = create("main");
    addTo(content, main);
    addTo(main, popup);

    return popup;
  }

  setupUi();
})();