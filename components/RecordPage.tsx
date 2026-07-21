"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import type { ParseApiResponse, ParseErrorCode, Transaction } from "@/lib/types";

const errorMessages: Partial<Record<ParseErrorCode, string>> = {
  EMPTY_INPUT: "请先描述一笔账单",
  UNPARSEABLE: "没有识别到账单，请补充金额和用途",
  INVALID_JSON: "解析结果格式异常，请重试",
  VALIDATION_FAILED: "账单信息不完整，请换一种说法",
  UPSTREAM_ERROR: "AI 服务暂时不可用，请稍后重试",
  SERVER_MISCONFIGURED: "AI 服务尚未配置",
};

function money(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
}

export function RecordPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Transaction | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function parseTransaction() {
    const text = input.trim();
    if (!text) {
      toast.error("请先输入一笔账单");
      return;
    }
    if (!navigator.onLine) {
      toast.error("当前无网络，请联网后再试");
      return;
    }

    setIsParsing(true);
    setResult(null);
    const toastId = toast.loading("正在智能解析…");

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as ParseApiResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.ok
          ? "解析失败，请稍后重试"
          : errorMessages[payload.code] ?? payload.message;
        throw new Error(message);
      }

      setResult(payload.data);
      toast.success("解析完成，请确认账单", { id: toastId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "网络异常，请稍后重试";
      toast.error(message, { id: toastId });
    } finally {
      setIsParsing(false);
    }
  }

  async function saveTransaction() {
    if (!result || isSaving) return;
    if (!navigator.onLine) {
      toast.error("当前无网络，无法保存账单");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("正在存入云端…");

    try {
      const { error } = await getSupabase()
        .from("transactions")
        .insert(result);
      if (error) throw error;

      toast.success("账单已存入云端", { id: toastId });
      setInput("");
      setResult(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "保存失败，请稍后重试";
      toast.error(message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }

  const busy = isParsing || isSaving;

  return (
    <main className="px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <header>
        <p className="text-sm font-semibold text-emerald-600">智能记账</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">
          今天花了什么？
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          用一句话描述，剩下的交给 AI。
        </p>
      </header>

      <section className="mt-8">
        <label className="sr-only" htmlFor="transaction-input">
          账单描述
        </label>
        <textarea
          className="min-h-52 w-full resize-none rounded-[1.75rem] border border-stone-200 bg-white p-5 text-lg leading-8 text-stone-900 shadow-sm outline-none transition placeholder:text-stone-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-stone-100"
          disabled={busy}
          id="transaction-input"
          maxLength={500}
          onChange={(event) => setInput(event.target.value)}
          placeholder="例如：今天午饭花了 32 元"
          value={input}
        />
        <button
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 font-semibold text-white shadow-lg shadow-stone-300 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !input.trim()}
          onClick={parseTransaction}
          type="button"
        >
          {isParsing ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <Sparkles className="size-5" />
          )}
          {isParsing ? "解析中…" : "智能解析"}
        </button>
      </section>

      {result && (
        <section className="mt-7 animate-in rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                解析结果
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                {money(result.amount)}
              </p>
            </div>
            <span
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                result.type === "EXPENSE"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {result.type === "EXPENSE" ? (
                <ArrowDown className="size-3.5" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
              {result.type === "EXPENSE" ? "支出" : "收入"}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5 text-sm">
            <div>
              <dt className="text-stone-400">分类</dt>
              <dd className="mt-1 font-medium text-stone-800">{result.category}</dd>
            </div>
            <div>
              <dt className="text-stone-400">日期</dt>
              <dd className="mt-1 font-medium text-stone-800">{result.date}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-stone-400">备注</dt>
              <dd className="mt-1 font-medium text-stone-800">{result.note}</dd>
            </div>
          </dl>

          <button
            className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            disabled={busy}
            onClick={saveTransaction}
            type="button"
          >
            {isSaving && <LoaderCircle className="size-5 animate-spin" />}
            {isSaving ? "保存中…" : "确认并存入云端"}
          </button>
        </section>
      )}
    </main>
  );
}
