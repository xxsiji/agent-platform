import { NextResponse } from "next/server";

// Node 运行时：实际处理消息、调 DeepSeek、发飞书回复
export const runtime = "nodejs";
export const maxDuration = 30;

// 同一实例内的消息去重，避免飞书重试导致重复回复
const seen = new Set<string>();

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
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 1. token 校验（在飞书后台开启了 Verification Token 校验时填 FEISHU_VERIFICATION_TOKEN）
  const expectedToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (expectedToken && body.header?.token && body.header.token !== expectedToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 2. 只关心消息接收事件
  if (body.header?.event_type !== "im.message.receive_v1") {
    return NextResponse.json({ ok: true });
  }

  const message = body.event?.message;
  const messageId = message?.message_id;
  const chatId = message?.chat_id;
  const senderOpenId = body.event?.sender?.sender_id?.open_id;

  if (!messageId || !chatId) {
    return NextResponse.json({ ok: true });
  }

  // 3. 去重
  if (seen.has(messageId)) {
    return NextResponse.json({ ok: true });
  }
  seen.add(messageId);

  // 4. 不回复机器人自己
  const botOpenId = process.env.FEISHU_BOT_OPEN_ID;
  if (botOpenId && senderOpenId === botOpenId) {
    return NextResponse.json({ ok: true });
  }

  // 5. 提取文本（去掉 @提及 标记）
  const text = extractText(message?.content);

  // 6. 后台异步处理并回复。函数立即返回 ACK，避免飞书等待。
  handleMessage(chatId, text).catch((err) => {
    console.error("[feishu-bot] 处理消息失败:", err);
  });

  return NextResponse.json({ ok: true });
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

/** 调 Agent 平台回答并回写飞书 */
async function handleMessage(chatId: string, query: string) {
  if (!query) return;

  const { generateText } = await import("ai");
  const { deepseek } = await import("@/lib/ai/deepseek");

  let systemPrompt: string | undefined;
  let model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  let temperature = 0.7;
  let topP = 1;
  let maxTokens = 2000;

  const slug = process.env.FEISHU_AGENT_SLUG;
  if (slug) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const { buildSystemPromptWithRag } = await import("@/lib/rag/prompt");
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

  const reply = result.text.trim() || "（模型没有返回内容）";

  const { sendTextMessage } = await import("@/lib/feishu/client");
  await sendTextMessage(chatId, reply);
}
