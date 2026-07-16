const app = document.querySelector("#app");

const state = {
  route: parseRoute(),
  owner: {
    handle: new URLSearchParams(location.search).get("handle") || localStorage.getItem("letter_owner_handle") || "demo",
    key: new URLSearchParams(location.search).get("key") || localStorage.getItem("letter_owner_key") || ""
  },
  introPlayed: false
};

applyTheme(getStoredTheme());

window.addEventListener("popstate", () => {
  state.route = parseRoute();
  render();
});

function parseRoute() {
  const path = location.pathname;
  if (path === "/inbox/new") return { name: "new" };
  if (path === "/inbox/recover") return { name: "recover" };
  if (path === "/inbox") return { name: "owner" };
  if (path.startsWith("/u/")) return { name: "profile", handle: decodeURIComponent(path.slice(3).split("/")[0]) };
  return { name: "home" };
}

function navigate(path) {
  history.pushState({}, "", path);
  state.route = parseRoute();
  render();
  scrollTo({ top: 0 });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.ownerKey ? { "x-inbox-key": options.ownerKey } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function absoluteUrl(path) {
  return `${location.origin}${path}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getStoredTheme() {
  try {
    return window.localStorage.getItem("ovo_theme") || "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    window.localStorage.setItem("ovo_theme", next);
  } catch {
    /* 视觉切换已完成；存储不可用时忽略。 */
  }
}

function avatarHtml(inbox, extraClass = "") {
  const label = (inbox?.penName || "OvO").trim().slice(0, 1).toUpperCase() || "O";
  const src = inbox?.avatarUrl ? `<img src="${escapeHtml(inbox.avatarUrl)}" alt="" />` : `<span>${escapeHtml(label)}</span>`;
  return `<span class="avatar ${extraClass}">${src}</span>`;
}

function layout(content) {
  return `
    <main class="shell">
      <header class="topbar">
        <button class="brand" data-nav="/">O<span>v</span>O</button>
        <nav class="nav">
          <button data-nav="/">主页</button>
          <button data-nav="/inbox/new">创建信箱</button>
          <button data-nav="/inbox">收信管理</button>
          <div class="mode-menu">
            <button class="mode-trigger" type="button" data-mode-trigger>模式选择</button>
            <div class="mode-options" hidden>
              <button type="button" data-theme-choice="light">日间模式</button>
              <button type="button" data-theme-choice="dark">夜间模式</button>
            </div>
          </div>
        </nav>
      </header>
      ${content}
    </main>
  `;
}

function introHtml() {
  return `
    <div class="intro" aria-hidden="true">
      <div class="intro-mark">
        <span class="intro-o intro-o-left">O</span>
        <span class="intro-v">W</span>
        <span class="intro-o intro-o-right">O</span>
      </div>
    </div>
  `;
}

function renderWithIntro(content) {
  const showIntro = !state.introPlayed;
  app.innerHTML = `${showIntro ? introHtml() : ""}${layout(content)}`;
  if (!showIntro) return;
  state.introPlayed = true;
  document.body.classList.add("intro-running");
  window.setTimeout(() => {
    const mark = app.querySelector(".intro-v");
    if (mark) mark.textContent = "V";
  }, 980);
  window.setTimeout(() => {
    document.body.classList.remove("intro-running");
    app.querySelector(".intro")?.remove();
  }, 3100);
}

function bindNav(scope = app) {
  scope.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });
  scope.querySelectorAll("[data-mode-trigger]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = button.closest(".mode-menu")?.querySelector(".mode-options");
      if (menu) menu.hidden = !menu.hidden;
    });
  });
  scope.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeChoice);
      scope.querySelectorAll(".mode-options").forEach((menu) => {
        menu.hidden = true;
      });
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".mode-options").forEach((menu) => {
    menu.hidden = true;
  });
});

function render() {
  if (state.route.name === "new") renderNewInbox();
  else if (state.route.name === "recover") renderRecover();
  else if (state.route.name === "owner") renderOwner();
  else if (state.route.name === "profile") renderProfile(state.route.handle);
  else renderHome();
}

function renderHome() {
  renderWithIntro(`
    <section class="hero">
      <h1>匿名写一句，认真回一封。</h1>
      <p>一个轻量的匿名来信箱。先把产品流程跑通，视觉细节可以按你的方向慢慢调。</p>
      <div class="actions">
        <button class="btn" data-nav="/inbox/new">创建我的信箱</button>
      </div>
    </section>
    <section class="grid">
      <article class="card">
        <h3>公开收信页</h3>
        <p class="subtle">每个用户都有自己的专属链接，比如 /u/ovo。别人点进去就是给这个人投匿名信的页面。</p>
      </article>
      <article class="card">
        <h3>收信管理页</h3>
        <p class="subtle">这是给信箱主人用的页面：查看别人写来的匿名信、公开回信，或者把不想处理的来信归档。</p>
      </article>
    </section>
  `);
  bindNav();
}

function renderNewInbox() {
  renderWithIntro(`
    <section class="panel">
      <h1 class="page-title">创建信箱</h1>
      <p class="subtle">先用链接名和展示名建立一个可访问的收信页。</p>
      <form class="form" id="new-inbox-form">
        <label>链接名
          <input name="handle" placeholder="例如 ovo" minlength="3" maxlength="24" required />
        </label>
        <label>展示名
          <input name="penName" placeholder="例如 OvO" maxlength="40" required />
        </label>
        <label>绑定邮箱（可选）
          <input name="ownerEmail" type="email" placeholder="不填也可以创建，填写后可用于邮箱找回" maxlength="120" />
        </label>
        <label>简介
          <textarea name="bio" maxlength="120" placeholder="一句话告诉别人可以写什么给你"></textarea>
        </label>
        <button class="btn" type="submit">创建</button>
        <p id="form-message" class="subtle"></p>
      </form>
    </section>
    ${recoverSectionHtml("compact")}
  `);
  bindNav();
  bindRecoverForms();
  app.querySelector("#new-inbox-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = app.querySelector("#form-message");
    message.className = "subtle";
    message.textContent = "正在创建...";
    try {
      const result = await api("/api/inboxes", {
        method: "POST",
        body: {
          handle: form.get("handle"),
          penName: form.get("penName"),
          ownerEmail: form.get("ownerEmail"),
          bio: form.get("bio")
        }
      });
      localStorage.setItem("letter_owner_handle", result.inbox.handle);
      localStorage.setItem("letter_owner_key", result.ownerKey);
      state.owner.handle = result.inbox.handle;
      state.owner.key = result.ownerKey;
      const displayPath = `/u/${encodeURIComponent(result.inbox.handle)}`;
      const managePath = result.manageUrl;
      const recoveryNote = result.inbox.emailBound
        ? "已绑定邮箱，可用邮箱或管理密钥找回。"
        : "未绑定邮箱，请保存接收链接和管理密钥，之后只能靠它们找回。";
      message.className = "success";
      message.innerHTML = `
        <span class="created-title">创建成功</span>
        <span class="created-links">
          <button class="created-link-card" type="button" data-nav="${escapeHtml(displayPath)}">
            <strong>展示链接</strong>
            <code>${escapeHtml(absoluteUrl(displayPath))}</code>
            <small>这个链接是用来展示的，他人点击此链接即可给你发送匿名信息</small>
          </button>
          <button class="created-link-card" type="button" data-nav="${escapeHtml(managePath)}">
            <strong>接收链接</strong>
            <code>${escapeHtml(absoluteUrl(managePath))}</code>
            <small>这个链接是你自己的收信页面，请妥善保存</small>
          </button>
        </span>
        <span class="subtle">管理密钥：<code class="key-code">${escapeHtml(result.ownerKey)}</code><br />${escapeHtml(recoveryNote)}</span>
      `;
      bindNav(message);
    } catch (err) {
      message.className = "error";
      message.textContent = err.message;
    }
  });
}

function renderRecover() {
  renderWithIntro(`
    ${recoverSectionHtml()}
  `);
  bindNav();
  bindRecoverForms();
}

function recoverSectionHtml(mode = "") {
  const title = mode === "compact" ? "找回已有信箱" : "找回收信管理";
  return `
    <section class="panel recover-panel">
      <h1 class="${mode === "compact" ? "" : "page-title"}">${title}</h1>
      <p class="subtle">如果创建时绑定了邮箱，可以用邮箱找回；没有绑定邮箱也可以用管理密钥找回。密钥请只给信箱主人保存。</p>
      <form class="form" id="recover-form">
        <label>链接名
          <input name="handle" placeholder="例如 ovo" minlength="3" maxlength="24" required />
        </label>
        <label>绑定邮箱
          <input name="ownerEmail" type="email" placeholder="you@example.com" maxlength="120" required />
        </label>
        <button class="btn secondary" type="submit">用邮箱找回</button>
        <p id="recover-message" class="subtle"></p>
      </form>
      <div class="recover-divider">或</div>
      <form class="form" id="recover-key-form">
        <label>管理密钥
          <input name="ownerKey" placeholder="例如 OVO1-2026-DEMO" maxlength="14" required />
        </label>
        <button class="btn secondary" type="submit">用密钥找回</button>
        <p id="recover-key-message" class="subtle"></p>
      </form>
    </section>
  `;
}

function bindRecoverForms() {
  app.querySelector("#recover-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = app.querySelector("#recover-message");
    message.className = "subtle";
    message.textContent = "正在匹配...";
    try {
      const result = await api("/api/inboxes/recover", {
        method: "POST",
        body: {
          handle: form.get("handle"),
          ownerEmail: form.get("ownerEmail")
        }
      });
      const params = new URLSearchParams(result.manageUrl.split("?")[1]);
      state.owner.handle = params.get("handle") || "";
      state.owner.key = params.get("key") || "";
      localStorage.setItem("letter_owner_handle", state.owner.handle);
      localStorage.setItem("letter_owner_key", state.owner.key);
      message.className = "success";
      message.innerHTML = recoverResultHtml(result);
      bindNav(message);
    } catch (err) {
      message.className = "error";
      message.textContent = err.message;
    }
  });
  app.querySelector("#recover-key-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = app.querySelector("#recover-key-message");
    message.className = "subtle";
    message.textContent = "正在匹配...";
    try {
      const result = await api("/api/inboxes/recover-key", {
        method: "POST",
        body: {
          ownerKey: form.get("ownerKey")
        }
      });
      state.owner.handle = result.inbox.handle;
      state.owner.key = result.ownerKey;
      localStorage.setItem("letter_owner_handle", state.owner.handle);
      localStorage.setItem("letter_owner_key", state.owner.key);
      message.className = "success";
      message.innerHTML = recoverResultHtml(result);
      bindNav(message);
    } catch (err) {
      message.className = "error";
      message.textContent = err.message;
    }
  });
}

function recoverResultHtml(result) {
  return `已找到 ${escapeHtml(result.inbox.penName)} 的信箱。<br />链接名：<code class="key-code">${escapeHtml(result.inbox.handle)}</code><br />管理密钥：<code class="key-code">${escapeHtml(result.ownerKey)}</code><br /><button class="link-button" type="button" data-nav="${escapeHtml(result.manageUrl)}">进入收信管理</button>`;
}

async function renderProfile(handle) {
  app.innerHTML = layout(`<p class="empty">正在读取信箱...</p>`);
  bindNav();
  try {
    const { inbox } = await api(`/api/inboxes/${encodeURIComponent(handle)}`);
    renderWithIntro(`
      <section class="panel profile-home">
        <button class="profile-avatar-button" type="button" aria-label="选择头像">
          ${avatarHtml(inbox, "profile-avatar")}
        </button>
        <h1 class="page-title">${escapeHtml(inbox.penName)} 的匿名信箱</h1>
        <p class="profile-id">ID：${escapeHtml(inbox.handle)}</p>
        <p class="subtle">${escapeHtml(inbox.bio || "匿名写一句，TA 可能会回信给你。")}</p>
        <form class="form" id="letter-form">
          <label>悄悄话
            <textarea name="body" maxlength="600" placeholder="把想说的话写在这里" required></textarea>
          </label>
          <button class="btn" type="submit">匿名寄出</button>
          <p id="letter-message" class="subtle"></p>
        </form>
      </section>
      <section class="stack" style="margin-top:18px">
        <h2>已公开的信 <span class="pill">${inbox.replyCount}</span></h2>
        ${inbox.replies.length ? inbox.replies.map(replyCard).join("") : `<p class="empty">还没有已公开的信。</p>`}
      </section>
    `);
    bindNav();
    app.querySelector(".profile-avatar-button")?.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.click();
    });
    app.querySelector("#letter-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const body = new FormData(formElement).get("body");
      const message = app.querySelector("#letter-message");
      message.className = "subtle";
      message.textContent = "正在寄出...";
      try {
        await api(`/api/inboxes/${encodeURIComponent(handle)}/letters`, { method: "POST", body: { body } });
        formElement.reset();
        message.className = "success";
        message.textContent = "已经匿名寄出。";
      } catch (err) {
        message.className = "error";
        message.textContent = err.message;
      }
    });
  } catch (err) {
    renderWithIntro(`
      <section class="panel">
        <h1 class="page-title">没有找到这个信箱</h1>
        <p class="subtle">${escapeHtml(err.message)}。请检查专属链接是否正确，或创建/找回自己的信箱。</p>
        <div class="actions">
          <button class="btn" data-nav="/inbox/new">创建信箱</button>
          <button class="btn secondary" data-nav="/inbox/recover">找回信箱</button>
        </div>
      </section>
    `);
    bindNav();
  }
}

function replyCard(letter) {
  return `
    <article class="card letter">
      <div>
        <span class="pill">来信</span>
        <p class="letter-body">${escapeHtml(letter.body)}</p>
      </div>
      <div>
        <span class="pill">回信</span>
        <p class="reply-body">${escapeHtml(letter.reply)}</p>
      </div>
      <div class="letter-meta">${formatTime(letter.repliedAt || letter.createdAt)}</div>
    </article>
  `;
}

async function renderOwner() {
  const params = new URLSearchParams(location.search);
  if (params.get("handle")) state.owner.handle = params.get("handle");
  if (params.get("key")) state.owner.key = params.get("key");
  if (state.owner.handle) localStorage.setItem("letter_owner_handle", state.owner.handle);
  if (state.owner.key) localStorage.setItem("letter_owner_key", state.owner.key);

  renderWithIntro(`
    <section class="panel">
      <h1 class="page-title">收信管理</h1>
      <p class="subtle">这里是信箱主人使用的管理页。别人匿名写来的内容会先进入这里，只有你选择“公开回信”后，来信和回信才会出现在公开页。</p>
      <form class="form" id="owner-auth">
        <label>链接名
          <input name="handle" value="${escapeHtml(state.owner.handle)}" />
        </label>
        <label>管理密钥
          <input name="key" value="${escapeHtml(state.owner.key)}" />
        </label>
        <button class="btn" type="submit">读取来信</button>
        <button class="link-button inline" type="button" data-nav="/inbox/recover">忘记管理密钥？用邮箱找回</button>
      </form>
    </section>
    <section id="owner-list" class="stack" style="margin-top:18px"></section>
  `);
  bindNav();
  app.querySelector("#owner-auth").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.owner.handle = String(form.get("handle") || "");
    state.owner.key = String(form.get("key") || "");
    localStorage.setItem("letter_owner_handle", state.owner.handle);
    localStorage.setItem("letter_owner_key", state.owner.key);
    loadOwnerLetters();
  });
  if (state.owner.key) loadOwnerLetters();
}

async function loadOwnerLetters() {
  const mount = app.querySelector("#owner-list");
  mount.innerHTML = `<p class="empty">正在读取...</p>`;
  try {
    const result = await api(`/api/owner/inboxes/${encodeURIComponent(state.owner.handle)}/letters`, {
      ownerKey: state.owner.key
    });
    mount.innerHTML = `
      <div class="owner-profile card">
        <button class="avatar-button" type="button" data-avatar-pick aria-label="设置头像">
          ${avatarHtml(result.inbox, "owner-avatar")}
        </button>
        <div class="owner-profile-main">
          <strong>${escapeHtml(result.inbox.penName)} 的来信</strong>
          <span class="subtle">点击圆形头像可从相册或文件中选择图片。</span>
          <p class="subtle" data-avatar-message></p>
        </div>
        <button class="btn secondary" data-nav="/u/${escapeHtml(result.inbox.handle)}">打开公开页</button>
      </div>
      ${result.letters.length ? result.letters.map(ownerLetterCard).join("") : `<p class="empty">还没有来信。</p>`}
    `;
    bindNav(mount);
    bindAvatarPicker(mount, result.inbox);
    bindOwnerActions(mount);
  } catch (err) {
    mount.innerHTML = `<p class="empty error">${escapeHtml(err.message)}</p>`;
  }
}

function bindAvatarPicker(scope, inbox) {
  const button = scope.querySelector("[data-avatar-pick]");
  if (!button) return;
  button.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const message = scope.querySelector("[data-avatar-message]");
      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        if (message) {
          message.className = "error";
          message.textContent = "请选择 PNG、JPG 或 WebP 图片。";
        }
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        if (message) {
          message.className = "error";
          message.textContent = "图片请控制在 2MB 以内。";
        }
        return;
      }
      if (message) {
        message.className = "subtle";
        message.textContent = "正在保存头像...";
      }
      try {
        const avatarUrl = await fileToDataUrl(file);
        await api(`/api/owner/inboxes/${encodeURIComponent(inbox.handle)}/settings`, {
          method: "PATCH",
          ownerKey: state.owner.key,
          body: { avatarUrl }
        });
        await loadOwnerLetters();
      } catch (err) {
        if (message) {
          message.className = "error";
          message.textContent = err.message;
        }
      }
    });
    input.click();
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function ownerLetterCard(letter) {
  const canReply = letter.status !== "archived";
  return `
    <article class="card letter" data-letter-id="${escapeHtml(letter.id)}">
      <div class="letter-meta">
        <span>${formatTime(letter.createdAt)}</span>
        <span class="pill">${escapeHtml(statusLabel(letter.status))}</span>
      </div>
      <p class="letter-body">${escapeHtml(letter.body)}</p>
      ${letter.reply ? `<p class="reply-body"><strong>我的回信：</strong>${escapeHtml(letter.reply)}</p>` : ""}
      ${canReply ? `
        <div class="owner-tools">
          <textarea data-reply placeholder="写一封公开回信">${escapeHtml(letter.reply || "")}</textarea>
          <div class="actions" style="justify-content:flex-start;margin-top:0">
            <button class="btn" data-action="reply">公开回信</button>
            <button class="btn danger" data-action="archive">归档</button>
          </div>
          <p class="subtle" data-message></p>
        </div>
      ` : ""}
    </article>
  `;
}

function statusLabel(status) {
  if (status === "replied") return "已公开";
  if (status === "archived") return "已归档";
  return "未公开";
}

function confirmPublicReply() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-confirm-title">
        <h3 id="privacy-confirm-title">公开前确认</h3>
        <p>请注意已经隐藏了可能泄露隐私的信息</p>
        <div class="confirm-actions">
          <button class="btn" type="button" data-confirm-public><span class="button-icon" aria-hidden="true">✓</span> 我知道了</button>
          <button class="btn secondary" type="button" data-confirm-edit><span class="button-icon" aria-hidden="true">↩</span> 再编辑一下</button>
        </div>
      </div>
    `;
    document.body.append(overlay);
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector("[data-confirm-public]").addEventListener("click", () => finish(true));
    overlay.querySelector("[data-confirm-edit]").addEventListener("click", () => finish(false));
  });
}

