import { generateText } from "ai";
import { deepseek } from "@/lib/ai/deepseek";

/**
 * 查询改写（Query Rewrite）提示词。
 *
 * 作用：把用户口语化、省略主语、带语气词的问题，改写成一条
 * 适合向量检索（embedding 相似度匹配）的简洁标准问题。
 *
 * 为什么要有这一步？embedding 检索靠"问题向量"和"文档切片向量"的
 * 余弦相似度，越近越相关。口语问题（"这玩意儿咋用""公司干啥的"）
 * 和文档里规范表述（"产品使用说明""公司主营业务"）语义距离远，
 * 直接检索容易偏。先改写成标准问法，召回准确率明显提升。
 */
const REWRITE_SYSTEM_PROMPT = `你是一个查询改写器。用户在智能客服 / 知识库问答中提了一个口语化问题。
请把它改写成一条适合向量检索（embedding 相似度匹配）的简洁标准问题。

要求：
1. 保留所有关键实体、专有名词、核心意图
2. 补全被省略的主语 / 宾语（例如"它"指代什么要明确）
3. 去掉寒暄、语气词、与检索无关的修饰
4. 只输出改写后的问题本身，不要解释，不要加引号

示例：
用户："这玩意儿咋用啊"
改写：产品如何使用

用户："你们公司干啥的"
改写：公司的主营业务是什么

用户："昨天那个工单搞定了没"
改写：工单的处理进度与当前状态`;

/**
 * 把用户原始问题改写成检索优化后的问题。
 *
 * - 空输入直接返回空串
 * - 调用 DeepSeek 生成改写结果，temperature 调低保证稳定
 * - 任何失败（网络 / 超时 / 模型异常）都降级返回原始 query，
 *   绝不阻断主对话流程
 *
 * @param userQuery 用户原始问题（口语化）
 * @returns 改写后的检索 query（失败时返回原句）
 */
export async function rewriteQuery(userQuery: string): Promise<string> {
  const trimmed = userQuery.trim();
  if (!trimmed) return trimmed;

  try {
    const { text } = await generateText({
      model: deepseek.chat("deepseek-chat"),
      system: REWRITE_SYSTEM_PROMPT,
      prompt: trimmed,
      temperature: 0.2,
      maxOutputTokens: 100,
    });

    const rewritten = text.trim();
    // 兜底：模型返回空或异常内容时退回原句
    return rewritten || trimmed;
  } catch (err) {
    console.error("[rag] query rewrite failed, fallback to original:", err);
    return trimmed;
  }
}
