# CyberBookkeeper

移动端优先的 AI 智能记账 PWA（钱包小猫）。奶油色 UI，适配 iPhone 安全区；支持自然语言记账、账单管理、统计图表、规划资产与 Excel 导出。币种默认 **HKD**（港币），另支持 CNY / JPY / KRW；各币种独立结算，不做汇率换算。

## 功能一览

| Tab | 路径 | 能力 |
|-----|------|------|
| 记账 | `/` | 聊天式自然语言记账，多笔解析并自动入库 |
| 账单 | `/transactions` | 搜索 / 筛选 / 点按编辑 / Excel 导出 |
| 统计 | `/charts` | 按币种独立展示本月收支与分类占比（不做汇率换算） |
| 规划 | `/summary` | 预算进度（含预估固定开销）、周期收支/订阅、愿望存钱罐 |
| 设置 | `/profile` | 默认记账币种、导出、重置与关于 |

## 本地启动

1. 复制 `.env.local.example` 为 `.env.local`，填入密钥与访问密码。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`（含 `transactions`、`chat_messages`、`planner_state`）。若表已存在、只缺多币种，可只跑 `supabase/migrate-currency.sql`；若只缺规划云同步，可只跑 `supabase/migrate-planner-cloud.sql`；若只缺猫罐头小铺 / 主题字段，可只跑 `supabase/migrate-can-store.sql`。
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

Next.js App Router · Tailwind CSS · Recharts · Supabase · DeepSeek · vaul · next-pwa · xlsx · sonner · lucide-react
