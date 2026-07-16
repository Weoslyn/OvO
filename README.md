# OvO Letters

一个匿名来信箱 MVP。当前先完成不依赖最终 UI 的产品底座：创建信箱、弱账号绑定、公开收信页、匿名投稿、收信管理、公开回信、归档、广场和找回入口。

## 运行

```bash
npm run dev
```

默认地址是 `http://localhost:5173`。

## 已搭建模块

- `GET /u/:handle`：公开收信页和公开回信列表。
- `GET /inbox/new`：创建信箱，生成管理密钥。
- `GET /inbox`：收信管理页，输入链接名和管理密钥读取来信。
- `GET /inbox/recover`：用链接名和绑定邮箱找回收信管理入口。
- `POST /api/inboxes`：创建信箱。
- `POST /api/inboxes/recover`：匹配链接名和绑定邮箱，返回收信管理入口。
- `POST /api/inboxes/:handle/letters`：匿名寄信。
- `GET /api/owner/inboxes/:handle/letters`：主人读取全部来信。
- `POST /api/owner/letters/:id/reply`：公开回信。
- `POST /api/owner/letters/:id/archive`：归档。

## 收信管理是什么

它不是平台管理员工具，而是每个信箱主人自己的管理页。别人访问 `/u/:handle` 写匿名信，内容会先进 `/inbox`；信箱主人可以在这里查看、公开回信或归档。只有公开回信的内容会展示在公开页上。

管理密钥使用 12 位大写字母和数字组合，四个一组显示，例如 `AB12-CD34-EF56`。

## 邮箱绑定和找回

创建信箱时会要求填写邮箱，用于长期绑定这个信箱。当前 MVP 的找回页会用“链接名 + 邮箱”匹配并显示管理入口。正式给真实用户使用时，建议把这一步改成发送邮件验证码或魔法链接，避免别人知道邮箱后直接拿到管理入口。

## GitHub 发布说明

这个项目不是纯静态网站。因为别人写来的内容需要保存，必须有一个后端服务和数据存储。

推荐发布方式：

1. 代码放到 GitHub 仓库。
2. 用 Render、Railway、Fly.io 或支持 Node 服务的平台部署这个仓库。
3. 平台运行命令设置为 `npm start`。
4. 公开域名指向部署平台给出的地址。

GitHub Pages 只能放静态 HTML/CSS/JS，不能运行这个 Node API，也不能可靠保存投稿数据。后续如果一定要 GitHub Pages，需要把 API 改接第三方后端，例如 Supabase、Firebase 或 serverless functions。

### Render 部署

仓库根目录已经包含 `render.yaml`，可以用 Render Blueprint 部署。

- 服务类型：Web Service
- Runtime：Node
- Start Command：`npm start`
- Health Check：`/api/health`
- 存储：Supabase 免费 Postgres
- 环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`

Render 的普通文件系统是临时的；没有外部数据库或持久磁盘时，服务重启或重新部署会丢失运行时写入的数据。为了不绑定银行卡，当前推荐使用 Supabase 免费数据库保存来信。

### GitHub 数据分支存储

如果 Supabase 卡在银行卡或账单验证，可以改用 GitHub 数据分支存储，不需要国外银行卡。

仓库已经准备了 `data-store` 分支。Vercel 配好下面这些环境变量后，应用会优先使用 GitHub 保存数据，不再依赖 Supabase：

- `GITHUB_DB_TOKEN`：GitHub token，需要本仓库 Contents 读写权限
- `GITHUB_DB_REPO`：`Weoslyn/OvO`
- `GITHUB_DB_BRANCH`：`data-store`
- `GITHUB_DB_PATH`：`data/db.json`

配置成功后访问 `/api/health`，应该看到 `"storage":"github"`。

### Supabase 设置

1. 在 Supabase 创建 Free Project。
2. 打开 SQL Editor，运行 [supabase/schema.sql](supabase/schema.sql)。
3. 打开 Project Settings → API，复制：
   - Project URL → Render 环境变量 `SUPABASE_URL`
   - service_role secret key → Render 环境变量 `SUPABASE_SERVICE_ROLE_KEY`
4. 在 Render 创建 Blueprint 时选择本仓库，填入这两个环境变量。

本地开发没有设置 Supabase 环境变量时，应用仍会使用 `data/db.json`。

### Vercel 部署

仓库已包含 Vercel 配置：

- 静态页面：`public/`
- Serverless API：`api/[...path].js`
- API 共享逻辑：`lib/api.js`
- 前端路由重写：`vercel.json`

在 Vercel 导入 `Weoslyn/OvO` 后，添加环境变量：

- 推荐无卡方案：`GITHUB_DB_TOKEN`、`GITHUB_DB_REPO`、`GITHUB_DB_BRANCH`、`GITHUB_DB_PATH`
- Supabase 方案：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`

Build command 可以留空或使用默认；项目没有前端构建步骤。部署完成后，访问 Vercel 域名即可。

## 后续可扩展

- 用户登录、邮箱找回、提醒邮件。
- 图片上传、举报和审核工作台。
- 分享图生成、二维码和社交分享。
- 广场/公开帖子/点赞/评论。
- 数据库存储、限流、人机验证和内容安全策略。
