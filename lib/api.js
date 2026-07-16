import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

const root = process.cwd();
const dbPath = process.env.DB_PATH
  ? (isAbsolute(process.env.DB_PATH) ? process.env.DB_PATH : join(root, process.env.DB_PATH))
  : join(root, "data", "db.json");
const dataDir = dirname(dbPath);
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const useSupabase = Boolean(supabaseUrl && supabaseServiceRoleKey);

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    await stat(dbPath);
  } catch {
    const seed = {
      inboxes: [
        {
          id: randomUUID(),
          handle: "demo",
          penName: "Demo",
          bio: "把没说出口的话放在这里。",
          ownerEmail: "demo@example.com",
          ownerKey: token(),
          createdAt: new Date().toISOString()
        }
      ],
      letters: [],
      squarePosts: [],
      squareLikes: [],
      squareComments: []
    };
    await saveDb(seed);
  }
}

async function loadDb() {
  await ensureDb();
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  db.inboxes ||= [];
  db.letters ||= [];
  db.squarePosts ||= [];
  db.squareLikes ||= [];
  db.squareComments ||= [];
  return db;
}

async function saveDb(db) {
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function toAppInbox(row) {
  return {
    id: row.id,
    handle: row.handle,
    penName: row.pen_name,
    ownerEmail: row.owner_email,
    avatarUrl: row.avatar_url || "",
    bio: row.bio || "",
    ownerKey: row.owner_key,
    createdAt: row.created_at
  };
}

function toAppLetter(row) {
  return {
    id: row.id,
    inboxId: row.inbox_id,
    senderInboxId: row.sender_inbox_id || "",
    body: row.body,
    status: row.status,
    reply: row.reply || "",
    createdAt: row.created_at,
    repliedAt: row.replied_at,
    archivedAt: row.archived_at
  };
}

function toDbInbox(inbox) {
  return {
    id: inbox.id,
    handle: inbox.handle,
    pen_name: inbox.penName,
    owner_email: inbox.ownerEmail,
    avatar_url: inbox.avatarUrl || "",
    bio: inbox.bio || "",
    owner_key: inbox.ownerKey,
    created_at: inbox.createdAt
  };
}

function toDbLetter(letter) {
  return {
    id: letter.id,
    inbox_id: letter.inboxId,
    sender_inbox_id: letter.senderInboxId || null,
    body: letter.body,
    status: letter.status,
    reply: letter.reply || "",
    created_at: letter.createdAt,
    replied_at: letter.repliedAt,
    archived_at: letter.archivedAt
  };
}

function toAppSquarePost(row) {
  return {
    id: row.id,
    inboxId: row.inbox_id,
    body: row.body,
    createdAt: row.created_at
  };
}

function toDbSquarePost(post) {
  return {
    id: post.id,
    inbox_id: post.inboxId,
    body: post.body,
    created_at: post.createdAt
  };
}

function toAppSquareLike(row) {
  return {
    id: row.id,
    postId: row.post_id,
    voterId: row.voter_id,
    createdAt: row.created_at
  };
}

function toDbSquareLike(like) {
  return {
    id: like.id,
    post_id: like.postId,
    voter_id: like.voterId,
    created_at: like.createdAt
  };
}

function toAppSquareComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorMode: row.author_mode,
    authorName: row.author_name || "",
    body: row.body,
    createdAt: row.created_at
  };
}

function toDbSquareComment(comment) {
  return {
    id: comment.id,
    post_id: comment.postId,
    author_mode: comment.authorMode,
    author_name: comment.authorName || "",
    body: comment.body,
    created_at: comment.createdAt
  };
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json",
      prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Supabase 请求失败");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function supabaseOptionalRequest(path) {
  try {
    return await supabaseRequest(path);
  } catch (err) {
    if (err.status === 404 || /schema cache|relation|column/i.test(err.message)) return [];
    throw err;
  }
}

async function loadStore() {
  if (!useSupabase) return loadDb();
  const [inboxes, letters, squarePosts, squareLikes, squareComments] = await Promise.all([
    supabaseRequest("inboxes?select=*"),
    supabaseRequest("letters?select=*"),
    supabaseOptionalRequest("square_posts?select=*"),
    supabaseOptionalRequest("square_post_likes?select=*"),
    supabaseOptionalRequest("square_comments?select=*")
  ]);
  return {
    inboxes: inboxes.map(toAppInbox),
    letters: letters.map(toAppLetter),
    squarePosts: squarePosts.map(toAppSquarePost),
    squareLikes: squareLikes.map(toAppSquareLike),
    squareComments: squareComments.map(toAppSquareComment)
  };
}

