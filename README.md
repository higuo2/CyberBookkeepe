# CyberBookkeeper

移动端优先的 AI 智能记账 PWA（钱包小猫）。奶油色 UI，适配 iPhone 安全区；支持自然语言记账、账单管理、统计图表、AI 总结与 Excel 导出。币种默认 **HKD**。

## 功能一览

| Tab | 路径 | 能力 |
|-----|------|------|
| 记账 | `/` | 聊天式自然语言记账，多笔解析并自动入库 |
| 账单 | `/transactions` | 搜索 / 筛选 / 点按编辑 / Excel 导出 |
| 统计 | `/charts` | 月份切换、分类占比、近 7 日趋势、预算进度 |
| 总结 | `/summary` | AI 本月财务总结 |
| 我的 | `/profile` | 预算设置、全量导出 |

## 本地启动

1. 复制 `.env.local.example` 为 `.env.local`，填入密钥与访问密码。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
3. 安装并启动：

```bash
npm install
npm run dev
```

浏览器打开本地开发地址即可。访问密码仅保存在本地 `.env.local`（已加入 `.gitignore`），**请勿写进 README 或提交到仓库**。

> 说明：当前密码门是前端软校验（`NEXT_PUBLIC_*` 会打进客户端包）。公开部署时请自行评估风险，或后续升级为服务端鉴权。

## 环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_PASSWORD=   # 自设访问密码，勿公开

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 技术栈

Next.js App Router · Tailwind CSS · Recharts · Supabase · DeepSeek · next-pwa · xlsx · sonner · lucide-react
