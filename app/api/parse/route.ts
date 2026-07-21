import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/transaction-utils";
import type {
  ParseApiResponse,
  ParseErrorCode,
  ParsedTransaction,
} from "@/lib/types";

export const runtime = "nodejs";

function fail(code: ParseErrorCode, message: string, status: number) {
  return NextResponse.json<ParseApiResponse>(
    { ok: false, code, message },
    { status },
  );
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

function extractItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["transactions", "data", "items", "result"]) {
    if (Array.isArray(object[key])) return object[key];
  }
  return "amount" in object ? [object] : [];
}

function stripMarkdownFences(content: string) {
  return content.replace(/```json\n?|\n?```/g, "").trim();
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

  const today = new Date().toISOString().split("T")[0];
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
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `你是「钱包小猫」——一只温柔、治愈、爱陪用户记账的小猫助手。当前日期是 ${today}。

【人设】语气可爱但不油腻；会给用户暖心点评。解析要准确，点评要有情绪价值。

【核心任务】从用户输入中提取【所有】消费/收入项。一句含多笔金额必须全部拆开，不得合并遗漏。

【币种】默认港币 HKD。识别 HKD、港币、港元、HK$、$。未写币种也按港币，不要换算。

【输出格式】必须返回 JSON 对象，内含 transactions 数组（即使只有 1 笔也是单元素数组）：
{"transactions":[{"amount":25,"type":"EXPENSE","category":"其它","date":"${today}","note":"🍎","comment":"钱包小猫点评：已悄悄收好这笔小账，今天也有在认真生活。"}]}

字段规则：
1. amount：大于 0 的数字，不含货币符号
2. type：只能是 EXPENSE 或 INCOME
3. category：支出仅用 [${expenseCats}]；收入仅用 [${incomeCats}]
4. date：按“今天/昨天/前天”相对 ${today} 推算；未提日期用 ${today}
5. note：简短用途；可保留 emoji；可为空字符串
6. comment：必填。一句 15～28 字的治愈/可爱点评，必须以「钱包小猫点评：」开头

示例：输入「今天午饭38，奶茶21，交通15」应返回 3 条。

仅当完全没有金额时返回 {"transactions":[]}。不要输出 Markdown 或解释文字。`,
        },
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

  const rawItems = extractItems(parsed).slice(0, 30);
  const transactions = rawItems
    .map((item) => normalizeTransaction(item, text.trim(), today))
    .filter((item): item is ParsedTransaction => item !== null);

  if (transactions.length === 0) {
    return fail("UNPARSEABLE", "没有发现金额哦，例如可以说「午饭 68」", 422);
  }

  return NextResponse.json<ParseApiResponse>({
    ok: true,
    data: transactions,
  });
}