async function insertInbox(inbox) {
  if (!useSupabase) return null;
  const [row] = await supabaseRequest("inboxes", { method: "POST", body: toDbInbox(inbox) });
  return toAppInbox(row);
}

async function updateInbox(id, patch) {
  if (!useSupabase) return null;
  const body = {};
  if (Object.hasOwn(patch, "avatarUrl")) body.avatar_url = patch.avatarUrl || "";
  const [row] = await supabaseRequest(`inboxes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  });
  return toAppInbox(row);
}

async function insertLetter(letter) {
  if (!useSupabase) return null;
  let row;
  try {
    [row] = await supabaseRequest("letters", { method: "POST", body: toDbLetter(letter) });
  } catch (err) {
    if (!/sender_inbox_id|schema cache|column/i.test(err.message)) throw err;
    const body = toDbLetter(letter);
    delete body.sender_inbox_id;
    [row] = await supabaseRequest("letters", { method: "POST", body });
  }
  if (!row) return letter;
  return toAppLetter(row);
}

async function updateLetter(id, patch) {
  if (!useSupabase) return null;
  const body = {};
  if (Object.hasOwn(patch, "reply")) body.reply = patch.reply || "";
  if (Object.hasOwn(patch, "status")) body.status = patch.status;
  if (Object.hasOwn(patch, "repliedAt")) body.replied_at = patch.repliedAt;
  if (Object.hasOwn(patch, "archivedAt")) body.archived_at = patch.archivedAt;
  const [row] = await supabaseRequest(`letters?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  });
  return toAppLetter(row);
}

async function insertSquarePost(post) {
  if (!useSupabase) return null;
  const [row] = await supabaseRequest("square_posts", { method: "POST", body: toDbSquarePost(post) });
  return toAppSquarePost(row);
}

async function insertSquareLike(like) {
  if (!useSupabase) return null;
  const [row] = await supabaseRequest("square_post_likes", { method: "POST", body: toDbSquareLike(like) });
  return toAppSquareLike(row);
}

async function insertSquareComment(comment) {
  if (!useSupabase) return null;
  const [row] = await supabaseRequest("square_comments", { method: "POST", body: toDbSquareComment(comment) });
  return toAppSquareComment(row);
}

function token() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  while (true) {
    const seed = randomBytes(12);
    const chars = Array.from({ length: 12 }, (_, index) => alphabet[seed[index] % alphabet.length]);
    const raw = chars.join("");
    if (!/[A-Z]/.test(raw) || !/\d/.test(raw)) continue;
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  }
}

export function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

export function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch {
      const err = new Error("请求体不是有效 JSON");
      err.status = 400;
      throw err;
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("请求体不是有效 JSON");
    err.status = 400;
    throw err;
  }
}

function cleanText(value, max = 600) {
  return String(value || "").trim().replace(/\r\n/g, "\n").slice(0, max);
}

function cleanAvatar(value) {
  const avatar = String(value || "").trim();
  if (!avatar) return "";
  if (avatar.length > 350000) return null;
  if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar)) return null;
  return avatar;
}

function cleanHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 120);
}

function cleanOwnerKey(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 32);
}

