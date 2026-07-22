"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, SendHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { CatAvatar } from "@/components/CatAvatar";
import { CategoryIcon } from "@/components/CategoryIcon";
import {
  RecurringEditorSheet,
  computeFormNextDate,
  emptyRecurringForm,
  type RecurringFormState,
} from "@/components/RecurringEditorSheet";
import { TransactionDialog } from "@/components/TransactionDialog";
import {
  fetchChatHistory,
  formatChatPersistError,
  insertChatMessage,
  recordsAggregateStatus,
  toParseHistory,
  updateChatMessage,
  type ChatCardStatus,
  type PendingRecord,
  type UiChatMessage,
} from "@/lib/chat-messages";
import {
  mapAiDaysToCodes,
  persistAiRecurringItem,
} from "@/lib/ai-recurring";
import { syncDueRecurringItems } from "@/lib/recurring-sync";
import {
  WORKDAYS,
  createRecurringItem,
  readRecurringItems,
  writeRecurringItems,
  type WeekdayCode,
} from "@/lib/planner";
import { getSupabase } from "@/lib/supabase";
import {
  formatHKD,
  localDateString,
  prepareDraft,
} from "@/lib/transaction-utils";
import type {
  ParseApiResponse,
  ParsedRecurringData,
  ParsedTransaction,
  Transaction,
  TransactionDraft,
} from "@/lib/types";
import { cleanNote } from "@/lib/utils";

type ChatMessage = UiChatMessage;

const QUICK_CHIPS: {
  label: string;
  mode: "fill" | "nav";
  value: string;
}[] = [
  { label: "☕ 咖啡 HK$28", mode: "fill", value: "咖啡 28" },
  { label: "🍱 快捷午餐 HK$45", mode: "fill", value: "快捷午餐 45" },
  {
    label: "🚌 工作日交通",
    mode: "fill",
    value: "工作日每天交通费 10.2 元",
  },
  { label: "📊 查看本月支出", mode: "nav", value: "/charts" },
];

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

function toDbRow(item: ParsedTransaction | TransactionDraft) {
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
    text: `${greetingByHour(new Date().getHours())}，我是你的钱包小猫。今天想记什么账？解析后请点「确认存入」哦～`,
  };
}

async function syncBotRecordsCloud(
  messageId: string,
  records: PendingRecord[],
  replyText?: string,
) {
  if (messageId === "welcome") return;
  await updateChatMessage(messageId, {
    status: recordsAggregateStatus(records),
    content: replyText ?? "",
    card_data: {
      kind: "bot-records",
      replyText,
      records,
    },
  });
}

async function syncBotRecurringCloud(
  messageId: string,
  item: ParsedRecurringData,
  replyText: string,
  status: ChatCardStatus,
) {
  if (messageId === "welcome") return;
  await updateChatMessage(messageId, {
    status,
    content: replyText,
    card_data: {
      kind: "bot-recurring",
      replyText,
      item,
    },
  });
}

function recurringFormFromAi(data: ParsedRecurringData): RecurringFormState {
  const allDays: WeekdayCode[] = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
    "SUN",
  ];
  const byDays =
    data.period_type === "daily"
      ? allDays
      : data.period_type === "weekly"
        ? mapAiDaysToCodes(data.by_days)
        : [...WORKDAYS];

  return {
    name: data.title,
    amount: String(data.amount),
    direction: data.direction === "income" ? "income" : "expense",
    kind: data.period_type === "monthly" ? "monthly" : "by_days",
    dayOfMonth: String(data.day_of_month ?? 10),
    monthOfYear: String(new Date().getMonth() + 1),
    byDays,
    endDate: data.end_date ?? "",
    remindDays: "3",
    autoWrite: data.auto_record !== false,
    emoji: data.direction === "income" ? "💵" : "🚌",
  };
}

function periodLabel(item: ParsedRecurringData) {
  if (item.period_type === "daily") return "每天";
  if (item.period_type === "weekly") return "按星期";
  return `每月${item.day_of_month ?? ""}日`;
}

