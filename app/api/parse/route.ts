import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  ParseApiResponse,
  ParseErrorCode,
  Transaction,
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

function validateTransaction(value: unknown): Transaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;

  if (
    typeof data.amount !== "number" ||
    !Number.isFinite(data.amount) ||
    data.amount <= 0 ||
    (data.type !== "EXPENSE" && data.type !== "INCOME") ||
    typeof data.category !== "string" ||
    !data.category.trim() ||
    typeof data.date !== "string" ||
    !isRealDate(data.date) ||
    typeof data.note !== "string" ||
    !data.note.trim()
  ) {
    return null;
  }

  return {
    amount: data.amount,
    type: data.type,
    category: data.category.trim(),
    date: data.date,
    note: data.note.trim(),
  };
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
    return fail("EMPTY_INPUT", "请先描述一笔账单", 400);
  }
  if (text.length > 500) {
    return fail("VALIDATION_FAILED", "账单描述不能超过 500 个字符", 400);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return fail("SERVER_MISCONFIGURED", "AI 服务尚未配置", 500);
  }

  const today = new Date().toISOString().slice(0, 10);
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  });

  let content: string | null;
  try {
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `你是中文记账信息提取器。今天是 ${today}。
从用户输入中提取一笔账单，只能返回 JSON，不要输出 Markdown 或解释。
成功时严格返回：
{"amount": number, "type": "EXPENSE" | "INCOME", "category": string, "date": "YYYY-MM-DD", "note": string}
规则：
1. amount 必须是大于 0 的数字，不带货币符号。
2. type 只能是 EXPENSE 或 INCOME。
3. category 使用简短中文分类，如餐饮、交通、购物、工资、其他。
4. date 根据“今天、昨天”等相对日期和今天日期推断；未提到日期时使用今天。
5. note 是简洁且非空的账单说明。
6. 如果输入不是明确的收支、缺少金额，或无法可靠提取，只返回 {"error":"UNPARSEABLE"}。`,
        },
        { role: "user", content: text.trim() },
      ],
    });
    content = completion.choices[0]?.message.content ?? null;
  } catch {
    return fail("UPSTREAM_ERROR", "AI 服务暂时不可用，请稍后重试", 502);
  }

  if (!content) {
    return fail("INVALID_JSON", "AI 未返回有效结果", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return fail("INVALID_JSON", "AI 返回的 JSON 格式无效", 502);
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in parsed &&
    (parsed as { error?: unknown }).error === "UNPARSEABLE"
  ) {
    return fail("UNPARSEABLE", "无法从输入中识别账单信息", 422);
  }

  const transaction = validateTransaction(parsed);
  if (!transaction) {
    return fail("VALIDATION_FAILED", "解析结果缺少必要字段", 422);
  }

  return NextResponse.json<ParseApiResponse>({ ok: true, data: transaction });
}
