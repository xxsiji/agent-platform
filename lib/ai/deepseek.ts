import { createOpenAI } from "@ai-sdk/openai";

/**
 * DeepSeek 模型 Provider。
 *
 * DeepSeek 的 API 兼容 OpenAI 接口格式，所以用 @ai-sdk/openai 的 createOpenAI，
 * 只是把 baseURL 指向 DeepSeek 的服务器。
 *
 * 用法：
 *   deepseek.chat("deepseek-chat")       → 通用对话模型
 *   deepseek.chat("deepseek-reasoner")   → 深度推理模型
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY  — API 密钥
 *   DEEPSEEK_BASE_URL — 接口地址(默认 https://api.deepseek.com/v1)
 */
export const deepseek = createOpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY!,
});
