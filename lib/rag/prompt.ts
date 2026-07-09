import { prisma } from "@/lib/prisma";
import { searchKnowledge } from "./retrieval";
import { buildRagContext } from "./context";

/**
 * 构造「带 RAG 知识的 system prompt」。
 *
 * 这是两个对话路由（登录态 / 免登录公开态）共用的逻辑：
 * 1. 如果知识库开关关闭（enableKnowledge=false），直接返回原始 systemPrompt（不检索）
 * 2. 如果用户问题为空，直接返回原始 systemPrompt（不检索）
 * 3. 如果 Agent 没有知识库（KnowledgeBase 记录不存在），返回原始 systemPrompt
 * 4. 否则检索相关切片，拼到原始 systemPrompt 后面一起注入
 *
 * 这样没有知识库的 Agent 对话行为和以前完全一致，不影响性能。
 *
 * @param agentId          智能体 ID
 * @param baseSystemPrompt Agent 原始 system prompt（可能为 null）
 * @param userQuery        用户最后一条消息的文本（只拿最后一句做检索 query）
 * @param enableKnowledge  知识库开关（false 时不走 RAG，即使有文档也不检索）
 */
export async function buildSystemPromptWithRag(
  agentId: string,
  baseSystemPrompt: string | null,
  userQuery: string,
  enableKnowledge: boolean = true
): Promise<string> {
  // 知识库开关关闭 → 不检索，原样返回（即使上传了文档也不检索）
  if (!enableKnowledge) {
    return baseSystemPrompt || "";
  }

  // 没有用户问题 → 不检索，原样返回
  if (!userQuery.trim()) {
    return baseSystemPrompt || "";
  }

  // 没有知识库 → 不检索，原样返回（保持以前的行为）
  const kb = await prisma.knowledgeBase.findFirst({ where: { agentId } });
  if (!kb) {
    return baseSystemPrompt || "";
  }

  // 有知识库 → 检索 + 拼接
  const chunks = await searchKnowledge(agentId, userQuery, 5);
  const ragContext = buildRagContext(chunks);

  if (!ragContext) {
    return baseSystemPrompt || "";
  }

  return baseSystemPrompt
    ? `${baseSystemPrompt}\n\n${ragContext}`
    : ragContext;
}
