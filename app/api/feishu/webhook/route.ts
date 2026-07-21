import { NextResponse } from "next/server";
import { generateText } from "ai";

import { prisma } from "@/lib/prisma";
import { deepseek } from "@/lib/ai/deepseek";
import { buildSystemPromptWithRag } from "@/lib/rag/prompt";
import { sendTextMessage } from "@/lib/feishu/client";

// Vercel 函数最长运行时间（Hobby 套餐上限 10s，Pro 可更长）。飞书要求回调快速返回，
// 这里把 AI 调用放在请求内同步完成，整体一般 < 5s。
export const maxDuration = 30;

// 同一实例内的消息去重，避免飞书重试导致重复回复
const seen = new Set<string>();

/**
 * 飞书事件回调（Webhook）
 *
 * 飞书会向该地址 POST 两类请求：
 *   1. url_verification —— 配置回调地址时的握手，需要原样返回 challenge
 *   2. im.message.receive_v1 —— 收到消息事件，我们提取文本 → 调 Agent 平台 → 回复
 *
 * 部署后把这个路由的完整 URL 填到飞书「事件订阅 → 请求地址」。
 */

interface FeishuEventPayload {
  type?: string;
  challenge?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: {
    message?: {
      message_id?: string;
      chat_id?: string;
      content?: string; // JSON 字符串 {"text":"..."}
      mentions?: { key: string; id?: { open_id?: string } }[];
    };
    sender?: {
      sender_id?: { open_id?: string };
    };
  };
}

export async function POST(request: Request) {
  let body: FeishuEventPayload;
  try {
    body = (await request.json()) as FeishuEventPayload;
  } catch {
    return NextResponse.json({ code: -1 }, { status: 400 });
  }

  // 1. 握手验证
  if (body.type === "url_verification" && body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 2. token 校验（在飞书后台开启了「 Verification Token 校验」时填 FEISHU_VERIFICATION_TOKEN）
  const expectedToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (expectedToken && body.header?.token && body.header.token !== expectedToken) {
    return NextResponse.json({ code: -1 }, { status: 401 });
  }

  // 3. 只关心消息接收事件，其余直接 ACK
  if (body.header?.event_type !== "im.message.receive_v1") {
    return NextResponse.json({ code: 0 });
  }

  const message = body.event?.message;
  const messageId = message?.message_id;
  const chatId = message?.chat_id;
  const senderOpenId = body.event?.sender?.sender_id?.open_id;

  if (!messageId || !chatId) {
    return NextResponse.json({ code: 0 });
  }

  // 4. 去重
  if (seen.has(messageId)) {
    return NextResponse.json({ code: 0 });
  }
  seen.add(messageId);

  // 5. 不回复机器人自己
  const botOpenId = process.env.FEISHU_BOT_OPEN_ID;
  if (botOpenId && senderOpenId === botOpenId) {
    return NextResponse.json({ code: 0 });
  }

  // 6. 提取文本（去掉 @提及 标记）
  const text = extractText(message?.content);

  // 7. 同步处理并回复（整体 < 5s，飞书不会重试）
  try {
    const reply = await answer(text);
    await sendTextMessage(chatId, reply);
  } catch (err) {
    console.error("[feishu-bot] 处理消息失败:", err);
    // 即使失败也 ACK 200，避免飞书无限重试
  }

  return NextResponse.json({ code: 0 });
}

/** 从飞书消息 content（JSON 字符串）里取出纯文本，并去掉 @提及 */
function extractText(content?: string): string {
  if (!content) return "";
  try {
    const obj = JSON.parse(content) as { text?: string };
    return (obj.text || "").replace(/@_user_\d+/g, "").trim();
  } catch {
    return "";
  }
}

/**
 * 调 Agent 平台回答用户问题：
 *  - 若配置了 FEISHU_AGENT_SLUG 且对应 Agent 已公开，则复用其 systemPrompt + RAG 知识库
 *  - 否则用默认 system prompt 直接走 DeepSeek
 */
async function answer(query: string): Promise<string> {
  if (!query) return "（没收到文本内容）";

  let systemPrompt: string | undefined;
  let model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  let temperature = 0.7;
  let topP = 1;
  let maxTokens = 2000;

  const slug = process.env.FEISHU_AGENT_SLUG;
  if (slug) {
    try {
      const agent = await prisma.agent.findUnique({ where: { shareSlug: slug } });
      if (agent && agent.visibility === "PUBLIC" && !agent.deletedAt) {
        systemPrompt = await buildSystemPromptWithRag(
          agent.id,
          agent.systemPrompt,
          query,
          agent.enableKnowledge
        );
        model = agent.model;
        temperature = agent.temperature;
        topP = agent.topP;
        maxTokens = agent.maxTokens;
      }
    } catch (e) {
      console.error("[feishu-bot] 读取 Agent / RAG 失败，回退默认 prompt:", e);
    }
  }

  if (!systemPrompt) {
    systemPrompt =
      "你是飞书里的 AI 助手，由用户的 Agent 智能体平台驱动。用简体中文、简洁有条理地回答用户问题。";
  }

  const result = await generateText({
    model: deepseek.chat(model),
    system: systemPrompt,
    prompt: query,
    temperature,
    topP,
    maxOutputTokens: maxTokens,
  });

  return result.text.trim() || "（模型没有返回内容）";
}