function ownerKeyFingerprint(value) {
  return cleanOwnerKey(value).replace(/[^A-Z0-9]/g, "");
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function publicInbox(inbox, db) {
  const replies = db.letters
    .filter((letter) => letter.inboxId === inbox.id && letter.status === "replied" && letter.reply)
    .sort((a, b) => new Date(b.repliedAt || b.createdAt) - new Date(a.repliedAt || a.createdAt))
    .map((letter) => ({
      id: letter.id,
      body: letter.body,
      reply: letter.reply,
      createdAt: letter.createdAt,
      repliedAt: letter.repliedAt
    }));
  return {
    handle: inbox.handle,
    penName: inbox.penName,
    bio: inbox.bio,
    avatarUrl: inbox.avatarUrl || "",
    emailBound: Boolean(inbox.ownerEmail),
    replyCount: replies.length,
    replies
  };
}

function publicSquarePost(post, db) {
  const inbox = db.inboxes.find((item) => item.id === post.inboxId);
  const likeCount = db.squareLikes.filter((like) => like.postId === post.id).length;
  const commentCount = db.squareComments.filter((comment) => comment.postId === post.id).length;
  return {
    id: post.id,
    body: post.body,
    createdAt: post.createdAt,
    likeCount,
    commentCount,
    author: inbox ? {
      handle: inbox.handle,
      penName: inbox.penName,
      avatarUrl: inbox.avatarUrl || ""
    } : {
      handle: "",
      penName: "匿名信箱",
      avatarUrl: ""
    }
  };
}

function publicSquareComment(comment) {
  return {
    id: comment.id,
    authorMode: comment.authorMode,
    authorName: comment.authorMode === "named" ? comment.authorName : "匿名",
    body: comment.body,
    createdAt: comment.createdAt
  };
}

function ownerStats(letters) {
  return {
    received: letters.length,
    publicReplies: letters.filter((letter) => letter.status === "replied").length,
    pendingReplies: letters.filter((letter) => letter.status === "new").length,
    privateReplies: letters.filter((letter) => letter.reply && letter.status !== "replied" && letter.status !== "archived").length
  };
}

function requireOwner(req, inbox) {
  const key = req.headers["x-inbox-key"];
  return key && key === inbox.ownerKey;
}

export async function handleApi(req, res, url) {
  const db = await loadStore();
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, { ok: true, storage: useSupabase ? "supabase" : "json" });
  }

  if (req.method === "GET" && path === "/api/square/posts") {
    const sort = url.searchParams.get("sort") === "hot" ? "hot" : "new";
    const posts = db.squarePosts
      .map((post) => publicSquarePost(post, db))
      .sort((a, b) => {
        if (sort === "hot") {
          const hotA = a.likeCount * 3 + a.commentCount * 2;
          const hotB = b.likeCount * 3 + b.commentCount * 2;
          if (hotA !== hotB) return hotB - hotA;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    return sendJson(res, 200, { posts });
  }

  if (req.method === "POST" && path === "/api/square/posts") {
    const body = await readJson(req);
    const handle = cleanHandle(body.handle);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox) return sendError(res, 404, "请先创建或找回一个信箱再发广场帖子");
    if (!requireOwner(req, inbox)) return sendError(res, 401, "需要用自己的接收链接进入后再发帖");
    const text = cleanText(body.body, 600);
    if (text.length < 2) return sendError(res, 400, "帖子至少写两个字吧");
    const post = {
      id: randomUUID(),
      inboxId: inbox.id,
      body: text,
      createdAt: new Date().toISOString()
    };
    const savedPost = useSupabase ? await insertSquarePost(post) : post;
    if (!useSupabase) {
      db.squarePosts.push(post);
      await saveDb(db);
    }
    return sendJson(res, 201, { post: publicSquarePost(savedPost, db) });
  }

  const squarePostMatch = path.match(/^\/api\/square\/posts\/([^/]+)$/);
  if (req.method === "GET" && squarePostMatch) {
    const post = db.squarePosts.find((item) => item.id === decodeURIComponent(squarePostMatch[1]));
    if (!post) return sendError(res, 404, "没有找到这条广场帖子");
    const comments = db.squareComments
      .filter((comment) => comment.postId === post.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(publicSquareComment);
    return sendJson(res, 200, { post: publicSquarePost(post, db), comments });
  }

  const squareLikeMatch = path.match(/^\/api\/square\/posts\/([^/]+)\/like$/);
  if (req.method === "POST" && squareLikeMatch) {
    const post = db.squarePosts.find((item) => item.id === decodeURIComponent(squareLikeMatch[1]));
    if (!post) return sendError(res, 404, "没有找到这条广场帖子");
    const body = await readJson(req);
    const voterId = cleanText(body.voterId, 80) || randomUUID();
    const existing = db.squareLikes.find((like) => like.postId === post.id && like.voterId === voterId);
    if (!existing) {
      const like = {
        id: randomUUID(),
        postId: post.id,
        voterId,
        createdAt: new Date().toISOString()
      };
      if (useSupabase) await insertSquareLike(like);
      else db.squareLikes.push(like);
      if (!useSupabase) await saveDb(db);
    }
    const likeCount = existing ? db.squareLikes.filter((like) => like.postId === post.id).length : db.squareLikes.filter((like) => like.postId === post.id).length + (useSupabase ? 1 : 0);
    return sendJson(res, 200, { liked: true, likeCount });
  }

  const squareCommentMatch = path.match(/^\/api\/square\/posts\/([^/]+)\/comments$/);
  if (req.method === "POST" && squareCommentMatch) {
    const post = db.squarePosts.find((item) => item.id === decodeURIComponent(squareCommentMatch[1]));
    if (!post) return sendError(res, 404, "没有找到这条广场帖子");
    const body = await readJson(req);
    const authorMode = body.authorMode === "named" ? "named" : "anonymous";
    const authorName = cleanText(body.authorName, 24);
    const text = cleanText(body.body, 400);
    if (authorMode === "named" && !authorName) return sendError(res, 400, "请填写随意 ID，或者选择匿名评论");
    if (text.length < 1) return sendError(res, 400, "评论不能为空");
    const comment = {
      id: randomUUID(),
      postId: post.id,
      authorMode,
      authorName,
      body: text,
      createdAt: new Date().toISOString()
    };
    const savedComment = useSupabase ? await insertSquareComment(comment) : comment;
    if (!useSupabase) {
      db.squareComments.push(comment);
      await saveDb(db);
    }
    return sendJson(res, 201, { comment: publicSquareComment(savedComment) });
  }

  if (req.method === "POST" && path === "/api/inboxes") {
    const body = await readJson(req);
    const handle = cleanHandle(body.handle);
    const penName = cleanText(body.penName, 40);
    const ownerEmail = cleanEmail(body.ownerEmail);
    const bio = cleanText(body.bio, 120);
    if (!handle || handle.length < 3) return sendError(res, 400, "链接名至少 3 个字符，只能包含英文、数字和下划线");
    if (!penName) return sendError(res, 400, "请填写展示名");
    if (ownerEmail && !validEmail(ownerEmail)) return sendError(res, 400, "邮箱格式不正确，或者留空不绑定邮箱");
    if (db.inboxes.some((item) => item.handle === handle)) return sendError(res, 409, "这个链接名已经被占用");
    const inbox = {
      id: randomUUID(),
      handle,
      penName,
      ownerEmail,
      avatarUrl: "",
      bio,
      ownerKey: token(),
      createdAt: new Date().toISOString()
    };
    const savedInbox = useSupabase ? await insertInbox(inbox) : inbox;
    if (!useSupabase) {
      db.inboxes.push(inbox);
      await saveDb(db);
    }
    return sendJson(res, 201, {
      inbox: publicInbox(savedInbox, db),
      ownerKey: savedInbox.ownerKey,
      manageUrl: `/inbox?handle=${encodeURIComponent(handle)}&key=${encodeURIComponent(savedInbox.ownerKey)}`
    });
  }

  if (req.method === "POST" && path === "/api/inboxes/recover") {
    const body = await readJson(req);
    const handle = cleanHandle(body.handle);
    const ownerEmail = cleanEmail(body.ownerEmail);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox || !inbox.ownerEmail || inbox.ownerEmail !== ownerEmail) {
      return sendError(res, 404, "链接名和邮箱没有匹配的信箱");
    }
    return sendJson(res, 200, {
      inbox: publicInbox(inbox, db),
      ownerKey: inbox.ownerKey,
      manageUrl: `/inbox?handle=${encodeURIComponent(inbox.handle)}&key=${encodeURIComponent(inbox.ownerKey)}`
    });
  }

  if (req.method === "POST" && path === "/api/inboxes/recover-key") {
    const body = await readJson(req);
    const ownerKey = cleanOwnerKey(body.ownerKey);
    const keyFingerprint = ownerKeyFingerprint(ownerKey);
    const inbox = db.inboxes.find((item) => ownerKeyFingerprint(item.ownerKey) === keyFingerprint);
    if (!inbox) return sendError(res, 404, "没有找到匹配这个密钥的信箱");
    return sendJson(res, 200, {
      inbox: publicInbox(inbox, db),
      ownerKey: inbox.ownerKey,
      manageUrl: `/inbox?handle=${encodeURIComponent(inbox.handle)}&key=${encodeURIComponent(inbox.ownerKey)}`
    });
  }

  const profileMatch = path.match(/^\/api\/inboxes\/([^/]+)$/);
  if (req.method === "GET" && profileMatch) {
    const handle = decodeURIComponent(profileMatch[1]);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox) return sendError(res, 404, "没有找到这个信箱");
    return sendJson(res, 200, { inbox: publicInbox(inbox, db) });
  }

  const letterMatch = path.match(/^\/api\/inboxes\/([^/]+)\/letters$/);
  if (req.method === "POST" && letterMatch) {
    const handle = decodeURIComponent(letterMatch[1]);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox) return sendError(res, 404, "没有找到这个信箱");
    const body = await readJson(req);
    const text = cleanText(body.body, 600);
    if (text.length < 2) return sendError(res, 400, "至少写两个字吧");
    const senderInbox = db.inboxes.find((item) => requireOwner(req, item));
    const letter = {
      id: randomUUID(),
      inboxId: inbox.id,
      senderInboxId: senderInbox?.id || "",
      body: text,
      status: "new",
      reply: "",
      createdAt: new Date().toISOString(),
      repliedAt: null,
      archivedAt: null
    };
    const savedLetter = useSupabase ? await insertLetter(letter) : letter;
    if (!useSupabase) {
      db.letters.push(letter);
      await saveDb(db);
    }
    return sendJson(res, 201, { letter: { id: savedLetter.id, createdAt: savedLetter.createdAt } });
  }

  const sentLettersMatch = path.match(/^\/api\/owner\/inboxes\/([^/]+)\/sent$/);
  if (req.method === "GET" && sentLettersMatch) {
    const handle = decodeURIComponent(sentLettersMatch[1]);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox) return sendError(res, 404, "没有找到这个信箱");
    if (!requireOwner(req, inbox)) return sendError(res, 401, "管理密钥不正确");
    const letters = db.letters
      .filter((letter) => letter.senderInboxId === inbox.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((letter) => {
        const target = db.inboxes.find((item) => item.id === letter.inboxId);
        return {
          id: letter.id,
          body: letter.body,
          status: letter.status,
          reply: letter.reply || "",
          createdAt: letter.createdAt,
          repliedAt: letter.repliedAt,
          target: target ? {
            handle: target.handle,
            penName: target.penName,
            avatarUrl: target.avatarUrl || ""
          } : null
        };
      });
    return sendJson(res, 200, { letters });
  }

  const ownerLettersMatch = path.match(/^\/api\/owner\/inboxes\/([^/]+)\/letters$/);
  if (req.method === "GET" && ownerLettersMatch) {
    const handle = decodeURIComponent(ownerLettersMatch[1]);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox) return sendError(res, 404, "没有找到这个信箱");
    if (!requireOwner(req, inbox)) return sendError(res, 401, "管理密钥不正确");
    const letters = db.letters
      .filter((letter) => letter.inboxId === inbox.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { inbox: publicInbox(inbox, db), letters, stats: ownerStats(letters) });
  }

  const settingsMatch = path.match(/^\/api\/owner\/inboxes\/([^/]+)\/settings$/);
  if (req.method === "PATCH" && settingsMatch) {
    const handle = decodeURIComponent(settingsMatch[1]);
    const inbox = db.inboxes.find((item) => item.handle === handle);
    if (!inbox) return sendError(res, 404, "没有找到这个信箱");
    if (!requireOwner(req, inbox)) return sendError(res, 401, "管理密钥不正确");
    const body = await readJson(req);
    if (Object.hasOwn(body, "avatarUrl")) {
      const avatarUrl = cleanAvatar(body.avatarUrl);
      if (avatarUrl === null) return sendError(res, 400, "头像格式不支持或图片太大");
      if (useSupabase) {
        Object.assign(inbox, await updateInbox(inbox.id, { avatarUrl }));
      } else {
        inbox.avatarUrl = avatarUrl;
      }
    }
    if (!useSupabase) await saveDb(db);
    return sendJson(res, 200, { inbox: publicInbox(inbox, db) });
  }

  const replyMatch = path.match(/^\/api\/owner\/letters\/([^/]+)\/reply$/);
  if (req.method === "POST" && replyMatch) {
    const letter = db.letters.find((item) => item.id === decodeURIComponent(replyMatch[1]));
    if (!letter) return sendError(res, 404, "没有找到这封信");
    const inbox = db.inboxes.find((item) => item.id === letter.inboxId);
    if (!requireOwner(req, inbox)) return sendError(res, 401, "管理密钥不正确");
    const body = await readJson(req);
    const reply = cleanText(body.reply, 600);
    if (reply.length < 2) return sendError(res, 400, "回信至少两个字");
    const patch = { reply, status: "replied", repliedAt: new Date().toISOString() };
    if (useSupabase) Object.assign(letter, await updateLetter(letter.id, patch));
    else Object.assign(letter, patch);
    if (!useSupabase) await saveDb(db);
    return sendJson(res, 200, { letter });
  }

  const archiveMatch = path.match(/^\/api\/owner\/letters\/([^/]+)\/archive$/);
  if (req.method === "POST" && archiveMatch) {
    const letter = db.letters.find((item) => item.id === decodeURIComponent(archiveMatch[1]));
    if (!letter) return sendError(res, 404, "没有找到这封信");
    const inbox = db.inboxes.find((item) => item.id === letter.inboxId);
    if (!requireOwner(req, inbox)) return sendError(res, 401, "管理密钥不正确");
    const patch = { status: "archived", archivedAt: new Date().toISOString() };
    if (useSupabase) Object.assign(letter, await updateLetter(letter.id, patch));
    else Object.assign(letter, patch);
    if (!useSupabase) await saveDb(db);
    return sendJson(res, 200, { letter });
  }

  return sendError(res, 404, "API 不存在");
}
