const storageKey = "rhk-chair-game-topics";
const backupKey = "rhk-chair-game-topics-backup";
const sessionKey = "rhk-chair-game-topics-session";
const databaseName = "rhk-chair-game";
const databaseStore = "topic-data";
const databaseRecordKey = "latest";

const samples = [
  "M!LK知ってる人！",
  "Mrs. GREEN APPLE（ミセス・グリーン・アップル）の歌が好きな人",
  "泳ぐのが好きな人！",
];

let topics = loadTopics();
let editingId = null;

const form = document.querySelector("#topicForm");
const nameInput = document.querySelector("#nameInput");
const topicInputs = [document.querySelector("#topic1"), document.querySelector("#topic2"), document.querySelector("#topic3")].filter(Boolean);
const searchInput = document.querySelector("#searchInput");
const topicList = document.querySelector("#topicList");
const sheetText = document.querySelector("#sheetText");
const totalTopics = document.querySelector("#totalTopics");
const copyButton = document.querySelector("#copyButton");
const backupButton = document.querySelector("#backupButton");
const restoreInput = document.querySelector("#restoreInput");
const saveStatus = document.querySelector("#saveStatus");

requestPersistentStorage();
restoreFromBrowserDatabase();

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const owner = nameInput?.value.trim() || "名前なし";
  const newTopics = topicInputs
    .map((input) => input.value.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  if (newTopics.length === 0) return;

  topics.push(...newTopics);
  saveTopics();
  form.reset();
  topicInputs[0]?.focus();
  render();
});

searchInput?.addEventListener("input", render);

copyButton?.addEventListener("click", async () => {
  const text = toSheetText(topics);

  try {
    await navigator.clipboard.writeText(text);
    setTemporaryButtonText(copyButton, "コピー済み", "コピー");
  } catch {
    sheetText?.focus();
    sheetText?.select();
    setTemporaryButtonText(copyButton, "選択しました", "コピー");
  }
});

