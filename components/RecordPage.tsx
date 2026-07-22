"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bus,
  ChartColumn,
  CheckCircle2,
  Coffee,
  Mic,
  Pencil,
  RefreshCw,
  SendHorizontal,
  Star,
  Utensils,
} from "lucide-react";
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
import {
  findTransactionByMsgMarker,
  insertTransactionDraft,
  syncDueRecurringItems,
} from "@/lib/recurring-sync";
import {
  WORKDAYS,
  createRecurringItem,
  readRecurringItems,
  writeRecurringItems,
  type WeekdayCode,
} from "@/lib/planner";
import {
  categoryLabel,
  formatMoney,
  localDateString,
  prepareDraft,
} from "@/lib/transaction-utils";
import { normalizeCurrency, readDefaultCurrency } from "@/lib/currency";
import type {
  ParseApiResponse,
  ParsedRecurringData,
  ParsedTransaction,
  Transaction,
  TransactionDraft,
} from "@/lib/types";
import { chatMsgMarker, cleanNote } from "@/lib/utils";
import { useI18n } from "@/components/LocaleProvider";
import type { MessageKey, TranslateFn } from "@/lib/i18n";

type ChatMessage = UiChatMessage;

const QUICK_CHIPS: {
  labelKey: MessageKey;
  mode: "fill" | "nav";
  valueKey?: MessageKey;
  value?: string;
  Icon: LucideIcon;
}[] = [
  { labelKey: "record.chip.coffee", mode: "fill", valueKey: "record.chipValue.coffee", Icon: Coffee },
  {
    labelKey: "record.chip.lunch",
    mode: "fill",
    valueKey: "record.chipValue.lunch",
    Icon: Utensils,
  },
  {
    labelKey: "record.chip.commute",
    mode: "fill",
    valueKey: "record.chipValue.commute",
    Icon: Bus,
  },
  { labelKey: "record.chip.viewMonth", mode: "nav", value: "/charts", Icon: ChartColumn },
];

function greetingByHour(hour: number, t: TranslateFn) {
  if (hour < 11) return t("record.greeting.morning");
  if (hour < 14) return t("record.greeting.noon");
  if (hour < 18) return t("record.greeting.afternoon");
  return t("record.greeting.evening");
}

