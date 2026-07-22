/**
 * 飞书机器人 Webhook（Node Runtime）
 *
 * 处理流程：
 *   1. url_verification 握手 → 立即返回 challenge
 *   2. im.message.receive_v1 文本消息 → 解析后【立即返回 200 (ack)】，重型处理放后台异步跑
 *      - 后台：查 Agent/RAG → 调 DeepSeek → 主动调飞书发消息 API 推回群
 *      - 满足飞书 3 秒响应要求，不会因 LLM 慢而触发重试刷屏
 *
 * 关键设计：fire-and-forget（不 await 重活，先 ack）
 *   - 飞书要求 3 秒内收到 200，否则同一条消息重试 3 次 → 群刷多条
 *   - 现在 webhook 毫秒级返回 200，杜绝重试；回复走"主动发消息 API"推回，与接收解耦
 *
 * 注意（Serverless  caveat）：Vercel 在响应返回后可能冻结函数，低流量 demo 可接受。
 * 生产建议用 @vercel/functions 的 waitUntil 或任务队列（Inngest / Upstash QStash）
 * 保证后台任务一定跑完。
 */
export const runtime = "nodejs";
export const maxDuration = 30;

import { sendTextMessage } from "@/lib/feishu/client";
import { generateText } from "ai";
import { deepseek } from "@/lib/ai/deepseek";
import { prisma } from "@/lib/prisma";
import { buildSystemPromptWithRag } from "@/lib/rag/prompt";

interface FeishuEventPayload {
  type?: string;
  challenge?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: {
    message?: {
      chat_type?: "group" | "p2p";
      message_type?: string;
      content?: string;
      chat_id?: string;
      root_id?: string;
      message_id?: string;
    };
    sender?: {
      sender_id?: {
        open_id?: string;
        user_id?: string;
        union_id?: string;
      };
      sender_type?: string;
    };
  };
}

/**
 * 重型处理：抽成独立函数，POST 里不 await（fire-and-forget）
 * 飞书收到 200 后，这里在后台跑：RAG 检索 + 调 DeepSeek + 主动回群
 */
async function handleFeishuMessage(data: { cleanText: string; chatId: string }) {
  const { cleanText, chatId } = data;
  try {
    // 构造 system prompt：
    //  - 配了 FEISHU_AGENT_SLUG → 查平台公开 Agent，走 RAG 知识库（有知识库则检索注入）
    //  - 没配 / Agent 不存在 / Supabase 挂了 → 降级到默认 prompt，机器人仍能答通用问题
    let systemPrompt =
      "你是一个简洁、专业的 AI 助手。回答控制在 300 字以内，除非用户要求详细说明。";
    let modelId = "deepseek-chat";
    const slug = process.env.FEISHU_AGENT_SLUG;
    if (slug) {
      try {
        const agent = await prisma.agent.findUnique({
          where: { shareSlug: slug },
        });
        if (agent && agent.visibility === "PUBLIC" && !agent.deletedAt) {
          systemPrompt = await buildSystemPromptWithRag(
            agent.id,
            agent.systemPrompt,
            cleanText,
            agent.enableKnowledge
          );
          if (agent.model) modelId = agent.model;
        }
      } catch (ragErr) {
        console.error("[feishu] RAG lookup failed, fallback default:", ragErr);
      }
    }

    const { text: reply } = await generateText({
      model: deepseek.chat(modelId),
      system: systemPrompt || undefined,
      messages: [{ role: "user", content: cleanText }],
      temperature: 0.7,
    });
    console.log("[feishu] deepseek reply:", reply.slice(0, 200));

    await sendTextMessage(chatId, reply, "chat_id");
    console.log("[feishu] reply sent to chat:", chatId);
  } catch (err) {
    console.error("[feishu] handle message failed:", err);
    // 出错也尝试给用户一个提示，方便定位
    try {
      await sendTextMessage(
        chatId,
        "（机器人处理出错了，请稍后再试）",
        "chat_id"
      );
    } catch (e) {
      console.error("[feishu] send error notice failed:", e);
    }
  }
}

export async function POST(request: Request) {
  let body: FeishuEventPayload;
  try {
    body = (await request.json()) as FeishuEventPayload;
  } catch {
    console.error("[feishu] invalid json body");
    return Response.json({ code: -1, msg: "invalid json" }, { status: 400 });
  }

  console.log("[feishu] incoming:", JSON.stringify(body).slice(0, 800));

  // 1. 飞书握手验证（必须同步立即返回）
  if (body.type === "url_verification" && body.challenge) {
    console.log("[feishu] url_verification challenge:", body.challenge);
    return Response.json({ challenge: body.challenge });
  }

  const eventType = body.header?.event_type;
  const event = body.event;
  console.log("[feishu] event_type:", eventType, "msg_type:", event?.message?.message_type);

  // 2. 只处理文本消息
  if (eventType === "im.message.receive_v1" && event?.message?.message_type === "text") {
    const msg = event.message;
    const botOpenId = process.env.FEISHU_BOT_OPEN_ID;
    const senderOpenId = event.sender?.sender_id?.open_id;

    // 不回复机器人自己
    if (senderOpenId && senderOpenId === botOpenId) {
      console.log("[feishu] skip self message");
      return Response.json({ code: 0 });
    }

    const chatId = msg.chat_id;
    if (!chatId) {
      console.log("[feishu] no chat_id, skip");
      return Response.json({ code: 0 });
    }

    let rawText = "";
    try {
      rawText = JSON.parse(msg.content || "{}").text || "";
    } catch {
      rawText = "";
    }
    const cleanText = rawText.replace(/@\S+/g, "").trim() || "你好";
    console.log("[feishu] user text:", cleanText, "chatId:", chatId);

    // ★ 关键改动：fire-and-forget，不 await 重型处理
    // 立即把任务丢到后台，webhook 毫秒级返回 200（ack），杜绝飞书 3 秒超时重试
    handleFeishuMessage({ cleanText, chatId }).catch((err) =>
      console.error("[feishu] background task error:", err)
    );
  }

  // 立即返回 200（ack），不等 LLM 跑完
  return Response.json({ code: 0 });
}