backupButton?.addEventListener("click", () => {
  const data = JSON.stringify(createSaveData(topics), null, 2);
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `otagai-wo-shirou-backup-${formatDateForFile(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setSaveStatus("バックアップを保存しました。");
});

restoreInput?.addEventListener("change", async () => {
  const file = restoreInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const restored = parseSavedTopics(text);
    if (!restored.length) {
      setSaveStatus("復元できるお題が見つかりませんでした。", true);
      return;
    }

    const shouldReplace = confirm("バックアップの内容で、今の一覧を置き換えますか？");
    if (!shouldReplace) return;

    topics = restored;
    editingId = null;
    saveTopics();
    render();
    setSaveStatus("バックアップから復元しました。");
  } catch {
    setSaveStatus("バックアップの読み込みに失敗しました。", true);
  } finally {
    restoreInput.value = "";
  }
});

topicList?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");
  const moveButton = event.target.closest("[data-move-id]");
  const editButton = event.target.closest("[data-edit-id]");
  const saveButton = event.target.closest("[data-save-id]");
  const cancelButton = event.target.closest("[data-cancel-id]");

  if (deleteButton) {
    topics = topics.filter((topic) => topic.id !== deleteButton.dataset.deleteId);
    saveTopics();
    render();
    return;
  }

  if (moveButton) {
    moveTopic(moveButton.dataset.moveId, moveButton.dataset.direction);
    return;
  }

  if (editButton) {
    setEditing(editButton.dataset.editId);
    return;
  }

  if (saveButton) {
    saveEdit(saveButton.dataset.saveId);
    return;
  }

  if (cancelButton) {
    setEditing(null);
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey || !event.newValue) return;

  const latest = parseSavedTopics(event.newValue);
  if (latest.length >= topics.length) {
    topics = latest;
    editingId = null;
    render();
    setSaveStatus("別のタブで保存された内容を反映しました。");
  }
});

function loadTopics() {
  const candidates = [localStorage.getItem(storageKey), localStorage.getItem(backupKey), sessionStorage.getItem(sessionKey)]
    .map(parseSavedTopics)
    .filter((items) => items.length > 0);

  if (candidates.length > 0) {
    return candidates.sort(compareTopicSets)[0];
  }

  return createSampleTopics();
}

function createSampleTopics() {
  const now = new Date().toISOString();
  return samples.map((text) => ({
    id: crypto.randomUUID(),
    text,
    owner: "サンプル",
    createdAt: now,
    updatedAt: now,
  }));
}

function saveTopics() {
  const data = JSON.stringify(createSaveData(topics));
  let savedSomewhere = false;

  try {
    localStorage.setItem(storageKey, data);
    localStorage.setItem(backupKey, data);
    savedSomewhere = true;
  } catch {
    // Continue to the other save routes below.
  }

  try {
    sessionStorage.setItem(sessionKey, data);
    savedSomewhere = true;
  } catch {
    // Continue to IndexedDB below.
  }

  saveTopicsToBrowserDatabase(data).then((savedToDatabase) => {
    if (savedSomewhere || savedToDatabase) {
      setSaveStatus("自動保存済みです。");
    } else {
      setSaveStatus("自動保存できませんでした。バックアップを保存してください。", true);
    }
  });
}

function createSaveData(items) {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    topics: items,
  };
}

function compareTopicSets(a, b) {
  const latestA = latestTopicTime(a);
  const latestB = latestTopicTime(b);

  if (latestA !== latestB) return latestB - latestA;
  return b.length - a.length;
}

function latestTopicTime(items) {
  return Math.max(
    ...items.map((item) => {
      const value = Date.parse(item.updatedAt || item.createdAt || "");
      return Number.isNaN(value) ? 0 : value;
    }),
    0,
  );
}

function parseSavedTopics(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    const items = Array.isArray(parsed) ? parsed : parsed.topics;
    if (!Array.isArray(items)) return [];

    return items
      .filter((item) => item && typeof item.text === "string" && item.text.trim())
      .map((item) => ({
        id: item.id || crypto.randomUUID(),
        text: item.text.trim(),
        owner: item.owner || "名前なし",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

async function restoreFromBrowserDatabase() {
  const saved = await loadTopicsFromBrowserDatabase();
  const restored = parseSavedTopics(saved);
  if (restored.length === 0) return;

  const currentIsSampleOnly = topics.length === samples.length && topics.every((topic) => topic.owner === "サンプル");
  const restoredIsBetter = currentIsSampleOnly || compareTopicSets(restored, topics) < 0;
  if (!restoredIsBetter) return;

  topics = restored;
  editingId = null;
  render();
  setSaveStatus("保存済みのお題を復元しました。");
}

function openTopicDatabase() {
  if (!window.indexedDB) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(databaseStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function saveTopicsToBrowserDatabase(data) {
  const db = await openTopicDatabase();
  if (!db) return false;

  const saved = await new Promise((resolve) => {
    const transaction = db.transaction(databaseStore, "readwrite");
    transaction.objectStore(databaseStore).put(data, databaseRecordKey);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });

  db.close();
  return saved;
}

async function loadTopicsFromBrowserDatabase() {
  const db = await openTopicDatabase();
  if (!db) return null;

  const value = await new Promise((resolve) => {
    const transaction = db.transaction(databaseStore, "readonly");
    const request = transaction.objectStore(databaseStore).get(databaseRecordKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    transaction.onerror = () => resolve(null);
  });

  db.close();
  return value;
}

function render() {
  const keyword = searchInput?.value.trim().toLowerCase() || "";
  const filtered = topics.filter((topic) => `${topic.text} ${topic.owner}`.toLowerCase().includes(keyword));

  if (totalTopics) totalTopics.textContent = topics.length;
  if (sheetText) sheetText.value = toSheetText(topics);
  if (!topicList) return;

  topicList.innerHTML = filtered.length
    ? filtered.map((topic, index) => topicTemplate(topic, index)).join("")
    : '<div class="empty">まだお題がありません。左の入力欄から登録してください。</div>';
}

function topicTemplate(topic, index) {
  const isFirst = index === 0;
  const isLast = index === topics.length - 1;
  const isEditing = editingId === topic.id;

  if (isEditing) {
    return `
      <article class="topic-card editing">
        <span class="topic-number">${index + 1}</span>
        <div class="edit-fields">
          <label>
            お題
            <input class="edit-topic-input" data-edit-topic="${topic.id}" type="text" value="${escapeAttribute(topic.text)}" />
          </label>
          <label>
            名前
            <input class="edit-owner-input" data-edit-owner="${topic.id}" type="text" value="${escapeAttribute(topic.owner)}" />
          </label>
        </div>
        <div class="topic-tools">
          <button class="move-topic" type="button" data-save-id="${topic.id}">保存</button>
          <button class="delete-topic" type="button" data-cancel-id="${topic.id}">やめる</button>
        </div>
      </article>
    `;
  }

  return `
    <article class="topic-card">
      <span class="topic-number">${index + 1}</span>
      <div>
        <p>${escapeHtml(topic.text)}</p>
        <small>${escapeHtml(topic.owner)}さんの入力</small>
      </div>
      <div class="topic-tools">
        <button class="move-topic" type="button" data-move-id="${topic.id}" data-direction="up" ${isFirst ? "disabled" : ""}>上へ</button>
        <button class="move-topic" type="button" data-move-id="${topic.id}" data-direction="down" ${isLast ? "disabled" : ""}>下へ</button>
        <button class="move-topic" type="button" data-edit-id="${topic.id}">編集</button>
        <button class="delete-topic" type="button" data-delete-id="${topic.id}">削除</button>
      </div>
    </article>
  `;
}

function moveTopic(id, direction) {
  const index = topics.findIndex((topic) => topic.id === id);
  if (index === -1) return;

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= topics.length) return;

  const [topic] = topics.splice(index, 1);
  topics.splice(nextIndex, 0, topic);
  saveTopics();
  render();
}

function setEditing(id) {
  editingId = id;
  render();

  if (!id) return;
  const input = document.querySelector(`[data-edit-topic="${CSS.escape(id)}"]`);
  input?.focus();
}

function saveEdit(id) {
  const topicInput = document.querySelector(`[data-edit-topic="${CSS.escape(id)}"]`);
  const ownerInput = document.querySelector(`[data-edit-owner="${CSS.escape(id)}"]`);
  const topic = topics.find((item) => item.id === id);
  if (!topic || !topicInput) return;

  const nextText = topicInput.value.trim();
  if (!nextText) {
    topicInput.focus();
    return;
  }

  topic.text = nextText;
  topic.owner = ownerInput?.value.trim() || "名前なし";
  topic.updatedAt = new Date().toISOString();
  editingId = null;
  saveTopics();
  render();
}

function toSheetText(items) {
  return items.map((topic) => topic.text).join("\n");
}

function setTemporaryButtonText(button, text, originalText) {
  if (!button) return;

  button.textContent = text;
  setTimeout(() => {
    button.textContent = originalText;
  }, 1400);
}

function setSaveStatus(message, isWarning = false) {
  if (!saveStatus) return;

  saveStatus.textContent = message;
  saveStatus.classList.toggle("warning", isWarning);
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    setSaveStatus("自動保存の準備ができています。");
    return;
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    const granted = isPersisted || (await navigator.storage.persist());
    setSaveStatus(granted ? "自動保存済みです。" : "自動保存中です。大事なお題はバックアップも保存してください。", !granted);
  } catch {
    setSaveStatus("自動保存中です。大事なお題はバックアップも保存してください。", true);
  }
}

function formatDateForFile(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
