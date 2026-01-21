let db, currentDb = null,
  currentPath = [];

const dbList = document.getElementById("dbList");
const files = document.getElementById("files");
const pathEl = document.getElementById("path");
const messages = document.getElementById("messages");
const command = document.getElementById("command");
const fileInput = document.getElementById("fileInput");

document.getElementById("newFolder").onclick = createFolder;
document.getElementById("uploadBtn").onclick = uploadFile;
document.getElementById("addDb").onclick = addDatabase;

/* IndexedDB */
const req = indexedDB.open("FoxCloudDB", 1);
req.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("databases", { keyPath: "name" });
};
req.onsuccess = e => {
  db = e.target.result;
  loadDatabases();
};

/* Helpers */
function getFolder(root, path) {
  return path.reduce((a, b) => a.children[b], root);
}

/* Messages */
command.onkeydown = e => {
  if (e.key === "Enter" && currentDb) {
    const text = command.value.trim();
    if (!text) return;
    
    const tx = db.transaction("databases", "readwrite");
    const store = tx.objectStore("databases");
    store.get(currentDb).onsuccess = ev => {
      const d = ev.target.result;
      d.messages.push(text);
      store.put(d);
      renderMessages(d.messages);
      command.value = "";
    };
  }
};

function renderMessages(list) {
  messages.innerHTML = "";
  list.forEach(t => {
    const m = document.createElement("div");
    m.className = "msg";
    m.textContent = t;
    messages.appendChild(m);
  });
}

/* Databases */
function loadDatabases() {
  const tx = db.transaction("databases", "readonly");
  tx.objectStore("databases").getAll().onsuccess = e => {
    dbList.innerHTML = "";
    e.target.result.forEach(d => {
      const row = document.createElement("div");
      row.className = "db-item" + (d.name === currentDb ? " active" : "");
      row.onclick = () => openDb(d.name);
      row.innerHTML = `
        <span>${d.name}</span>
        <div class="db-actions">
          <span onclick="event.stopPropagation();renameDb('${d.name}')">#</span>
          <span onclick="event.stopPropagation();deleteDb('${d.name}')">↜</span>
        </div>`;
      dbList.appendChild(row);
    });
  };
}

function openDb(name) {
  currentDb = name;
  currentPath = [];
  command.disabled = false;
  
  const tx = db.transaction("databases", "readonly");
  tx.objectStore("databases").get(name).onsuccess = e => {
    renderFiles(e.target.result);
    renderMessages(e.target.result.messages);
  };
  loadDatabases();
}

/* Files */
function renderFiles(dbData) {
  files.innerHTML = "";
  pathEl.textContent = currentDb + (currentPath.length ? " › " + currentPath.join(" › ") : "");
  
  const folder = getFolder(dbData.root, currentPath);
  
  for (const k in folder.children) {
    const it = folder.children[k];
    const div = document.createElement("div");
    div.className = "item";
    
    const left = document.createElement("div");
    left.className = "item-left";
    left.textContent = (it.type === "folder" ? "▢ " : "+ ") + k;
    
    const actions = document.createElement("div");
    actions.className = "item-actions";
    
    if (it.type === "file") {
      const dl = document.createElement("span");
      dl.textContent = "↓";
      dl.onclick = e => {
        e.stopPropagation();
        const a = document.createElement("a");
        a.href = it.content;
        a.download = k;
        a.click();
      };
      actions.appendChild(dl);
    }
    
    const del = document.createElement("span");
    del.textContent = "↜";
    del.onclick = e => {
      e.stopPropagation();
      deleteItem(k);
    };
    
    actions.appendChild(del);
    div.append(left, actions);
    
    if (it.type === "folder") {
      div.onclick = () => {
        currentPath.push(k);
        openDb(currentDb);
      };
    }
    
    files.appendChild(div);
  }
}

/* CRUD */
function addDatabase() {
  const n = prompt("Database name:");
  if (!n) return;
  db.transaction("databases", "readwrite")
    .objectStore("databases")
    .put({ name: n, root: { children: {} }, messages: [] });
  loadDatabases();
}

function renameDb(oldName) {
  const n = prompt("Rename database:", oldName);
  if (!n) return;
  const tx = db.transaction("databases", "readwrite");
  const s = tx.objectStore("databases");
  s.get(oldName).onsuccess = e => {
    const d = e.target.result;
    s.delete(oldName);
    d.name = n;
    s.put(d);
    currentDb = n;
    loadDatabases();
  };
}

function deleteDb(name) {
  if (!confirm("Delete database?")) return;
  db.transaction("databases", "readwrite").objectStore("databases").delete(name);
  currentDb = null;
  command.disabled = true;
  files.textContent = "Select a database";
  pathEl.textContent = "Home";
  messages.innerHTML = "";
  loadDatabases();
}

function deleteItem(name) {
  const tx = db.transaction("databases", "readwrite");
  const s = tx.objectStore("databases");
  s.get(currentDb).onsuccess = e => {
    const d = e.target.result;
    delete getFolder(d.root, currentPath).children[name];
    s.put(d);
    openDb(currentDb);
  };
}

function createFolder() {
  if (!currentDb) return alert("Select database");
  const n = prompt("Folder name:");
  if (!n) return;
  const tx = db.transaction("databases", "readwrite");
  const s = tx.objectStore("databases");
  s.get(currentDb).onsuccess = e => {
    const d = e.target.result;
    getFolder(d.root, currentPath).children[n] = { type: "folder", children: {} };
    s.put(d);
    openDb(currentDb);
  };
}

function uploadFile() {
  if (!currentDb) return alert("Select database");
  fileInput.value = "";
  fileInput.click();
}

fileInput.onchange = () => {
  const f = fileInput.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const tx = db.transaction("databases", "readwrite");
    const s = tx.objectStore("databases");
    s.get(currentDb).onsuccess = e => {
      const d = e.target.result;
      getFolder(d.root, currentPath).children[f.name] = {
        type: "file",
        content: r.result
      };
      s.put(d);
      openDb(currentDb);
    };
  };
  r.readAsDataURL(f);
};