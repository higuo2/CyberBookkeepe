import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/transaction-utils";
import type {
  ParseApiResponse,
  ParseErrorCode,
  ParsedRecurringData,
  ParsedTransaction,
} from "@/lib/types";

export const runtime = "nodejs";

function fail(code: ParseErrorCode, message: string, status: number) {
  return NextResponse.json<ParseApiResponse>(
    { ok: false, code, message },
    { status },
  );
}

function todayHongKong() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = value.replaceAll(",", "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeCategory(type: "EXPENSE" | "INCOME", raw: unknown) {
  const list = type === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (typeof raw === "string" && raw.trim()) {
    const hit = list.find(
      (item) => raw.includes(item) || item.includes(raw.trim()),
    );
    if (hit) return hit;
    if (raw.includes("住房") || raw.includes("居住")) {
      return type === "EXPENSE" ? "居住" : list[0];
    }
    if (raw.includes("饮食") || raw.includes("饭") || raw.includes("餐")) {
      return type === "EXPENSE" ? "餐饮" : list[0];
    }
    if (raw.includes("订阅")) {
      return type === "EXPENSE" ? "娱乐" : list[0];
    }
    if (raw.includes("其他") || raw.includes("其它")) {
      return type === "EXPENSE" ? "其它" : "其它收入";
    }
  }
  return type === "EXPENSE" ? "其它" : "其它收入";
}

function defaultComment(type: "EXPENSE" | "INCOME", category: string) {
  if (type === "INCOME") {
    return "钱包小猫点评：叮咚～收入到账啦，今天也在慢慢变富有。";
  }
  return `钱包小猫点评：已悄悄收好这笔${category}小账，今天也有在认真生活。`;
}

function defaultRecurringReply(data: ParsedRecurringData) {
  const dir = data.direction === "income" ? "收入" : "支出";
  return `钱包小猫已帮你设好「${data.title}」这笔固定${dir}啦，可在规划页查看～`;
}

function normalizeTransaction(
  value: unknown,
  fallbackNote: string,
  today: string,
): ParsedTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const amount = normalizeAmount(data.amount);
  if (amount === null) return null;

  const type = data.type === "INCOME" ? "INCOME" : "EXPENSE";
  const category = normalizeCategory(type, data.category);
  const date =
    typeof data.date === "string" && isRealDate(data.date) ? data.date : today;
  const note =
    typeof data.note === "string" && data.note.trim()
      ? data.note.trim()
      : fallbackNote || category;
  const comment =
    typeof data.comment === "string" && data.comment.trim()
      ? data.comment.trim()
      : defaultComment(type, category);

  return { amount, type, category, date, note, comment };
}

function extractTransactionItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["transactions", "items", "result"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  // 兼容旧结构：data 为数组时当作普通账单
  if (Array.isArray(object.data)) return object.data as unknown[];
  if ("amount" in object && !("title" in object) && !("period_type" in object)) {
    return [object];
  }
  return [];
}

function normalizeRecurringData(
  raw: unknown,
  today: string,
): ParsedRecurringData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const amount = normalizeAmount(data.amount);
  if (amount === null) return null;

  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : "";
  if (!title) return null;

  const direction = data.direction === "income" ? "income" : "expense";
  const type = direction === "income" ? "INCOME" : "EXPENSE";
  const category = normalizeCategory(type, data.category);

  const periodRaw = String(data.period_type ?? "monthly");
  const period_type =
    periodRaw === "daily" || periodRaw === "weekly" || periodRaw === "monthly"
      ? periodRaw
      : "monthly";

  let by_days: number[] | undefined;
  if (Array.isArray(data.by_days)) {
    by_days = data.by_days
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  }

  let day_of_month: number | undefined;
  if (period_type === "monthly") {
    const d = Number(data.day_of_month);
    day_of_month = Number.isFinite(d) ? Math.min(31, Math.max(1, d)) : 1;
  }

  const start_date =
    typeof data.start_date === "string" && isRealDate(data.start_date)
      ? data.start_date
      : today;
  const end_date =
    typeof data.end_date === "string" && isRealDate(data.end_date)
      ? data.end_date
      : undefined;

  return {
    title,
    amount,
    direction,
    category,
    period_type,
    by_days,
    day_of_month,
    start_date,
    end_date,
    auto_record: data.auto_record !== false,
  };
}

