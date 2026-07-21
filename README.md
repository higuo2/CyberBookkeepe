# CyberBookkeeper

移动端优先的 AI 智能记账 PWA，基于 Next.js App Router、Tailwind CSS、DeepSeek、Supabase 和 Recharts。

## 本地启动

1. 复制 `.env.local.example` 为 `.env.local` 并填写真实密钥。
2. 在 Supabase SQL Editor 中运行 `supabase/schema.sql`。
3. 启动项目：

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。默认访问密码是 `cyber2026`，可在
`components/AuthGate.tsx` 中修改 `APP_PASSWORD`。

## 环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

DeepSeek 密钥只在服务端 API 路由使用。Supabase URL 和 anon key 会发送到浏览器。

## 安全说明

密码页是按需求实现的轻量本地拦截，只适合自用：密码存在前端代码和
LocalStorage 中，无法抵御有意绕过。数据库当前允许 anon key 读取和写入账单；
若应用需要公开部署或供多人使用，应改用 Supabase Auth，并按用户 ID 配置 RLS。

## PWA

生产构建会由 `next-pwa` 在 `public` 中生成 Service Worker。项目内的 SVG 图标是
占位图标，正式发布前建议替换为 192×192 和 512×512 PNG 图标，并同步更新
`public/manifest.json`。