function formatClock(locale: string, date = new Date()) {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatHeaderDate(locale: string, date = new Date()) {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function toDbRow(
  item: ParsedTransaction | TransactionDraft,
  msgMarker?: string,
) {
  const prepared = prepareDraft({
    amount: item.amount,
    type: item.type,
    category: item.category,
    date: item.date,
    note: item.note,
    currency: normalizeCurrency(
      "currency" in item ? item.currency : readDefaultCurrency(),
    ),
  });
  if (!msgMarker) return prepared;
  const note = prepared.note?.includes(msgMarker)
    ? prepared.note
    : `${prepared.note || ""} ${msgMarker}`.trim();
  return { ...prepared, note };
}

function createWelcomeMessage(t: TranslateFn): ChatMessage {
  return {
    id: "welcome",
    kind: "bot-text",
    text: t("record.welcome", { greeting: greetingByHour(new Date().getHours(), t) }),
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
    emoji: data.direction === "income" ? "banknote" : "bus",
  };
}

function periodLabel(item: ParsedRecurringData, t: TranslateFn) {
  if (item.period_type === "daily") return t("record.period.daily");
  if (item.period_type === "weekly") return t("record.period.weekly");
  return t("record.period.monthly", { day: item.day_of_month ?? "" });
}

export function RecordPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
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
      currency: readDefaultCurrency(),
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
        const defaultCurrency = readDefaultCurrency();
        const { queryTransactions } = await import("@/lib/transactions-query");
        const rows = await queryTransactions({
          eqDate: today,
          type: "EXPENSE",
        });
        const sum = rows
          .filter((row) => normalizeCurrency(row.currency) === defaultCurrency)
          .reduce((acc, row) => acc + Number(row.amount), 0);
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
        setMessages(history.length > 0 ? history : [createWelcomeMessage(t)]);
      } catch {
        setMessages([createWelcomeMessage(t)]);
        toast.message(t("toast.chatNotSynced"));
      } finally {
        setHistoryReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [t]);

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const headerDate = useMemo(() => formatHeaderDate(locale), [locale]);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    if (!navigator.onLine) {
      toast.error(t("record.offlineParse"));
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
          defaultCurrency: readDefaultCurrency(),
          locale,
          history: toParseHistory([...prior, userSaved]),
        }),
      });
      const payload = (await response.json()) as ParseApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? t("toast.parseFail") : payload.message,
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

      const recordedAt = formatClock(locale);
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
      toast.error(t("toast.saveOffline"));
      return;
    }
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.kind !== "bot-records") return;
    const record = msg.records[recordIndex];
    if (!record || record.status !== "pending") return;

    setActionBusy(true);
    try {
      const marker = chatMsgMarker(messageId, recordIndex);
      const existing = await findTransactionByMsgMarker(marker);
      const row = toDbRow(record, marker);
      let txId = existing?.id ?? record.id;

      if (!existing) {
        const created = await insertTransactionDraft(row);
        txId = created.id;
      }

      const nextRecords = msg.records.map((r, i) =>
        i === recordIndex
          ? {
              ...r,
              ...row,
              id: txId,
              status: "confirmed" as const,
              recordedAt: formatClock(locale),
            }
          : r,
      );

      await syncBotRecordsCloud(messageId, nextRecords, msg.replyText);

      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "bot-records" && m.id === messageId
            ? { ...m, records: nextRecords }
            : m,
        ),
      );
      if (row.type === "EXPENSE" && !existing) {
        setTodaySpend((prev) => prev + Number(row.amount));
      }
      toast.success(t("toast.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.saveFail"),
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
      const item = persistAiRecurringItem(msg.item, messageId);
      if (item.autoWrite !== false) {
        await syncDueRecurringItems([item]);
      }
      await syncBotRecurringCloud(
        messageId,
        msg.item,
        msg.replyText,
        "confirmed",
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "bot-recurring" && m.id === messageId
            ? { ...m, status: "confirmed" as const }
            : m,
        ),
      );
      toast.success(t("toast.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.savePlannerFail"),
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
      currency: normalizeCurrency(
        record.currency ?? readDefaultCurrency(),
      ),
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
      toast.error(t("toast.saveOffline"));
      return;
    }
    setActionBusy(true);
    try {
      const { messageId, recordIndex } = txEditTarget;
      const marker = chatMsgMarker(messageId, recordIndex);
      const existing = await findTransactionByMsgMarker(marker);
      const row = toDbRow(txDraft, marker);
      let txId = existing?.id;

      if (!existing) {
        const created = await insertTransactionDraft(row);
        txId = created.id;
      }

      const msg = messages.find((m) => m.id === messageId);
      const nextRecords =
        msg && msg.kind === "bot-records"
          ? msg.records.map((r, i) =>
              i === recordIndex
                ? {
                    ...r,
                    ...row,
                    comment: r.comment,
                    id: txId,
                    status: "confirmed" as const,
                    recordedAt: formatClock(locale),
                  }
                : r,
            )
          : [];

      if (msg && msg.kind === "bot-records") {
        await syncBotRecordsCloud(messageId, nextRecords, msg.replyText);
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== "bot-records" || m.id !== messageId) return m;
          return { ...m, records: nextRecords };
        }),
      );
      if (row.type === "EXPENSE" && !existing) {
        setTodaySpend((prev) => prev + Number(row.amount));
      }
      setTxDialogOpen(false);
      setTxEditTarget(null);
      toast.success(t("toast.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.saveFail"),
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
      toast.error(t("toast.needName"));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("toast.needAmount"));
      return;
    }
    if (
      recurringForm.kind === "by_days" &&
      recurringForm.byDays.length === 0
    ) {
      toast.error(t("toast.needWeekday"));
      return;
    }

    setActionBusy(true);
    try {
      const dayOfMonth = Math.min(
        31,
        Math.max(1, Number(recurringForm.dayOfMonth) || 1),
      );
      const nextDate = computeFormNextDate(recurringForm);
      const existing = readRecurringItems().find(
        (i) => i.sourceMessageId === recurringEditId,
      );
      const item =
        existing ??
        createRecurringItem({
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
          startDate: localDateString(),
          sourceMessageId: recurringEditId,
        });

      if (!existing) {
        writeRecurringItems([item, ...readRecurringItems()]);
      } else {
        const patched = {
          ...existing,
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
        };
        writeRecurringItems(
          readRecurringItems().map((i) =>
            i.id === existing.id ? patched : i,
          ),
        );
      }

      const saved =
        readRecurringItems().find((i) => i.sourceMessageId === recurringEditId) ??
        item;

      if (saved.autoWrite !== false) {
        await syncDueRecurringItems([saved]);
      }

      const updatedItem: ParsedRecurringData = {
        title: saved.name,
        amount: saved.amount,
        direction: saved.direction,
        category: saved.category ?? "其它支出",
        currency: normalizeCurrency(saved.currency ?? readDefaultCurrency()),
        period_type:
          saved.recurrence.kind === "monthly" ? "monthly" : "weekly",
        by_days:
          saved.recurrence.kind === "by_days"
            ? (saved.recurrence.by_days ?? []).map((code) => {
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
        day_of_month: saved.recurrence.dayOfMonth,
        start_date: saved.startDate ?? localDateString(),
        end_date: saved.recurrence.end_date ?? undefined,
        auto_record: saved.autoWrite !== false,
      };

      const prevMsg = messages.find((m) => m.id === recurringEditId);
      await syncBotRecurringCloud(
        recurringEditId,
        updatedItem,
        prevMsg && prevMsg.kind === "bot-recurring"
          ? prevMsg.replyText
          : t("record.updatedRule"),
        "confirmed",
      );

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
      setRecurringOpen(false);
      setRecurringEditId(null);
      toast.success(t("toast.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("toast.savePlannerFail"),
      );
    } finally {
      setActionBusy(false);
    }
  }

  function handleChip(chip: (typeof QUICK_CHIPS)[number]) {
    if (chip.mode === "nav") {
      router.push(chip.value ?? "/");
      return;
    }
    setInput(chip.valueKey ? t(chip.valueKey) : (chip.value ?? ""));
    inputRef.current?.focus();
  }

  return (
    <>
      <main className="relative flex h-full min-h-0 flex-col bg-[#FAF6EC]">
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-[#EFE5D3] bg-[#FAF6EC] px-5 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div>
            <p className="text-sm font-medium text-[#8A7A5C]">{headerDate}</p>
            <p className="mt-0.5 text-base font-semibold text-[#5C4A32]">
              {t("record.todaySpend")}{" "}
              <span className="text-[#E07A3D]">
                {formatMoney(todaySpend, readDefaultCurrency())}
              </span>
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
                {t("record.loadingHistory")}
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
              const dirLabel =
                item.direction === "income" ? t("common.income") : t("common.expense");
              return (
                <div className="flex items-end gap-2" key={message.id}>
                  <CatAvatar size={36} />
                  <div className="max-w-[88%] rounded-3xl border border-[#F0E6D6] bg-[#FFFDF7] p-3.5 shadow-sm">
                    <p className="text-[15px] leading-6 text-[#5C4A32]">
                      {message.replyText}
                    </p>
                    <div className="mt-3 rounded-2xl bg-[#FFF6D9] p-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F4E8D1] px-1.5 py-0.5 text-[10px] font-semibold text-[#B37233]">
                          <RefreshCw className="size-2.5" strokeWidth={2.5} />
                          {t("record.badge.period")}
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
                        {formatMoney(
                          item.amount,
                          item.currency ?? readDefaultCurrency(),
                        )}{" "}
                        · {dirLabel}
                      </p>
                      <p className="mt-1 text-xs text-[#A08875]">
                        {periodLabel(item, t)}
                        {item.end_date ? t("record.untilDate", { date: item.end_date }) : ""}
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
                          <span className="inline-flex items-center justify-center gap-1">
                            <Pencil className="size-3.5" strokeWidth={2.25} />
                            {t("record.custom")}
                          </span>
                        </button>
                        <button
                          className="h-10 flex-1 rounded-xl bg-[#EE7828] text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          disabled={actionBusy}
                          onClick={() => void confirmRecurring(message.id)}
                          type="button"
                        >
                          ✓ {actionBusy ? t("record.processing") : t("record.confirmSave")}
                        </button>
                      </div>
                    ) : status === "confirmed" ? (
                      <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2A9D8F]">
                        <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                        {t("record.savedToPlanner")}
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
                    record.type === "EXPENSE" ? t("common.expense") : t("common.income");
                  return (
                    <div
                      className="flex items-end gap-2"
                      key={`${message.id}-${index}`}
                    >
                      <CatAvatar size={36} />
                      <div className="max-w-[88%] rounded-3xl border border-[#F0E6D6] bg-[#FFFDF7] p-3.5 shadow-sm">
                        <p className="text-[15px] leading-6 text-[#5C4A32]">
                          {record.status === "pending"
                            ? t("record.detected", {
                                category: categoryLabel(record.category, t),
                                type: typeLabel,
                                amount: formatMoney(
                                  record.amount,
                                  record.currency ?? readDefaultCurrency(),
                                ),
                              })
                            : t("record.recorded", {
                                category: categoryLabel(record.category, t),
                                type: typeLabel,
                                amount: formatMoney(
                                  record.amount,
                                  record.currency ?? readDefaultCurrency(),
                                ),
                                time: record.recordedAt ? `, ${record.recordedAt}` : "",
                              })}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-[#9A7B55]">
                          {record.comment}
                        </p>

                        <div className="mt-3 rounded-2xl bg-[#FFF6D9] p-3">
                          <div className="flex items-center gap-3">
                            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F8C96A] text-[#8A5A12] shadow-sm">
                              {record.category === "其它支出" ||
                              record.category === "其它" ? (
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
                                {categoryLabel(record.category, t)}
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
                              {formatMoney(
                                record.amount,
                                record.currency ?? readDefaultCurrency(),
                              )}
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
                              <span className="inline-flex items-center justify-center gap-1">
                                <Pencil className="size-3.5" strokeWidth={2.25} />
                                {t("record.custom")}
                              </span>
                            </button>
                            <button
                              className="h-10 flex-1 rounded-xl bg-[#EE7828] text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                              disabled={actionBusy}
                              onClick={() =>
                                void confirmTransaction(message.id, index)
                              }
                              type="button"
                            >
                              ✓ {actionBusy ? t("record.processing") : t("record.confirmSave")}
                            </button>
                          </div>
                        ) : record.status === "confirmed" ? (
                          <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2A9D8F]">
                            <CheckCircle2
                              className="size-3.5"
                              strokeWidth={2.5}
                            />
                            {t("record.savedToLedger")}
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
                {t("record.thinking")}
              </div>
            </div>
          )}
        </div>

        <div className="z-30 shrink-0 border-t border-[#EFE5D3]/80 bg-[#FAF6EC] px-0 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
          <div className="mb-2 flex gap-2 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_CHIPS.map((chip) => {
              const Icon = chip.Icon;
              return (
                <button
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#EFE5D3] bg-white px-3.5 py-1.5 text-sm font-medium text-[#6B5A40] shadow-sm transition-all active:scale-95"
                  key={chip.labelKey}
                  onClick={() => handleChip(chip)}
                  type="button"
                >
                  <Icon className="size-3.5 text-[#B37233]" strokeWidth={2.25} />
                  {t(chip.labelKey)}
                </button>
              );
            })}
          </div>

          <form
            className="mx-4 flex items-center gap-2 rounded-[1.75rem] border border-[#EFE5D3] bg-white px-2 py-1.5 shadow-sm"
            onSubmit={onSubmit}
          >
            <button
              aria-label={t("record.aria.voice")}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FFF3E0] text-[#B37233] transition-all active:scale-95"
              onClick={() =>
                toast.message(t("toast.voiceSoon"))
              }
              type="button"
            >
              <Mic className="size-5" />
            </button>
            <input
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-[#5C4A32] outline-none placeholder:text-[#C0B49A]"
              disabled={busy || !historyReady}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("record.inputPlaceholder")}
              ref={inputRef}
              value={input}
            />
            <button
              aria-label={t("record.aria.send")}
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
        submitLabel={t("record.confirmSave")}
        title={t("record.customDialogTitle")}
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