function stripMarkdownFences(content: string) {
  return content.replace(/```json\n?|\n?```/g, "").trim();
}

function buildSystemPrompt(today: string, expenseCats: string, incomeCats: string) {
  return `Today is ${today}.

你是「钱包小猫」——一只温柔、治愈、爱陪用户记账的小猫助手。

【人设】语气可爱但不油腻；会给用户暖心点评。解析要准确，点评要有情绪价值。

【币种】默认港币 HKD。识别 HKD、港币、港元、HK$、$。未写币种也按港币，不要换算。

【判断分支】先判断用户这句话是：
A) 一次性账单（今天午饭、买了咖啡等）→ is_recurring=false
B) 周期性/固定收支（每月房租、工作日交通、每周健身房、发工资等）→ is_recurring=true

关键词提示（周期）：每月、每个月、每周、工作日、每天、固定、订阅、会费、房租、工资、津贴、持续到、截止到、一直到。

————————
【A. 普通账单】必须返回严格 JSON：
{
  "is_recurring": false,
  "data": [
    {
      "amount": 25,
      "type": "EXPENSE",
      "category": "餐饮",
      "date": "${today}",
      "note": "午饭",
      "comment": "钱包小猫点评：已悄悄收好这笔小账，今天也有在认真生活。"
    }
  ],
  "reply_text": "好的，已经帮你记下啦～"
}

规则：
1. data 为数组；一句多笔必须全部拆开，不得合并遗漏（也可同时返回 transactions 数组，与 data 同结构）。
2. amount：大于 0；type：只能 EXPENSE 或 INCOME。
3. category：支出仅用 [${expenseCats}]；收入仅用 [${incomeCats}]。
4. date：按“今天/昨天/前天”相对 ${today} 推算；未提日期用 ${today}。
5. note：简短用途；comment：15～28 字，必须以「钱包小猫点评：」开头。
6. reply_text：一句亲切确认语。

————————
【B. 周期/固定收支】必须返回严格 JSON（单条规则，不要数组）：
{
  "is_recurring": true,
  "data": {
    "title": "工作日交通",
    "amount": 10.2,
    "direction": "expense",
    "category": "交通",
    "period_type": "weekly",
    "by_days": [1, 2, 3, 4, 5],
    "start_date": "${today}",
    "end_date": "2027-06-30",
    "auto_record": true
  },
  "reply_text": "好的，已帮你设好工作日交通的固定支出，可在规划页查看哦～"
}

字段规则：
1. title：名称；amount：大于 0；direction：只能 expense 或 income。
2. category：支出 [${expenseCats}]；收入 [${incomeCats}]。
3. period_type：daily（每天）| weekly（按星期）| monthly（每月）。
4. by_days：仅 weekly 需要；1=周一 … 7=周日。工作日=[1,2,3,4,5]。daily 可省略 by_days。
5. day_of_month：仅 monthly 需要，1–31（如「每月 10 号」→ 10）。
6. start_date：生效日 YYYY-MM-DD，默认 ${today}；相对日期按 Today 推算。
7. end_date：可选截止日期 YYYY-MM-DD（如「持续到 2027 年 6 月」→ 该月末）。
8. auto_record：默认 true（到期自动记账）。
9. reply_text：亲切说明已写入「规划」周期收支。

示例：
- 「工作日每天交通费 10.2 元，持续到 2027 年 6 月」→ is_recurring true, weekly, by_days [1,2,3,4,5], end_date 2027-06-30
- 「每月 10 号发工资 20000」→ is_recurring true, monthly, day_of_month 10, direction income
- 「今天午饭 38，奶茶 21」→ is_recurring false, data 含 2 笔

仅输出 JSON，不要 Markdown 或解释文字。完全没有金额时：{"is_recurring":false,"data":[],"reply_text":"没有发现金额哦～"}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("EMPTY_INPUT", "请求内容不能为空", 400);
  }

  const text =
    body && typeof body === "object" && "text" in body
      ? (body as { text?: unknown }).text
      : undefined;
  const clientToday =
    body && typeof body === "object" && "today" in body
      ? (body as { today?: unknown }).today
      : undefined;
  const historyRaw =
    body && typeof body === "object" && "history" in body
      ? (body as { history?: unknown }).history
      : undefined;

  const history: { role: "user" | "assistant"; content: string }[] = [];
  if (Array.isArray(historyRaw)) {
    for (const item of historyRaw.slice(-12)) {
      if (!item || typeof item !== "object") continue;
      const row = item as { role?: unknown; content?: unknown };
      if (
        (row.role === "user" || row.role === "assistant") &&
        typeof row.content === "string" &&
        row.content.trim()
      ) {
        history.push({
          role: row.role,
          content: row.content.trim().slice(0, 500),
        });
      }
    }
  }

  if (typeof text !== "string" || !text.trim()) {
    return fail("EMPTY_INPUT", "请先跟小猫说一笔账吧", 400);
  }
  if (text.length > 800) {
    return fail("VALIDATION_FAILED", "这段话太长啦，小猫记不住哦", 400);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return fail("SERVER_MISCONFIGURED", "AI 服务尚未配置", 500);
  }

  const today =
    typeof clientToday === "string" && isRealDate(clientToday)
      ? clientToday
      : todayHongKong();

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  });

  const expenseCats = EXPENSE_CATEGORIES.join("、");
  const incomeCats = INCOME_CATEGORIES.join("、");

  let content: string | null;
  try {
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(today, expenseCats, incomeCats),
        },
        ...history.map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: text.trim() },
      ],
    });
    content = completion.choices[0]?.message.content ?? null;
  } catch {
    return fail("UPSTREAM_ERROR", "小猫打了个盹，请稍后再试", 502);
  }

  if (!content) {
    return fail("INVALID_JSON", "小猫没有听清，请再说一次", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(content));
  } catch {
    return fail("INVALID_JSON", "小猫解析失败，请换种说法", 502);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail("INVALID_JSON", "小猫解析失败，请换种说法", 502);
  }

  const root = parsed as Record<string, unknown>;
  const reply_text =
    typeof root.reply_text === "string" && root.reply_text.trim()
      ? root.reply_text.trim()
      : "";

  const isRecurring =
    root.is_recurring === true || root.is_recurring === "true";

  if (isRecurring) {
    const recurring = normalizeRecurringData(root.data, today);
    if (!recurring) {
      return fail(
        "UNPARSEABLE",
        "没有识别出完整的周期规则哦，可以说「每月10号房租8000」",
        422,
      );
    }
    return NextResponse.json<ParseApiResponse>({
      ok: true,
      is_recurring: true,
      data: recurring,
      reply_text: reply_text || defaultRecurringReply(recurring),
    });
  }

  // 普通账单：优先 data 数组，兼容 transactions
  const rawItems = (
    Array.isArray(root.data)
      ? (root.data as unknown[])
      : extractTransactionItems(parsed)
  ).slice(0, 30);

  const transactions = rawItems
    .map((item) => normalizeTransaction(item, text.trim(), today))
    .filter((item): item is ParsedTransaction => item !== null);

  if (transactions.length === 0) {
    return fail("UNPARSEABLE", "没有发现金额哦，例如可以说「午饭 68」", 422);
  }

  return NextResponse.json<ParseApiResponse>({
    ok: true,
    is_recurring: false,
    data: transactions,
    reply_text:
      reply_text ||
      (transactions.length === 1
        ? "好的，已经帮你记下啦～"
        : `好的，一共 ${transactions.length} 笔都记好啦～`),
  });
}
