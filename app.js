    request.onerror = () => resolve(null);
    transaction.onerror = () => resolve(null);
  });

  db.close();
  return value;
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
  topic.updatedAt = new Date().toISOString();
  editingId = null;
  saveTopics();
  render();
}

function toSheetText(items) {
  return items.map((topic) => topic.text).join("\n");
}

function setTemporaryButtonText(button, text, originalText) {
  button.textContent = text;
  setTimeout(() => {
    button.textContent = originalText;
  }, 1400);
}

function setSaveStatus(message, isWarning = false) {
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
