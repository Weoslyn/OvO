const app = document.querySelector("#app");

const state = {
  route: parseRoute(),
  owner: {
    handle: new URLSearchParams(location.search).get("handle") || localStorage.getItem("letter_owner_handle") || "",
    key: new URLSearchParams(location.search).get("key") || localStorage.getItem("letter_owner_key") || ""
  },
  squareSort: new URLSearchParams(location.search).get("sort") === "hot" ? "hot" : "new",
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
  if (path.startsWith("/square/")) return { name: "squarePost", id: decodeURIComponent(path.slice(8).split("/")[0]) };
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

function getVoterId() {
  try {
    let id = localStorage.getItem("ovo_square_voter");
    if (!id) {
      id = `voter_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem("ovo_square_voter", id);
    }
    return id;
  } catch {
    return `voter_${Date.now().toString(36)}`;
  }
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
          <button data-nav="/">广场</button>
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
  else if (state.route.name === "squarePost") renderSquarePost(state.route.id);
  else if (state.route.name === "profile") renderProfile(state.route.handle);
  else renderHome();
}

async function renderHome() {
  renderWithIntro(`
    <section class="hero">
      <h1>OvO的广场</h1>
      <p>OvO广场，让我们畅所欲言！</p>
      <div class="actions">
        <button class="btn" type="button" data-compose-square>发一条广场帖子</button>
      </div>
    </section>
    <section class="panel square-composer" hidden>
      <h2>发一条广场帖子</h2>
      <p class="subtle">提醒：帖子会以你匿名信箱的昵称展示。</p>
      <form class="form" id="square-post-form">
        <label>帖子内容
          <textarea name="body" maxlength="600" placeholder="写点想说的话" required></textarea>
        </label>
        <button class="btn" type="submit">发布到广场</button>
        <p id="square-post-message" class="subtle"></p>
      </form>
    </section>
    <section class="stack square-feed" style="margin-top:18px">
      <div class="section-header">
        <h2>广场帖子</h2>
        <div class="sort-control" aria-label="排序">
          <button class="${state.squareSort === "hot" ? "active" : ""}" type="button" data-sort-square="hot">最热</button>
          <button class="${state.squareSort === "new" ? "active" : ""}" type="button" data-sort-square="new">最新</button>
        </div>
      </div>
      <div id="square-list"><p class="empty">正在读取广场...</p></div>
    </section>
  `);
  bindNav();
  bindSquareHome();
  await loadSquarePosts();
}

function bindSquareHome() {
  app.querySelector("[data-compose-square]")?.addEventListener("click", () => {
    const composer = app.querySelector(".square-composer");
    if (!state.owner.handle || !state.owner.key) {
      composer.hidden = false;
      const message = app.querySelector("#square-post-message");
      message.className = "error";
      message.innerHTML = `发广场帖子前需要先拥有一个信箱。<button class="link-button inline" type="button" data-nav="/inbox/new">去创建或找回</button>`;
      bindNav(message);
      return;
    }
    composer.hidden = !composer.hidden;
    if (!composer.hidden) composer.querySelector("textarea")?.focus();
  });
  app.querySelectorAll("[data-sort-square]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.squareSort = button.dataset.sortSquare;
      app.querySelectorAll("[data-sort-square]").forEach((item) => item.classList.toggle("active", item === button));
      await loadSquarePosts();
    });
  });
  app.querySelector("#square-post-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const message = app.querySelector("#square-post-message");
    message.className = "subtle";
    message.textContent = "正在发布...";
    try {
      await api("/api/square/posts", {
        method: "POST",
        ownerKey: state.owner.key,
        body: {
          handle: state.owner.handle,
          body: new FormData(formElement).get("body")
        }
      });
      formElement.reset();
      message.className = "success";
      message.textContent = "已经发布到广场。";
      app.querySelector(".square-composer").hidden = true;
      await loadSquarePosts();
    } catch (err) {
      message.className = "error";
      message.textContent = err.message;
    }
  });
}

async function loadSquarePosts() {
  const mount = app.querySelector("#square-list");
  if (!mount) return;
  mount.innerHTML = `<p class="empty">正在读取广场...</p>`;
  try {
    const { posts } = await api(`/api/square/posts?sort=${encodeURIComponent(state.squareSort)}`);
    mount.innerHTML = posts.length ? posts.map(squarePostCard).join("") : `<p class="empty">广场还没有帖子。</p>`;
    bindNav(mount);
    bindSquarePostActions(mount);
  } catch (err) {
    mount.innerHTML = `<p class="empty error">${escapeHtml(err.message)}</p>`;
  }
}

function squarePostCard(post) {
  return `
    <article class="card square-post" data-post-id="${escapeHtml(post.id)}">
      <button class="post-main" type="button" data-nav="/square/${escapeHtml(post.id)}">
        <span class="post-author">
          ${avatarHtml(post.author, "post-avatar")}
          <span>
            <strong>${escapeHtml(post.author.penName)}</strong>
            <small>@${escapeHtml(post.author.handle || "square")}</small>
          </span>
        </span>
        <p class="letter-body">${escapeHtml(post.body)}</p>
      </button>
      <div class="post-footer">
        <span class="subtle">${formatTime(post.createdAt)} · ${post.commentCount} 条评论</span>
        <button class="like-button" type="button" data-like-post>赞 <span>${escapeHtml(post.likeCount)}</span></button>
      </div>
    </article>
  `;
}

function bindSquarePostActions(scope) {
  scope.querySelectorAll("[data-like-post]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-post-id]");
      try {
        const result = await api(`/api/square/posts/${encodeURIComponent(card.dataset.postId)}/like`, {
          method: "POST",
          body: { voterId: getVoterId() }
        });
        button.querySelector("span").textContent = result.likeCount;
        button.classList.add("liked");
      } catch (err) {
        button.textContent = err.message;
      }
    });
  });
}

async function renderSquarePost(id) {
  app.innerHTML = layout(`<p class="empty">正在读取帖子...</p>`);
  bindNav();
  try {
    const { post, comments } = await api(`/api/square/posts/${encodeURIComponent(id)}`);
    renderWithIntro(`
      <section class="panel square-detail" data-post-id="${escapeHtml(post.id)}">
        <span class="post-author">
          ${avatarHtml(post.author, "post-avatar")}
          <span>
            <strong>${escapeHtml(post.author.penName)}</strong>
            <small>@${escapeHtml(post.author.handle || "square")}</small>
          </span>
        </span>
        <p class="letter-body">${escapeHtml(post.body)}</p>
        <div class="post-footer">
          <span class="subtle">${formatTime(post.createdAt)} · ${post.commentCount} 条评论</span>
          <button class="like-button" type="button" data-like-post>赞 <span>${escapeHtml(post.likeCount)}</span></button>
        </div>
      </section>
      <section class="panel" style="margin-top:18px">
        <h2>评论</h2>
        <form class="comment-bar" id="comment-form">
          <input name="body" maxlength="400" placeholder="写一条评论" required />
          <button class="btn" type="submit">发表评论</button>
        </form>
        <p id="comment-message" class="subtle"></p>
      </section>
      <section class="stack" style="margin-top:18px" id="comment-list">
        ${comments.length ? comments.map(commentCard).join("") : `<p class="empty">还没有评论。</p>`}
      </section>
      <div class="actions">
        <button class="btn secondary" type="button" data-nav="/u/${escapeHtml(post.author.handle)}">给TA私信</button>
      </div>
    `);
    bindNav();
    bindSquarePostActions(app);
    app.querySelector("#comment-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const message = app.querySelector("#comment-message");
      const body = String(form.get("body") || "").trim();
      if (!body) return;
      const identity = await chooseCommentIdentity();
      if (!identity) return;
      message.className = "subtle";
      message.textContent = "正在发布评论...";
      try {
        await api(`/api/square/posts/${encodeURIComponent(id)}/comments`, {
          method: "POST",
          body: {
            authorMode: identity.authorMode,
            authorName: identity.authorName,
            body
          }
        });
        formElement.reset();
        await renderSquarePost(id);
      } catch (err) {
        message.className = "error";
        message.textContent = err.message;
      }
    });
  } catch (err) {
    renderWithIntro(`<section class="panel"><p class="empty error">${escapeHtml(err.message)}</p></section>`);
    bindNav();
  }
}

function commentCard(comment) {
  return `
    <article class="card comment-card">
      <div class="letter-meta">
        <strong>${escapeHtml(comment.authorName)}</strong>
        <span>${formatTime(comment.createdAt)}</span>
      </div>
      <p class="letter-body">${escapeHtml(comment.body)}</p>
    </article>
  `;
}

function chooseCommentIdentity() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <h3>选择评论身份</h3>
        <div class="segmented comment-identity">
          <label><input type="radio" name="commentIdentity" value="anonymous" checked /> 匿名</label>
          <label><input type="radio" name="commentIdentity" value="named" /> 编辑昵称</label>
        </div>
        <label style="margin:12px 0">编辑昵称
          <input name="commentNickname" placeholder="选择编辑昵称时填写" maxlength="24" />
        </label>
        <div class="confirm-actions">
          <button class="btn" type="button" data-confirm-comment>发布</button>
          <button class="btn secondary" type="button" data-cancel-comment>取消</button>
        </div>
        <p class="error" data-comment-identity-message></p>
      </div>
    `;
    document.body.append(overlay);
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector("[data-confirm-comment]").addEventListener("click", () => {
      const authorMode = overlay.querySelector("[name='commentIdentity']:checked")?.value === "named" ? "named" : "anonymous";
      const authorName = overlay.querySelector("[name='commentNickname']").value.trim();
      if (authorMode === "named" && !authorName) {
        overlay.querySelector("[data-comment-identity-message]").textContent = "请填写编辑昵称，或者选择匿名。";
        return;
      }
      finish({ authorMode, authorName });
    });
    overlay.querySelector("[data-cancel-comment]").addEventListener("click", () => finish(null));
  });
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
        ${state.owner.handle && state.owner.key ? `<p class="subtle">当前设备已绑定 ${escapeHtml(state.owner.handle)}，寄出后可在自己的信箱页查看已寄出的邮件和回复。</p>` : ""}
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
        await api(`/api/inboxes/${encodeURIComponent(handle)}/letters`, {
          method: "POST",
          ownerKey: state.owner.key,
          body: { body }
        });
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
  const enteredByReceiveLink = Boolean(params.get("handle") && params.get("key"));
  if (params.get("handle")) state.owner.handle = params.get("handle");
  if (params.get("key")) state.owner.key = params.get("key");
  if (state.owner.handle) localStorage.setItem("letter_owner_handle", state.owner.handle);
  if (state.owner.key) localStorage.setItem("letter_owner_key", state.owner.key);
  const isLoggedIn = Boolean(state.owner.handle && state.owner.key);

  renderWithIntro(`
    <section id="owner-list" class="stack" style="margin-top:18px"></section>
    <details class="panel auth-disclosure" ${isLoggedIn ? "" : "open"}>
      <summary>${isLoggedIn ? "管理密钥" : "已有信箱？点击此处找回"}</summary>
      <p class="subtle">输入链接名和管理密钥后可以读取来信。接收链接会自动带上这些信息。</p>
      <form class="form" id="owner-auth">
        <label>链接名
          <input name="handle" value="${escapeHtml(state.owner.handle === "demo" && !isLoggedIn ? "" : state.owner.handle)}" />
        </label>
        <label>管理密钥
          <input name="key" value="${escapeHtml(state.owner.key)}" />
        </label>
        <button class="btn" type="submit">读取来信</button>
        <button class="link-button inline" type="button" data-nav="/inbox/recover">忘记管理密钥？去找回</button>
      </form>
    </details>
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
  if (isLoggedIn) loadOwnerLetters({ direct: enteredByReceiveLink });
  else app.querySelector("#owner-list").innerHTML = "";
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
          <span class="subtle">这个信箱已绑定到当前设备。点击圆形头像可从相册或文件中选择图片。</span>
          <p class="subtle" data-avatar-message></p>
        </div>
        <div class="owner-profile-actions">
          <button class="link-button inline" type="button" data-action="show-links">找不到展示链接了？点击此处寻找</button>
          <button class="btn secondary" data-nav="/u/${escapeHtml(result.inbox.handle)}">打开公开页</button>
        </div>
      </div>
      ${ownerStatsHtml(result.stats)}
      ${result.letters.length ? result.letters.map(ownerLetterCard).join("") : `<p class="empty">还没有来信。</p>`}
      <section class="panel sent-panel">
        <h2>已寄出的邮件</h2>
        ${result.sent?.length ? result.sent.map(sentLetterCard).join("") : `<p class="empty">登录状态下给别人写信后，会显示在这里。</p>`}
      </section>
    `;
    bindNav(mount);
    bindAvatarPicker(mount, result.inbox);
    bindOwnerActions(mount, result.inbox);
    bindOwnerLinkTools(mount, result.inbox);
  } catch (err) {
    mount.innerHTML = `<p class="empty error">${escapeHtml(err.message)}</p>`;
  }
}

function bindOwnerLinkTools(scope, inbox) {
  scope.querySelector("[data-action='show-links']")?.addEventListener("click", () => {
    showOwnerLinks(inbox);
  });
}

function showOwnerLinks(inbox) {
  const displayPath = `/u/${encodeURIComponent(inbox.handle)}`;
  const managePath = `/inbox?handle=${encodeURIComponent(inbox.handle)}&key=${encodeURIComponent(state.owner.key)}`;
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-dialog link-dialog" role="dialog" aria-modal="true">
      <button class="dialog-close" type="button" aria-label="关闭" data-close-links>×</button>
      <h3>信箱链接</h3>
      <div class="created-links">
        <button class="created-link-card" type="button" data-nav="${escapeHtml(displayPath)}">
          <strong>展示链接</strong>
          <code>${escapeHtml(absoluteUrl(displayPath))}</code>
        </button>
        <button class="created-link-card" type="button" data-nav="${escapeHtml(managePath)}">
          <strong>收信链接</strong>
          <code>${escapeHtml(absoluteUrl(managePath))}</code>
        </button>
      </div>
    </div>
  `;
  document.body.append(overlay);
  overlay.querySelector("[data-close-links]").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  bindNav(overlay);
}

function ownerStatsHtml(stats = {}) {
  const items = [
    ["已收到来信", stats.received || 0],
    ["已公开来信", stats.publicReplies || 0],
    ["待回复信件", stats.pendingReplies || 0],
    ["未公开来信", stats.privateReplies || 0]
  ];
  return `
    <div class="stats-grid">
      ${items.map(([label, value]) => `
        <article class="stat-card">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function sentLetterCard(letter) {
  const target = letter.target || { penName: "未知信箱", handle: "" };
  return `
    <article class="card letter">
      <div class="letter-meta">
        <span>寄给 ${escapeHtml(target.penName)} ${target.handle ? `@${escapeHtml(target.handle)}` : ""}</span>
        <span>${formatTime(letter.createdAt)}</span>
      </div>
      <p class="letter-body">${escapeHtml(letter.body)}</p>
      ${letter.reply ? `<p class="reply-body"><strong>TA 的回复：</strong>${escapeHtml(letter.reply)}</p>` : `<p class="subtle">对方还没有回复。</p>`}
    </article>
  `;
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
  const isArchived = letter.status === "archived";
  const isPublished = letter.status === "replied";
  const needsChoice = isPublished || isArchived;
  return `
    <article class="card letter" data-letter-id="${escapeHtml(letter.id)}">
      <div class="letter-meta">
        <span>${formatTime(letter.createdAt)}</span>
        <span class="pill">${escapeHtml(statusLabel(letter.status))}</span>
      </div>
      <p class="letter-body">${escapeHtml(letter.body)}</p>
      ${letter.reply ? `<p class="reply-body"><strong>我的回信：</strong>${escapeHtml(letter.reply)}</p>` : ""}
      ${needsChoice ? `
          <div class="owner-choice-row">
            <button class="link-button inline" type="button" data-action="toggle-tools">${isArchived ? "选择是否重新公开？" : "重新选择是否公开？"}</button>
            ${letter.reply ? `<button class="link-button inline" type="button" data-action="image">生成图片</button>` : ""}
          </div>
        ` : ""}
        <div class="owner-tools" ${needsChoice ? "hidden" : ""}>
          <textarea data-reply placeholder="写一封公开回信">${escapeHtml(letter.reply || "")}</textarea>
          <div class="actions" style="justify-content:flex-start;margin-top:0">
            <button class="btn" data-action="reply">${isArchived ? "重新公开" : "公开回复"}</button>
            <button class="btn danger" data-action="archive">${isPublished ? "改为不公开" : "归档为不公开"}</button>
            ${!isPublished && letter.reply ? `<button class="btn secondary" data-action="image">生成图片</button>` : ""}
          </div>
          <p class="subtle">归档为不公开表示：收信人和登录状态的寄信人可以看到这封回复，但不会出现在公开页面。</p>
          <p class="subtle" data-message></p>
        </div>
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

function confirmArchive() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <h3>归档确认</h3>
        <p>确定不公开回复仅作归档处理？归档后这封信只会保留在你的收信管理里，不会出现在公开页面。</p>
        <div class="confirm-actions">
          <button class="btn danger" type="button" data-confirm-archive>确定归档</button>
          <button class="btn secondary" type="button" data-cancel-archive>再想想</button>
        </div>
      </div>
    `;
    document.body.append(overlay);
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector("[data-confirm-archive]").addEventListener("click", () => finish(true));
    overlay.querySelector("[data-cancel-archive]").addEventListener("click", () => finish(false));
  });
}

function confirmImageText(defaultLetter, defaultReply) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog image-dialog" role="dialog" aria-modal="true">
        <h3>生成图片前确认</h3>
        <p>将申请保存或分享图片。请先手动编辑内容，确认已经保护寄信者隐私后再生成。</p>
        <label>来信
          <textarea data-image-letter maxlength="600">${escapeHtml(defaultLetter)}</textarea>
        </label>
        <label>回信
          <textarea data-image-reply maxlength="600">${escapeHtml(defaultReply)}</textarea>
        </label>
        <div class="confirm-actions">
          <button class="btn" type="button" data-confirm-image>确认生成图片</button>
          <button class="btn secondary" type="button" data-cancel-image>取消</button>
        </div>
      </div>
    `;
    document.body.append(overlay);
    const textarea = overlay.querySelector("[data-image-letter]");
    textarea.focus();
    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector("[data-confirm-image]").addEventListener("click", () => finish({
      letter: overlay.querySelector("[data-image-letter]").value,
      reply: overlay.querySelector("[data-image-reply]").value
    }));
    overlay.querySelector("[data-cancel-image]").addEventListener("click", () => finish(null));
  });
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const paragraphs = String(text || "").split("\n");
  let cursor = y;
  paragraphs.forEach((paragraph) => {
    let line = "";
    Array.from(paragraph || " ").forEach((char) => {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursor);
        cursor += lineHeight;
        line = char;
      } else {
        line = test;
      }
    });
    ctx.fillText(line, x, cursor);
    cursor += lineHeight;
  });
  return cursor;
}

