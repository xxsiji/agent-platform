"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Loader2, Square, Bot } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 公开聊天界面(访客态)。
 *
 * 跟 dashboard 的 Chat 组件区别：
 * 1. 不需要登录——任何人都能用
 * 2. api 指向 /api/public/agents/[slug]/chat
 * 3. 不传 threadId/agentId——访客对话不持久化
 * 4. 不加载历史消息——每次打开都是全新对话
 *
 * AI SDK 7 的 useChat 用法：
 * - 用 DefaultChatTransport 配置 api 地址
 * - 不返回 input/handleSubmit，要自己 useState 管理输入
 * - sendMessage({ text: '...' }) 发消息
 * - message.parts 数组里取文本(不是 message.content)
 */
interface PublicChatProps {
  slug: string;
  agentName: string;
}

export function PublicChat({ slug, agentName }: PublicChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 配置 transport：指向公开对话 API
  const transport = new DefaultChatTransport({
    api: `/api/public/agents/${slug}/chat`,
  });

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status !== "ready") return;
    sendMessage({ text });
    setInput("");
  }

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* 欢迎消息 */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-medium">
                  你好，我是 {agentName}
                </p>
                <p className="text-sm text-muted-foreground">
                  在下方输入消息，开始和我对话吧
                </p>
              </div>
            </div>
          )}

          {/* 消息渲染 */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* 头像 */}
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {message.role === "user" ? "我" : <Bot className="size-4" />}
              </div>

              {/* 消息内容 */}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {/* AI SDK 7: 消息内容在 parts 数组里 */}
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {/* 加载指示器：首字返回前显示「思考中…」占位 */}
          {status === "submitted" && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bot className="size-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                <span className="ml-1">思考中…</span>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-center text-sm text-destructive">
              回复生成失败，请重试
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 */}
      <div className="border-t bg-background px-4 py-4">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            disabled={isLoading}
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={stop}
              title="停止生成"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()}>
              <Send className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
