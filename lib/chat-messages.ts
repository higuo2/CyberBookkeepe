import { getSupabase } from "@/lib/supabase";
import type { ParsedRecurringData, ParsedTransaction } from "@/lib/types";

export type ChatCardStatus = "pending" | "confirmed" | "cancelled";

export type PendingRecord = ParsedTransaction & {
  id?: string;
  recordedAt?: string;
  status: ChatCardStatus;
};

/** 写入 card_data jsonb 的结构化载荷 */
export type ChatCardData =
  | { kind: "bot-text" }
  | { kind: "bot-error" }
  | {
      kind: "bot-records";
      replyText?: string;
      records: PendingRecord[];
    }
  | {
      kind: "bot-recurring";
      replyText: string;
      item: ParsedRecurringData;
    };

export type ChatMessageRow = {
  id: string;
  user_id: string | null;
  role: "user" | "assistant";
  content: string;
  card_data: ChatCardData | null;
  status: ChatCardStatus | null;
  created_at: string;
};

/** 前端对话消息（与 RecordPage 渲染一致） */
export type UiChatMessage =
  | { id: string; kind: "bot-text"; text: string }
  | { id: string; kind: "user"; text: string }
  | {
      id: string;
      kind: "bot-records";
      records: PendingRecord[];
      replyText?: string;
    }
  | {
      id: string;
      kind: "bot-recurring";
      replyText: string;
      item: ParsedRecurringData;
      status: ChatCardStatus;
    }
  | { id: string; kind: "bot-error"; text: string };

/** 新建消息（无云端 id）— 对联合类型做分布式 Omit */
type OmitId<T> = T extends unknown ? Omit<T, "id"> : never;
export type UiChatMessageDraft = OmitId<UiChatMessage>;

/**
 * 仅在已登录 Supabase Auth 时写入真实 uid。
 * 密码门 / 匿名单机模式返回 null（勿写随机 UUID，否则会撞 auth.users 外键）。
 */
export async function resolveChatUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getUser();
    if (data.user?.id) return data.user.id;
  } catch {
    // no auth session
  }
  return null;
}

export function recordsAggregateStatus(
  records: PendingRecord[],
): ChatCardStatus | null {
  if (records.length === 0) return null;
  if (records.every((r) => r.status === "confirmed")) return "confirmed";
  if (records.every((r) => r.status === "cancelled")) return "cancelled";
  if (records.some((r) => r.status === "pending")) return "pending";
  return "confirmed";
}

export function rowToUiMessage(row: ChatMessageRow): UiChatMessage | null {
  if (row.role === "user") {
    return { id: row.id, kind: "user", text: row.content };
  }

  const card = row.card_data;
  if (!card || card.kind === "bot-text") {
    return { id: row.id, kind: "bot-text", text: row.content };
  }
  if (card.kind === "bot-error") {
    return { id: row.id, kind: "bot-error", text: row.content };
  }
  if (card.kind === "bot-records") {
    return {
      id: row.id,
      kind: "bot-records",
      replyText: card.replyText ?? row.content,
      records: (card.records ?? []).map((r) => ({
        ...r,
        status: r.status ?? "pending",
      })),
    };
  }
  if (card.kind === "bot-recurring") {
    return {
      id: row.id,
      kind: "bot-recurring",
      replyText: card.replyText ?? row.content,
      item: card.item,
      status: row.status ?? "pending",
    };
  }
  return { id: row.id, kind: "bot-text", text: row.content };
}

