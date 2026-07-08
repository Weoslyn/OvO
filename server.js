import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

const root = process.cwd();
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const dbPath = join(dataDir, "db.json");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

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
      letters: []
    };
    await saveDb(seed);
  }
}

async function loadDb() {
  await ensureDb();
  return JSON.parse(await readFile(dbPath, "utf8"));
}

async function saveDb(db) {
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
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

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readJson(req) {
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

function requireOwner(req, inbox) {
  const key = req.headers["x-inbox-key"];
  return key && key === inbox.ownerKey;
}

async function handleApi(req, res, url) {
  const db = await loadDb();
  const path = url.pathname;

  if (req.method === "POST" && path === "/api/inboxes") {
    const body = await readJson(req);
    const handle = cleanHandle(body.handle);
    const penName = cleanText(body.penName, 40);
    const ownerEmail = cleanEmail(body.ownerEmail);
    const bio = cleanText(body.bio, 120);
    if (!handle || handle.length < 3) return sendError(res, 400, "链接名至少 3 个字符，只能包含英文、数字和下划线");
    if (!penName) return sendError(res, 400, "请填写展示名");
    if (!validEmail(ownerEmail)) return sendError(res, 400, "请填写可用于找回的邮箱");
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
    db.inboxes.push(inbox);
    await saveDb(db);
    return sendJson(res, 201, {
      inbox: publicInbox(inbox, db),
      ownerKey: inbox.ownerKey,
      manageUrl: `/inbox?handle=${encodeURIComponent(handle)}&key=${encodeURIComponent(inbox.ownerKey)}`
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
    const letter = {
      id: randomUUID(),
      inboxId: inbox.id,
      body: text,
      status: "new",
      reply: "",
      createdAt: new Date().toISOString(),
      repliedAt: null,
      archivedAt: null
    };
    db.letters.push(letter);
    await saveDb(db);
    return sendJson(res, 201, { letter: { id: letter.id, createdAt: letter.createdAt } });
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
    return sendJson(res, 200, { inbox: publicInbox(inbox, db), letters });
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
      inbox.avatarUrl = avatarUrl;
    }
    await saveDb(db);
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
    letter.reply = reply;
    letter.status = "replied";
    letter.repliedAt = new Date().toISOString();
    await saveDb(db);
    return sendJson(res, 200, { letter });
  }

  const archiveMatch = path.match(/^\/api\/owner\/letters\/([^/]+)\/archive$/);
  if (req.method === "POST" && archiveMatch) {
    const letter = db.letters.find((item) => item.id === decodeURIComponent(archiveMatch[1]));
    if (!letter) return sendError(res, 404, "没有找到这封信");
    const inbox = db.inboxes.find((item) => item.id === letter.inboxId);
    if (!requireOwner(req, inbox)) return sendError(res, 401, "管理密钥不正确");
    letter.status = "archived";
    letter.archivedAt = new Date().toISOString();
    await saveDb(db);
    return sendJson(res, 200, { letter });
  }

  return sendError(res, 404, "API 不存在");
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" || !extname(pathname)) pathname = "/index.html";
  const filePath = normalize(join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    await stat(filePath);
    res.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    sendError(res, err.status || 500, err.message || "服务器错误");
  }
});

server.listen(port, host, () => {
  console.log(`Anonymous letters app running at http://${host}:${port}`);
});
