import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ParseErrorCode, SummaryApiResponse } from "@/lib/types";
import { createT, localePromptLabel, normalizeLocale } from "@/lib/i18n";

export const runtime = "nodejs";

function fail(code: ParseErrorCode, message: string, status: number) {
  return NextResponse.json<SummaryApiResponse>(
    { ok: false, code, message },
    { status },
  );
}

function stripMarkdownFences(content: string) {
  return content.replace(/```json\n?|\n?```/g, "").trim();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("EMPTY_INPUT", createT("zh-CN")("api.summary.emptyBody"), 400);
  }

  const payload =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const locale = normalizeLocale(payload.locale);
  const t = createT(locale);

  const totalExpense = Number(payload.totalExpense ?? 0);
  const totalIncome = Number(payload.totalIncome ?? 0);
  const categories = Array.isArray(payload.categories)
    ? payload.categories
    : [];
  const monthLabel =
    typeof payload.monthLabel === "string" ? payload.monthLabel : "本月";

  if (!Number.isFinite(totalExpense) && !Number.isFinite(totalIncome)) {
    return fail("EMPTY_INPUT", t("api.summary.missingStats"), 400);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return fail("SERVER_MISCONFIGURED", t("api.summary.noAi"), 500);
  }

  const today = new Date().toISOString().split("T")[0];
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  });

  try {
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `你是温暖、务实的私人财务教练。当前日期是 ${today}。
根据用户给出的港币（HKD）月度账单聚合数据，使用${localePromptLabel(locale)}写一段财务总结。
要求：有情绪价值但不鸡汤；点出 1～2 个主要支出结构；给出 2 条可执行建议；语气像懂生活的朋友。
summary 必须使用${localePromptLabel(locale)}。
只输出纯文本，不要 Markdown 标题或列表符号过多。`,
        },
        {
          role: "user",
          content: JSON.stringify({
            monthLabel,
            currency: "HKD",
            totalExpense,
            totalIncome,
            net: totalIncome - totalExpense,
            categories,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message.content?.trim();
    if (!raw) {
      return fail("INVALID_JSON", t("api.summary.emptyResult"), 502);
    }

    return NextResponse.json<SummaryApiResponse>({
      ok: true,
      summary: stripMarkdownFences(raw),
    });
  } catch {
    return fail("UPSTREAM_ERROR", t("api.summary.upstream"), 502);
  }
}