export function uiMessageToInsert(msg: UiChatMessageDraft): {
  role: "user" | "assistant";
  content: string;
  card_data: ChatCardData | null;
  status: ChatCardStatus | null;
} {
  if (msg.kind === "user") {
    return {
      role: "user",
      content: msg.text,
      card_data: null,
      status: null,
    };
  }
  if (msg.kind === "bot-text") {
    return {
      role: "assistant",
      content: msg.text,
      card_data: { kind: "bot-text" },
      status: null,
    };
  }
  if (msg.kind === "bot-error") {
    return {
      role: "assistant",
      content: msg.text,
      card_data: { kind: "bot-error" },
      status: null,
    };
  }
  if (msg.kind === "bot-records") {
    return {
      role: "assistant",
      content: msg.replyText ?? "",
      card_data: {
        kind: "bot-records",
        replyText: msg.replyText,
        records: msg.records,
      },
      status: recordsAggregateStatus(msg.records),
    };
  }
  return {
    role: "assistant",
    content: msg.replyText,
    card_data: {
      kind: "bot-recurring",
      replyText: msg.replyText,
      item: msg.item,
    },
    status: msg.status,
  };
}

/** 拉取当前用户全部对话（按时间升序） */
export async function fetchChatHistory(): Promise<UiChatMessage[]> {
  const userId = await resolveChatUserId();
  let query = getSupabase()
    .from("chat_messages")
    .select("id, user_id, role, content, card_data, status, created_at")
    .order("created_at", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as ChatMessageRow[];

  return rows
    .map(rowToUiMessage)
    .filter((m): m is UiChatMessage => m !== null);
}

/** 把 Postgrest / 网络错误转成可读文案 */
export function formatChatPersistError(error: unknown): string {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "对话表权限未就绪：请在 Supabase 重新执行 schema.sql 里 chat_messages 修复段";
  }
  if (code === "23503" || /foreign key/i.test(msg)) {
    return "对话表仍绑定 Auth 用户：请执行 schema 修复段，去掉 user_id 外键";
  }
  if (code === "23502" || /null value.*user_id/i.test(msg)) {
    return "对话表 user_id 仍是 NOT NULL：请执行 schema 修复段改为可空";
  }
  if (msg) return msg;
  return "网络异常，请稍后重试";
}

/** 插入一条消息，返回带云端 id 的 UI 消息 */
export async function insertChatMessage(
  msg: UiChatMessageDraft,
): Promise<UiChatMessage> {
  const userId = await resolveChatUserId();
  const payload = uiMessageToInsert(msg);
  const { data, error } = await getSupabase()
    .from("chat_messages")
    .insert({
      user_id: userId,
      role: payload.role,
      content: payload.content,
      card_data: payload.card_data,
      status: payload.status,
    })
    .select("id, user_id, role, content, card_data, status, created_at")
    .single();
  if (error) throw error;
  const ui = rowToUiMessage(data as ChatMessageRow);
  if (!ui) throw new Error("无法解析已保存的消息");
  return ui;
}

/** 同步卡片状态 / card_data（确认存入、自定义后更新） */
export async function updateChatMessage(
  id: string,
  patch: {
    status?: ChatCardStatus | null;
    content?: string;
    card_data?: ChatCardData | null;
  },
): Promise<void> {
  const { error } = await getSupabase()
    .from("chat_messages")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/** 供 AI 上下文的精简历史（最近 N 条） */
export function toParseHistory(
  messages: UiChatMessage[],
  limit = 12,
): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => m.kind === "user" || m.kind === "bot-text" || m.kind === "bot-records" || m.kind === "bot-recurring")
    .slice(-limit)
    .map((m) => {
      if (m.kind === "user") return { role: "user" as const, content: m.text };
      if (m.kind === "bot-text") {
        return { role: "assistant" as const, content: m.text };
      }
      if (m.kind === "bot-records") {
        const summary = m.records
          .map(
            (r) =>
              `${r.type === "EXPENSE" ? "支出" : "收入"} ${r.amount} ${r.category}(${r.status})`,
          )
          .join("；");
        return {
          role: "assistant" as const,
          content: `${m.replyText ?? ""} ${summary}`.trim(),
        };
      }
      return {
        role: "assistant" as const,
        content: `${m.replyText} 【周期】${m.item.title} ${m.item.amount}(${m.status})`,
      };
    });
}
