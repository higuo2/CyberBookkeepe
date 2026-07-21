# CyberBookkeeper v2.0

移动端优先的 AI 智能记账 PWA。支持多笔自然语言拆解、预算监控、趋势统计、AI 财务总结与 Excel 导出。

## 功能一览

| Tab | 路径 | 能力 |
|-----|------|------|
| 记账 | `/` | 自然语言多笔解析 → 可编辑预览 → 批量写入 |
| 账单 | `/transactions` | 搜索 / 筛选 / CRUD / Excel 导出 |
| 统计 | `/charts` | 支出/收入饼图、近 7 日趋势、预算进度 |
| 总结 | `/summary` | AI 本月财务总结 |
| 我的 | `/profile` | 预算设置、全量导出、系统设置占位 |

## 本地启动

1. 复制 `.env.local.example` 为 `.env.local` 并填写密钥。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`（含 update/delete RLS）。
3. 安装并启动：

```bash
npm install
npm run dev
```

默认访问密码：`cyber2026`（见 `components/AuthGate.tsx`）。

## 环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 技术栈

Next.js App Router · Tailwind CSS · Recharts · Supabase · DeepSeek · next-pwa · xlsx · sonner · lucide-react
