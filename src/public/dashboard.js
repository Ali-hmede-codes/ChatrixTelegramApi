const API_BASE = "";

async function fetchJSON(url) {
  const res = await fetch(API_BASE + url);
  return res.json();
}

async function loadChannels() {
  const result = await fetchJSON("/channels/state");
  if (!result.success) return;

  const list = document.getElementById("channel-list");
  list.innerHTML = "";

  result.data.forEach((ch) => {
    const row = document.createElement("div");
    row.className = "channel-row";
    row.innerHTML = `
      <div class="channel-info">
        <span class="channel-uid">${ch.uid}</span>
        <span class="channel-name">${ch.name}</span>
        <span class="channel-username">@${ch.username || "N/A"}</span>
        <span class="status-badge ${ch.enabled ? "active" : "inactive"}">
          ${ch.enabled ? "ON" : "OFF"}
        </span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" data-uid="${ch.uid}" ${ch.enabled ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", handleToggle);
  });

  updateStats(result.summary);
}

async function handleToggle(e) {
  const uid = e.target.dataset.uid;
  const badge = e.target.closest(".channel-row").querySelector(".status-badge");

  try {
    const result = await fetchJSON(`/channels/${uid}/toggle`);
    if (result.success) {
      badge.className = `status-badge ${result.data.enabled ? "active" : "inactive"}`;
      badge.textContent = result.data.enabled ? "ON" : "OFF";
    } else {
      e.target.checked = !e.target.checked;
    }
  } catch {
    e.target.checked = !e.target.checked;
  }

  loadFeed();
}

async function loadFeed() {
  const result = await fetchJSON("/feed?limit=30&hours=1");
  if (!result.success) return;

  const list = document.getElementById("feed-list");
  list.innerHTML = "";

  if (result.data.length === 0) {
    list.innerHTML = '<p class="loading">No messages in the last hour</p>';
    return;
  }

  result.data.forEach((msg) => {
    const el = document.createElement("div");
    el.className = `feed-msg ${msg.isDuplicate ? "duplicate" : ""}`;

    const time = new Date(msg.date * 1000).toLocaleTimeString();
    const text = msg.text || "";

    let dupInfo = "";
    if (msg.isDuplicate) {
      dupInfo = `<div class="dup-info">&#8635; DUPLICATE of msg #${msg.duplicateOf} (similarity ${Math.round((msg.similarity || 0) * 100)}%)</div>`;
    }

    el.innerHTML = `
      <span class="msg-time">[${time}]</span>
      <span class="msg-channel">${msg.channelName}:</span>
      <div class="msg-text">${text}</div>
      ${dupInfo}
    `;
    list.appendChild(el);
  });
}

function updateStats(summary) {
  if (!summary) return;
  document.getElementById("stats-text").textContent =
    `${summary.enabled} channels active | ${summary.total} total registered`;
}

async function init() {
  await loadChannels();
  await loadFeed();
  setInterval(loadFeed, 30000);
}

init();