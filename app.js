const storageKey = "rhk-chair-game-topics";

const samples = [
  "M!LK知ってる人！",
  "Mrs. GREEN APPLE（ミセス・グリーン・アップル）の歌が好きな人",
  "泳ぐのが好きな人！",
];

let topics = loadTopics();

const form = document.querySelector("#topicForm");
const nameInput = document.querySelector("#nameInput");
const topicInputs = [document.querySelector("#topic1"), document.querySelector("#topic2"), document.querySelector("#topic3")];
const searchInput = document.querySelector("#searchInput");
const topicList = document.querySelector("#topicList");
const sheetText = document.querySelector("#sheetText");
const totalTopics = document.querySelector("#totalTopics");
const copyButton = document.querySelector("#copyButton");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const owner = nameInput.value.trim() || "名前なし";
  const newTopics = topicInputs
    .map((input) => input.value.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      owner,
      createdAt: new Date().toISOString(),
    }));

  if (newTopics.length === 0) return;

  topics.push(...newTopics);
  saveTopics();
  form.reset();
  topicInputs[0].focus();
  render();
});

searchInput.addEventListener("input", render);

copyButton.addEventListener("click", async () => {
  const text = toSheetText(topics);

  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "コピー済み";
  } catch {
    sheetText.focus();
    sheetText.select();
    copyButton.textContent = "選択しました";
  }

  setTimeout(() => {
    copyButton.textContent = "コピー";
  }, 1400);
});

topicList.addEventListener("click", (event) => {
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

let editingId = null;

function loadTopics() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return samples.map((text) => ({
      id: crypto.randomUUID(),
      text,
      owner: "サンプル",
      createdAt: new Date().toISOString(),
    }));
  }

  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveTopics() {
  localStorage.setItem(storageKey, JSON.stringify(topics));
}

function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = topics.filter((topic) => `${topic.text} ${topic.owner}`.toLowerCase().includes(keyword));

  totalTopics.textContent = topics.length;
  sheetText.value = toSheetText(topics);
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
  editingId = null;
  saveTopics();
  render();
}

function toSheetText(items) {
  return items.map((topic) => topic.text).join("\n");
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
