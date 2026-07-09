import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

/**
 * 硅基流动 (SiliconFlow) Embedding Provider —— RAG 知识库的向量化封装。
 *
 * 硅基流动的 Embedding API 兼容 OpenAI 格式，所以复用了 @ai-sdk/openai 的
 * createOpenAI，只是把 baseURL 指向硅基流动的服务器。
 *
 * 默认模型：BAAI/bge-large-zh-v1.5，输出 1024 维向量。
 *
 * 环境变量：
 *   EMBEDDING_API_KEY   — 硅基流动 API 密钥
 *   EMBEDDING_BASE_URL  — 接口地址(默认 https://api.siliconflow.cn/v1)
 *   EMBEDDING_MODEL     — 向量化模型(默认 BAAI/bge-large-zh-v1.5)
 *
 * 用法：
 *   const vec = await embedText("你好世界");        // number[]，长度 1024
 *   const vecs = await embedBatch(["a", "b", "c"]); // number[][]
 */

// 创建硅基流动 provider（OpenAI 兼容）
const siliconflow = createOpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL || "https://api.siliconflow.cn/v1",
  apiKey: process.env.EMBEDDING_API_KEY!,
});

// 拿到 embedding 模型句柄。模型名从环境变量读，缺省用 bge-large-zh-v1.5。
const embeddingModel = siliconflow.embedding(
  process.env.EMBEDDING_MODEL || "BAAI/bge-large-zh-v1.5"
);

/**
 * 单条文本向量化。
 * @param text 待向量化的文本
 * @returns 1024 维浮点数数组
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

/**
 * 批量向量化（文档切片后一次性处理，省请求数、提速）。
 * @param texts 文本数组
 * @returns 二维数组，每个元素是与输入一一对应的向量
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