function canvasTheme() {
  if (currentTheme() === "dark") {
    return {
      bg: "#111c2c",
      paper: "#43566b",
      card: "#32465d",
      line: "#60758d",
      ink: "#f6f8fb",
      muted: "#d5dde7",
      brand: "#c4cbd3"
    };
  }
  return {
    bg: "#f2f4f7",
    paper: "#ffffff",
    card: "#edf3f8",
    line: "#d9e0e8",
    ink: "#24303d",
    muted: "#6f7b89",
    brand: "#3f5872"
  };
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function drawAvatar(ctx, inbox, x, y, size, palette) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const image = await loadImage(inbox.avatarUrl).catch(() => null);
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = palette.card;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = palette.brand;
    ctx.font = "800 54px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((inbox.penName || "O").trim().slice(0, 1).toUpperCase(), x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

async function generateLetterImage(content, inbox) {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1440;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const palette = canvasTheme();
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.paper;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 70, 70, width - 140, height - 140, 28);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.brand;
  ctx.font = "700 56px sans-serif";
  ctx.fillText("OvO", 120, 155);

  await drawAvatar(ctx, inbox, width / 2 - 54, 190, 108, palette);
  ctx.textAlign = "center";
  ctx.fillStyle = palette.ink;
  ctx.font = "700 38px sans-serif";
  ctx.fillText(inbox.penName || "匿名信箱", width / 2, 345);
  ctx.fillStyle = palette.muted;
  ctx.font = "26px sans-serif";
  ctx.fillText(`ID: ${inbox.handle || "ovo"}`, width / 2, 386);

  const boxX = 120;
  const boxWidth = width - 240;
  const drawTextBox = (title, text, y, minHeight) => {
    ctx.fillStyle = palette.card;
    ctx.strokeStyle = palette.line;
    drawRoundRect(ctx, boxX, y, boxWidth, minHeight, 22);
    ctx.textAlign = "left";
    ctx.fillStyle = palette.brand;
    ctx.font = "700 30px sans-serif";
    ctx.fillText(title, boxX + 34, y + 56);
    ctx.fillStyle = palette.ink;
    ctx.font = "34px sans-serif";
    wrapCanvasText(ctx, text || " ", boxX + 34, y + 112, boxWidth - 68, 52);
  };
  drawTextBox("来信", content.letter, 455, 330);
  drawTextBox("回信", content.reply, 835, 390);

  ctx.textAlign = "left";
  ctx.fillStyle = palette.muted;
  ctx.font = "26px sans-serif";
  ctx.fillText("由 OvO 匿名信箱生成", 120, height - 120);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], `ovo-letter-${Date.now()}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "OvO 匿名信箱" });
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function bindOwnerActions(scope, inbox) {
  scope.querySelectorAll("[data-action='toggle-tools']").forEach((button) => {
    button.addEventListener("click", () => {
      const tools = button.closest("[data-letter-id]")?.querySelector(".owner-tools");
      if (tools) tools.hidden = !tools.hidden;
    });
  });
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
      const canArchive = await confirmArchive();
      if (!canArchive) {
        if (message) {
          message.className = "subtle";
          message.textContent = "已取消归档。";
        }
        return;
      }
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
  scope.querySelectorAll("[data-action='image']").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-letter-id]");
      const letter = card.querySelector(".letter-body")?.textContent || "";
      const reply = card.querySelector("[data-reply]")?.value || card.querySelector(".reply-body")?.textContent?.replace(/^我的回信：/, "") || "";
      const content = await confirmImageText(letter, reply);
      if (!content) return;
      try {
        await generateLetterImage(content, inbox);
      } catch (err) {
        const message = card.querySelector("[data-message]");
        if (message) {
          message.className = "error";
          message.textContent = err.message || "生成图片失败";
        }
      }
    });
  });
}

render();