export function RecordPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [todaySpend, setTodaySpend] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txDraft, setTxDraft] = useState<TransactionDraft>(() =>
    prepareDraft({
      amount: 0,
      type: "EXPENSE",
      category: "餐饮",
      date: localDateString(),
      note: "",
    }),
  );
  const [txEditTarget, setTxEditTarget] = useState<{
    messageId: string;
    recordIndex: number;
  } | null>(null);

  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringForm, setRecurringForm] = useState<RecurringFormState>(
    emptyRecurringForm,
  );
  const [recurringEditId, setRecurringEditId] = useState<string | null>(null);

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
        // ignore
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const history = await fetchChatHistory();
        setMessages(history.length > 0 ? history : [createWelcomeMessage()]);
      } catch {
        setMessages([createWelcomeMessage()]);
        toast.message("对话记录暂未同步，可先继续记账");
      } finally {
        setHistoryReady(true);
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

    const prior = messages.filter((m) => m.id !== "welcome");
    let userSaved: ChatMessage | null = null;

    try {
      userSaved = await insertChatMessage({ kind: "user", text });
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== "welcome");
        return [...base, userSaved!];
      });

      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          today: localDateString(),
          history: toParseHistory([...prior, userSaved]),
        }),
      });
      const payload = (await response.json()) as ParseApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? "小猫没听懂，请再试一次" : payload.message,
        );
      }

      if (payload.is_recurring) {
        const assistant = await insertChatMessage({
          kind: "bot-recurring",
          replyText: payload.reply_text,
          item: payload.data,
          status: "pending",
        });
        setMessages((prev) => [...prev, assistant]);
        return;
      }

      const recordedAt = formatClock();
      const records: PendingRecord[] = payload.data.map((item) => ({
        ...item,
        recordedAt,
        status: "pending" as const,
      }));

      const assistant = await insertChatMessage({
        kind: "bot-records",
        records,
        replyText: payload.reply_text,
      });
      setMessages((prev) => [...prev, assistant]);
    } catch (error) {
      const message = formatChatPersistError(error);
      try {
        if (!userSaved) {
          // 用户消息未入库时，至少本地展示
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== "welcome"),
            { id: `local-u-${Date.now()}`, kind: "user", text },
          ]);
        }
        const errMsg = await insertChatMessage({
          kind: "bot-error",
          text: message,
        });
        setMessages((prev) => [...prev, errMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `local-err-${Date.now()}`, kind: "bot-error", text: message },
        ]);
      }
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

  async function confirmTransaction(messageId: string, recordIndex: number) {
    if (!navigator.onLine) {
      toast.error("当前无网络，无法存入");
      return;
    }
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.kind !== "bot-records") return;
    const record = msg.records[recordIndex];
    if (!record || record.status !== "pending") return;

    setActionBusy(true);
    try {
      const row = toDbRow(record);
      const { data, error } = await getSupabase()
        .from("transactions")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;

      const nextRecords = msg.records.map((r, i) =>
        i === recordIndex
          ? {
              ...r,
              ...row,
              id: data?.id,
              status: "confirmed" as const,
              recordedAt: formatClock(),
            }
          : r,
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "bot-records" && m.id === messageId
            ? { ...m, records: nextRecords }
            : m,
        ),
      );
      await syncBotRecordsCloud(messageId, nextRecords, msg.replyText);
      if (row.type === "EXPENSE") {
        setTodaySpend((prev) => prev + Number(row.amount));
      }
      toast.success("记录成功喵~");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "存入失败，请稍后重试",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmRecurring(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.kind !== "bot-recurring" || msg.status !== "pending") return;

    setActionBusy(true);
    try {
      const item = persistAiRecurringItem(msg.item);
      if (item.autoWrite !== false) {
        try {
          await syncDueRecurringItems([item]);
        } catch {
          // ignore sync failure
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "bot-recurring" && m.id === messageId
            ? { ...m, status: "confirmed" as const }
            : m,
        ),
      );
      await syncBotRecurringCloud(
        messageId,
        msg.item,
        msg.replyText,
        "confirmed",
      );
      toast.success("记录成功喵~");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "存入规划失败，请稍后重试",
      );
    } finally {
      setActionBusy(false);
    }
  }

  function openCustomTransaction(messageId: string, recordIndex: number) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.kind !== "bot-records") return;
    const record = msg.records[recordIndex];
    if (!record || record.status !== "pending") return;
    setTxDraft({
      amount: Number(record.amount),
      type: record.type,
      category: record.category,
      date: record.date,
      note: cleanNote(record.note),
    });
    setTxEditTarget({ messageId, recordIndex });
    setTxDialogOpen(true);
  }

  function openCustomRecurring(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.kind !== "bot-recurring" || msg.status !== "pending") return;
    setRecurringForm(recurringFormFromAi(msg.item));
    setRecurringEditId(messageId);
    setRecurringOpen(true);
  }

  async function saveCustomTransaction() {
    if (!txEditTarget) return;
    if (!navigator.onLine) {
      toast.error("当前无网络，无法存入");
      return;
    }
    setActionBusy(true);
    try {
      const row = toDbRow(txDraft);
      const { data, error } = await getSupabase()
        .from("transactions")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;

      const { messageId, recordIndex } = txEditTarget;
      const msg = messages.find((m) => m.id === messageId);
      const nextRecords =
        msg && msg.kind === "bot-records"
          ? msg.records.map((r, i) =>
              i === recordIndex
                ? {
                    ...r,
                    ...row,
                    comment: r.comment,
                    id: data?.id,
                    status: "confirmed" as const,
                    recordedAt: formatClock(),
                  }
                : r,
            )
          : [];

      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== "bot-records" || m.id !== messageId) return m;
          return { ...m, records: nextRecords };
        }),
      );
      if (msg && msg.kind === "bot-records") {
        await syncBotRecordsCloud(messageId, nextRecords, msg.replyText);
      }
      if (row.type === "EXPENSE") {
        setTodaySpend((prev) => prev + Number(row.amount));
      }
      setTxDialogOpen(false);
      setTxEditTarget(null);
      toast.success("记录成功喵~");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "存入失败，请稍后重试",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function saveCustomRecurring(event: FormEvent) {
    event.preventDefault();
    if (!recurringEditId) return;
    const amount = Number(recurringForm.amount);
    if (!recurringForm.name.trim()) {
      toast.error("请填写名称");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("请输入有效金额");
      return;
    }
    if (
      recurringForm.kind === "by_days" &&
      recurringForm.byDays.length === 0
    ) {
      toast.error("请至少选择一个星期");
      return;
    }

    setActionBusy(true);
    try {
      const dayOfMonth = Math.min(
        31,
        Math.max(1, Number(recurringForm.dayOfMonth) || 1),
      );
      const nextDate = computeFormNextDate(recurringForm);
      const item = createRecurringItem({
        name: recurringForm.name.trim(),
        amount,
        direction: recurringForm.direction,
        autoWrite: recurringForm.autoWrite,
        emoji: recurringForm.emoji,
        recurrence: {
          kind: recurringForm.kind,
          dayOfMonth:
            recurringForm.kind === "monthly" ||
            recurringForm.kind === "yearly"
              ? dayOfMonth
              : undefined,
          by_days:
            recurringForm.kind === "by_days"
              ? recurringForm.byDays
              : undefined,
          end_date: recurringForm.endDate || null,
        },
        nextDate,
      });
      writeRecurringItems([item, ...readRecurringItems()]);
      if (item.autoWrite !== false) {
        try {
          await syncDueRecurringItems([item]);
        } catch {
          // ignore
        }
      }

      const updatedItem: ParsedRecurringData = {
        title: item.name,
        amount: item.amount,
        direction: item.direction,
        category: item.category ?? "其它",
        period_type:
          item.recurrence.kind === "monthly" ? "monthly" : "weekly",
        by_days:
          item.recurrence.kind === "by_days"
            ? (item.recurrence.by_days ?? []).map((code) => {
                const order: WeekdayCode[] = [
                  "MON",
                  "TUE",
                  "WED",
                  "THU",
                  "FRI",
                  "SAT",
                  "SUN",
                ];
                return order.indexOf(code) + 1;
              })
            : undefined,
        day_of_month: item.recurrence.dayOfMonth,
        start_date: localDateString(),
        end_date: item.recurrence.end_date ?? undefined,
        auto_record: item.autoWrite !== false,
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "bot-recurring" && m.id === recurringEditId
            ? {
                ...m,
                item: updatedItem,
                status: "confirmed" as const,
              }
            : m,
        ),
      );
      const prevMsg = messages.find((m) => m.id === recurringEditId);
      await syncBotRecurringCloud(
        recurringEditId,
        updatedItem,
        prevMsg && prevMsg.kind === "bot-recurring"
          ? prevMsg.replyText
          : "已更新周期规则",
        "confirmed",
      );
      setRecurringOpen(false);
      setRecurringEditId(null);
      toast.success("记录成功喵~");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "存入规划失败，请稍后重试",
      );
    } finally {
      setActionBusy(false);
    }
  }

  function handleChip(chip: (typeof QUICK_CHIPS)[number]) {
    if (chip.mode === "nav") {
      router.push(chip.value);
      return;
    }
    setInput(chip.value);
    inputRef.current?.focus();
  }

  return (
    <>
      <main className="relative flex h-full min-h-0 flex-col bg-[#FAF6EC]">
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-[#EFE5D3] bg-[#FAF6EC] px-5 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div>
            <p className="text-sm font-medium text-[#8A7A5C]">{headerDate}</p>
            <p className="mt-0.5 text-base font-semibold text-[#5C4A32]">
              今日支出{" "}
              <span className="text-[#E07A3D]">{formatHKD(todaySpend)}</span>
            </p>
          </div>
          <CatAvatar className="shadow-md" size={44} />
        </header>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-2 touch-pan-y"
          ref={feedRef}
        >
          {!historyReady ? (
            <div className="flex items-end gap-2 pt-4">
              <CatAvatar size={36} thinking />
              <div className="rounded-[1.5rem] rounded-bl-md border border-[#F0E6D6] bg-[#FFFDF7] px-4 py-3 text-sm text-[#9A7B55] shadow-sm">
                正在加载对话记录…
              </div>
            </div>
          ) : null}
          {historyReady &&
            messages.map((message) => {
            if (message.kind === "user") {
              return (
                <div className="flex justify-end" key={message.id}>
                  <div className="max-w-[80%] rounded-[1.5rem] rounded-br-md bg-[#D1EBE1] px-4 py-2.5 text-[15px] leading-6 text-[#3D4A45] shadow-sm">
                    {message.text}
                  </div>
                </div>
              );
            }

            if (message.kind === "bot-text" || message.kind === "bot-error") {
              return (
                <div className="flex items-end gap-2" key={message.id}>
                  <CatAvatar size={36} />
                  <div
                    className={`max-w-[82%] rounded-[1.5rem] rounded-bl-md px-4 py-3 text-[15px] leading-6 shadow-sm ${
                      message.kind === "bot-error"
                        ? "bg-rose-50 text-rose-600"
                        : "border border-[#F0E6D6] bg-[#FFFDF7] text-[#5C4A32]"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              );
            }

            if (message.kind === "bot-recurring") {
              const { item, status } = message;
              const dirLabel = item.direction === "income" ? "收入" : "支出";
              return (
                <div className="flex items-end gap-2" key={message.id}>
                  <CatAvatar size={36} />
                  <div className="max-w-[88%] rounded-3xl border border-[#F0E6D6] bg-[#FFFDF7] p-3.5 shadow-sm">
                    <p className="text-[15px] leading-6 text-[#5C4A32]">
                      {message.replyText}
                    </p>
                    <div className="mt-3 rounded-2xl bg-[#FFF6D9] p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#F4E8D1] px-1.5 py-0.5 text-[10px] font-semibold text-[#B37233]">
                          🔄 周期
                        </span>
                        <p className="truncate text-sm font-extrabold text-[#4A3E3D]">
                          {item.title}
                        </p>
                      </div>
                      <p
                        className={`mt-1.5 text-sm font-semibold ${
                          item.direction === "income"
                            ? "text-[#2A9D8F]"
                            : "text-[#8C6D53]"
                        }`}
                      >
                        {item.direction === "income" ? "+" : ""}
                        {formatHKD(item.amount)} · {dirLabel}
                      </p>
                      <p className="mt-1 text-xs text-[#A08875]">
                        {periodLabel(item)}
                        {item.end_date ? ` · 至 ${item.end_date}` : ""}
                      </p>
                    </div>

                    {status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          className="h-10 flex-1 rounded-xl border border-[#E8D5B5] bg-white text-sm font-semibold text-[#8C6D53] transition-all active:scale-95 disabled:opacity-50"
                          disabled={actionBusy}
                          onClick={() => openCustomRecurring(message.id)}
                          type="button"
                        >
                          ✏️ 自定义
                        </button>
                        <button
                          className="h-10 flex-1 rounded-xl bg-[#EE7828] text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          disabled={actionBusy}
                          onClick={() => void confirmRecurring(message.id)}
                          type="button"
                        >
                          ✓ 确认存入
                        </button>
                      </div>
                    ) : status === "confirmed" ? (
                      <p className="mt-3 text-xs font-semibold text-[#2A9D8F]">
                        🟢 已存入规划
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3" key={message.id}>
                {message.replyText ? (
                  <div className="flex items-end gap-2">
                    <CatAvatar size={36} />
                    <div className="max-w-[82%] rounded-[1.5rem] rounded-bl-md border border-[#F0E6D6] bg-[#FFFDF7] px-4 py-3 text-[15px] leading-6 text-[#5C4A32] shadow-sm">
                      {message.replyText}
                    </div>
                  </div>
                ) : null}
                {message.records.map((record, index) => {
                  const typeLabel =
                    record.type === "EXPENSE" ? "支出" : "收入";
                  return (
                    <div
                      className="flex items-end gap-2"
                      key={`${message.id}-${index}`}
                    >
                      <CatAvatar size={36} />
                      <div className="max-w-[88%] rounded-3xl border border-[#F0E6D6] bg-[#FFFDF7] p-3.5 shadow-sm">
                        <p className="text-[15px] leading-6 text-[#5C4A32]">
                          {record.status === "pending"
                            ? `识别到一笔${record.category}${typeLabel}：${record.amount} 元`
                            : `已记录一笔${record.category}${typeLabel}：${record.amount} 元${
                                record.recordedAt
                                  ? `，${record.recordedAt}`
                                  : ""
                              }`}
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
                                {cleanNote(record.note) || record.category}
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
                        </div>

                        {record.status === "pending" ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              className="h-10 flex-1 rounded-xl border border-[#E8D5B5] bg-white text-sm font-semibold text-[#8C6D53] transition-all active:scale-95 disabled:opacity-50"
                              disabled={actionBusy}
                              onClick={() =>
                                openCustomTransaction(message.id, index)
                              }
                              type="button"
                            >
                              ✏️ 自定义
                            </button>
                            <button
                              className="h-10 flex-1 rounded-xl bg-[#EE7828] text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                              disabled={actionBusy}
                              onClick={() =>
                                void confirmTransaction(message.id, index)
                              }
                              type="button"
                            >
                              ✓ 确认存入
                            </button>
                          </div>
                        ) : record.status === "confirmed" ? (
                          <p className="mt-3 text-xs font-semibold text-[#2A9D8F]">
                            🟢 已存入账单
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {busy && (
            <div className="flex items-end gap-2">
              <CatAvatar size={36} thinking />
              <div className="rounded-[1.5rem] rounded-bl-md border border-[#F0E6D6] bg-[#FFFDF7] px-4 py-3 text-sm text-[#9A7B55] shadow-sm">
                小猫正在思考中…
              </div>
            </div>
          )}
        </div>

        <div className="z-30 shrink-0 border-t border-[#EFE5D3]/80 bg-[#FAF6EC] px-0 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
          <div className="mb-2 flex gap-2 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_CHIPS.map((chip) => (
              <button
                className="shrink-0 rounded-full border border-[#EFE5D3] bg-white px-3.5 py-1.5 text-sm font-medium text-[#6B5A40] shadow-sm transition-all active:scale-95"
                key={chip.label}
                onClick={() => handleChip(chip)}
                type="button"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form
            className="mx-4 flex items-center gap-2 rounded-[1.75rem] border border-[#EFE5D3] bg-white px-2 py-1.5 shadow-sm"
            onSubmit={onSubmit}
          >
            <button
              aria-label="语音输入"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FFF3E0] text-[#B37233] transition-all active:scale-95"
              onClick={() =>
                toast.message("语音记账即将开放，先打字跟小猫说吧")
              }
              type="button"
            >
              <Mic className="size-5" />
            </button>
            <input
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-[#5C4A32] outline-none placeholder:text-[#C0B49A]"
              disabled={busy || !historyReady}
              onChange={(event) => setInput(event.target.value)}
              placeholder="像聊天一样记一笔..."
              ref={inputRef}
              value={input}
            />
            <button
              aria-label="发送"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EE7828] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
              disabled={busy || !historyReady || !input.trim()}
              type="submit"
            >
              <SendHorizontal className="size-5" />
            </button>
          </form>
        </div>
      </main>

      <TransactionDialog
        busy={actionBusy}
        onChange={setTxDraft}
        onClose={() => {
          if (actionBusy) return;
          setTxDialogOpen(false);
          setTxEditTarget(null);
        }}
        onSubmit={saveCustomTransaction}
        open={txDialogOpen}
        submitLabel="确认存入"
        title="自定义账单"
        value={txDraft}
      />

      <RecurringEditorSheet
        form={recurringForm}
        isNew
        onFormChange={setRecurringForm}
        onOpenChange={(open) => {
          if (!open && !actionBusy) {
            setRecurringOpen(false);
            setRecurringEditId(null);
          }
        }}
        onSubmit={saveCustomRecurring}
        open={recurringOpen}
      />
    </>
  );
}