function bindOwnerActions(scope) {
  scope.querySelectorAll("[data-action='reply']").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-letter-id]");
      const message = card.querySelector("[data-message]");
      const canPublish = await confirmPublicReply();
      if (!canPublish) {
        message.className = "subtle";
        message.textContent = "可以继续编辑。";
        card.querySelector("[data-reply]")?.focus();
        return;
      }
      message.className = "subtle";
      message.textContent = "正在保存...";
      try {
        await api(`/api/owner/letters/${encodeURIComponent(card.dataset.letterId)}/reply`, {
          method: "POST",
          ownerKey: state.owner.key,
          body: { reply: card.querySelector("[data-reply]").value }
        });
        await loadOwnerLetters();
      } catch (err) {
        message.className = "error";
        message.textContent = err.message;
      }
    });
  });
  scope.querySelectorAll("[data-action='archive']").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-letter-id]");
      const message = card.querySelector("[data-message]");
      message.textContent = "正在归档...";
      try {
        await api(`/api/owner/letters/${encodeURIComponent(card.dataset.letterId)}/archive`, {
          method: "POST",
          ownerKey: state.owner.key
        });
        await loadOwnerLetters();
      } catch (err) {
        message.className = "error";
        message.textContent = err.message;
      }
    });
  });
}

render();
