"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Mic, SendHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { CatAvatar } from "@/components/CatAvatar";
import { CategoryIcon } from "@/components/CategoryIcon";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  localDateString,
  prepareDraft,
} from "@/lib/transaction-utils";
import type {
  ParseApiResponse,
  ParsedTransaction,
  Transaction,
} from "@/lib/types";

type ChatMessage =
  | { id: string; kind: "bot-text"; text: string }
  | { id: string; kind: "user"; text: string }
  | {
      id: string;
      kind: "bot-records";
      records: Array<ParsedTransaction & { id?: string; recordedAt: string }>;
    }
  | { id: string; kind: "bot-error"; text: string };

const QUICK_PILLS = ["饮食", "交通", "购物", "娱乐"] as const;
const CATEGORY_TAGS = [
  { label: "餐饮", value: "餐饮" },
  { label: "交通", value: "交通" },
  { label: "购物", value: "购物" },
  { label: "住房", value: "居住" },
] as const;

function greetingByHour(hour: number) {
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString("zh-HK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatHeaderDate(date = new Date()) {
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDbRow(item: ParsedTransaction) {
  return prepareDraft({
    amount: item.amount,
    type: item.type,
    category: item.category,
    date: item.date,
    note: item.note,
  });
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    kind: "bot-text",
    text: `${greetingByHour(new Date().getHours())}，我是你的钱包小猫。今天想记什么账？`,
  };
}

export function RecordPage() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [todaySpend, setTodaySpend] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(),
  ]);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const today = localDateString();
        const { data } = await getSupabase()
          .from("transactions")
          .select("amount, type, date")
          .eq("date", today)
          .eq("type", "EXPENSE");
        const sum = (data ?? []).reduce(
          (acc, row) => acc + Number((row as Transaction).amount),
          0,
        );
        setTodaySpend(sum);
      } catch {
        // ignore header spend errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const headerDate = useMemo(() => formatHeaderDate(), []);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    if (!navigator.onLine) {
      toast.error("当前无网络，请联网后再试");
      return;
    }

    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { id: uid(), kind: "user", text }]);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as ParseApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? "小猫没听懂，请再试一次" : payload.message,
        );
      }

      const recordedAt = formatClock();
      const saved: Array<ParsedTransaction & { id?: string; recordedAt: string }> =
        [];

      for (const item of payload.data) {
        const row = toDbRow(item);
        const { data, error } = await getSupabase()
          .from("transactions")
          .insert(row)
          .select("id")
          .single();
        if (error) throw error;
        saved.push({
          ...item,
          ...row,
          id: data?.id,
          recordedAt,
        });
        if (item.type === "EXPENSE") {
          setTodaySpend((prev) => prev + Number(item.amount));
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: uid(), kind: "bot-records", records: saved },
      ]);
      toast.success(`小猫已记好 ${saved.length} 笔账`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "网络异常，请稍后重试";
      setMessages((prev) => [
        ...prev,
        { id: uid(), kind: "bot-error", text: message },
      ]);
      toast.error(message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendText(input);
  }

  async function changeCategory(
    messageId: string,
    recordId: string | undefined,
    recordIndex: number,
    category: string,
  ) {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.kind !== "bot-records" || msg.id !== messageId) return msg;
        return {
          ...msg,
          records: msg.records.map((record, index) =>
            index === recordIndex ? { ...record, category } : record,
          ),
        };
      }),
    );

    if (!recordId) return;

    try {
      const { error } = await getSupabase()
        .from("transactions")
        .update({ category })
        .eq("id", recordId);
      if (error) throw error;
      toast.success(`已改为「${category === "居住" ? "住房" : category}」`);
    } catch {
      toast.error("分类更新失败");
    }
  }

  return (
    <main className="relative flex h-full min-h-0 flex-col bg-[#FAF6EC]">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-[#EFE5D3] bg-[#FAF6EC] px-5 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div>
          <p className="text-sm font-medium text-[#8A7A5C]">{headerDate}</p>
          <p className="mt-0.5 text-base font-semibold text-[#5C4A32]">
            今日支出{" "}
            <span className="text-[#E07A3D]">{formatHKD(todaySpend)}</span>
          </p>
        </div>
        <div className="grid size-12 place-items-center rounded-full bg-[#FFE8B8] shadow-sm ring-2 ring-[#FAF6EC]">
          <CatAvatar size={44} />
        </div>
      </header>

      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-2 touch-pan-y"
        ref={feedRef}
      >
        {messages.map((message) => {
          if (message.kind === "user") {
            return (
              <div className="flex justify-end" key={message.id}>
                <div className="max-w-[80%] rounded-[1.5rem] rounded-br-md bg-[#A3E4D7] px-4 py-2.5 text-[15px] leading-6 text-[#1F4A44] shadow-sm">
                  {message.text}
                </div>
              </div>
            );
          }

          if (message.kind === "bot-text" || message.kind === "bot-error") {
            return (
              <div className="flex items-end gap-2" key={message.id}>
                <div className="mb-0.5 shrink-0 overflow-hidden rounded-full bg-[#FFE8B8] shadow-sm">
                  <CatAvatar size={34} />
                </div>
                <div
                  className={`max-w-[82%] rounded-[1.5rem] rounded-bl-md px-4 py-3 text-[15px] leading-6 shadow-sm ${
                    message.kind === "bot-error"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-white text-[#5C4A32]"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-3" key={message.id}>
              {message.records.map((record, index) => {
                const typeLabel =
                  record.type === "EXPENSE" ? "支出" : "收入";
                return (
                  <div className="flex items-end gap-2" key={`${message.id}-${index}`}>
                    <div className="mb-0.5 shrink-0 overflow-hidden rounded-full bg-[#FFE8B8] shadow-sm">
                      <CatAvatar size={34} />
                    </div>
                    <div className="max-w-[88%] rounded-3xl bg-white p-3.5 shadow-sm">
                      <p className="text-[15px] leading-6 text-[#5C4A32]">
                        已记录一笔{record.category}
                        {typeLabel}：{record.amount} 元，时间为今天{" "}
                        {record.recordedAt}。
                      </p>
                      <p className="mt-2 text-sm leading-5 text-[#9A7B55]">
                        {record.comment}
                      </p>

                      <div className="mt-3 rounded-2xl bg-[#FFF6D9] p-3">
                        <div className="flex items-center gap-3">
                          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F8C96A] text-[#8A5A12] shadow-sm">
                            {record.category === "其它" ? (
                              <Star className="size-5 fill-current" />
                            ) : (
                              <CategoryIcon
                                category={record.category}
                                className="size-5"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#5C4A32]">
                              {record.category === "居住"
                                ? "住房"
                                : record.category}
                            </p>
                            <p className="truncate text-sm text-[#A08B68]">
                              {record.note} · {record.recordedAt}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 text-base font-bold ${
                              record.type === "EXPENSE"
                                ? "text-[#E07A3D]"
                                : "text-[#2A9D8F]"
                            }`}
                          >
                            {record.type === "EXPENSE" ? "-" : "+"}
                            {formatHKD(record.amount)}
                          </p>
                        </div>

                        {record.type === "EXPENSE" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {CATEGORY_TAGS.map((tag) => {
                              const active = record.category === tag.value;
                              return (
                                <button
                                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
                                    active
                                      ? "bg-[#F8A055] text-white shadow-sm"
                                      : "bg-white/90 text-[#8A7A5C]"
                                  }`}
                                  key={tag.value}
                                  onClick={() =>
                                    void changeCategory(
                                      message.id,
                                      record.id,
                                      index,
                                      tag.value,
                                    )
                                  }
                                  type="button"
                                >
                                  {tag.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {busy && (
          <div className="flex items-end gap-2">
            <div className="overflow-hidden rounded-full bg-[#FFE8B8] shadow-sm">
              <CatAvatar size={34} />
            </div>
            <div className="rounded-[1.5rem] rounded-bl-md bg-white px-4 py-3 text-sm text-[#9A7B55] shadow-sm">
              小猫正在记账中…
            </div>
          </div>
        )}
      </div>

      <div className="z-30 shrink-0 border-t border-[#EFE5D3] bg-[#FAF6EC] pb-2 pt-2">
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_PILLS.map((pill) => (
            <button
              className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#6B5A40] shadow-sm transition-all active:scale-95"
              key={pill}
              onClick={() => {
                setInput((prev) => (prev ? `${prev}${pill}` : `${pill} `));
                inputRef.current?.focus();
              }}
              type="button"
            >
              {pill}
            </button>
          ))}
        </div>

        <form
          className="mx-4 flex items-center gap-2 rounded-[1.75rem] bg-white px-2 py-2 shadow-sm"
          onSubmit={onSubmit}
        >
          <button
            aria-label="语音输入"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#E8F4F8] text-[#6B8FA3] transition-all active:scale-95"
            onClick={() => toast.message("语音记账即将开放，先打字跟小猫说吧")}
            type="button"
          >
            <Mic className="size-5" />
          </button>
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-[#5C4A32] outline-none placeholder:text-[#C0B49A]"
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            placeholder="像聊天一样记一笔..."
            ref={inputRef}
            value={input}
          />
          <button
            aria-label="发送"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F8A055] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
            disabled={busy || !input.trim()}
            type="submit"
          >
            <SendHorizontal className="size-5" />
          </button>
        </form>
      </div>
    </main>
  );
}
