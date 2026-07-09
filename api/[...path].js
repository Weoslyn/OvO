import { handleApi, sendError } from "../lib/api.js";

export default async function handler(req, res) {
  const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
  try {
    await handleApi(req, res, url);
  } catch (err) {
    sendError(res, err.status || 500, err.message || "服务器错误");
  }
}
