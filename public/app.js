const app = document.querySelector("#app");

const state = {
  route: parseRoute(),
  owner: {
    handle: new URLSearchParams(location.search).get("handle") || localStorage.getItem("letter_owner_handle") || "demo",
    key: new URLSearchParams(location.search).get("key") || localStorage.getItem("letter_owner_key") || ""
  },
  ownerIntroPlayed: false
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
          <button data-nav="/inbox/new">创建信箱</button>
          <button data-nav="/u/demo">示例</button>
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

function ownerIntroHtml() {
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
  app.innerHTML = layout(`
    <section class="hero">
      <h1>匿名写一句，认真回一封。</h1>
      <p>一个轻量的匿名来信箱。先把产品流程跑通，视觉细节可以按你的方向慢慢调。</p>
      <div class="actions">
        <button class="btn" data-nav="/inbox/new">创建我的信箱</button>
        <button class="btn secondary" data-nav="/u/demo">看看公开页</button>
      </div>
    </section>
    <section class="grid">
      <article class="card">
        <h3>公开收信页</h3>
        <p class="subtle">每个用户有自己的 /u/链接，访客匿名提交内容，主人可以选择是否公开回信。</p>
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
  app.innerHTML = layout(`
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
        <label>绑定邮箱
          <input name="ownerEmail" type="email" placeholder="用于长期绑定和找回管理入口" maxlength="120" required />
        </label>
        <label>简介
          <textarea name="bio" maxlength="120" placeholder="一句话告诉别人可以写什么给你"></textarea>
        </label>
        <button class="btn" type="submit">创建</button>
        <p id="form-message" class="subtle"></p>
      </form>
    </section>
  `);
  bindNav();
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
      message.className = "success";
      message.innerHTML = `创建成功。公开页：<button class="link-button" type="button" data-nav="/u/${escapeHtml(result.inbox.handle)}">/u/${escapeHtml(result.inbox.handle)}</button><br />管理密钥：<code class="key-code">${escapeHtml(result.ownerKey)}</code>`;
      bindNav(message);
    } catch (err) {
      message.className = "error";
      message.textContent = err.message;
    }
  });
}

function renderRecover() {
  app.innerHTML = layout(`
    <section class="panel">
      <h1 class="page-title">找回收信管理</h1>
      <p class="subtle">输入信箱链接名和创建时绑定的邮箱。当前原型会在匹配后直接显示管理入口；正式上线时建议改成发送邮件验证码或魔法链接。</p>
      <form class="form" id="recover-form">
        <label>链接名
          <input name="handle" placeholder="例如 ovo" minlength="3" maxlength="24" required />
        </label>
        <label>绑定邮箱
          <input name="ownerEmail" type="email" placeholder="you@example.com" maxlength="120" required />
        </label>
        <button class="btn" type="submit">找回</button>
        <p id="recover-message" class="subtle"></p>
      </form>
    </section>
  `);
  bindNav();
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
      message.innerHTML = `已找到 ${escapeHtml(result.inbox.penName)} 的信箱。<button class="link-button" type="button" data-nav="${escapeHtml(result.manageUrl)}">进入收信管理</button>`;
      bindNav(message);
    } catch (err) {
      message.className = "error";
      message.textContent = err.message;
    }
  });
}

async function renderProfile(handle) {
  app.innerHTML = layout(`<p class="empty">正在读取信箱...</p>`);
  bindNav();
  try {
    const { inbox } = await api(`/api/inboxes/${encodeURIComponent(handle)}`);
    app.innerHTML = layout(`
      <section class="panel">
        <button class="profile-avatar-button" type="button" aria-label="选择头像">
          ${avatarHtml(inbox, "profile-avatar")}
        </button>
        <h1 class="page-title">写给 ${escapeHtml(inbox.penName)}</h1>
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
        <h2>公开回信 <span class="pill">${inbox.replyCount}</span></h2>
        ${inbox.replies.length ? inbox.replies.map(replyCard).join("") : `<p class="empty">还没有公开回信。</p>`}
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
    app.innerHTML = layout(`<p class="empty error">${escapeHtml(err.message)}</p>`);
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

  const showIntro = !state.ownerIntroPlayed;
  app.innerHTML = `${showIntro ? ownerIntroHtml() : ""}${layout(`
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
  `)}`;
  if (showIntro) {
    state.ownerIntroPlayed = true;
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
        <span class="pill">${escapeHtml(letter.status)}</span>
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

function bindOwnerActions(scope) {
  scope.querySelectorAll("[data-action='reply']").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-letter-id]");
      const message = card.querySelector("[data-message]");
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
