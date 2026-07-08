# OvO Letters

一个匿名来信箱 MVP。当前先完成不依赖最终 UI 的产品底座：创建信箱、邮箱绑定、公开收信页、匿名投稿、收信管理、公开回信、归档和找回入口。

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

## 后续可扩展

- 用户登录、邮箱找回、提醒邮件。
- 图片上传、举报和审核工作台。
- 分享图生成、二维码和社交分享。
- 广场/公开帖子/点赞/评论。
- 数据库存储、限流、人机验证和内容安全策略。
