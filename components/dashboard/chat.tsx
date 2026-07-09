"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, User, Send, Square, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * 聊天界面(客户端组件)。
 *
 * 用 AI SDK 7 的 useChat 管理聊天状态：
 * - messages: 消息列表(UIMessage[])，流式时自动更新
 * - sendMessage: 发送新消息
 * - status: 'ready' | 'submitted' | 'streaming' | 'error'
 * - stop: 中断正在进行的流式生成
 *
 * AI SDK 7 的变化：
 * - 不再有内置的 input/handleSubmit，要自己用 useState 管理输入框
 * - 消息内容在 message.parts 数组里(不是 message.content 字符串)
 * - 用 DefaultChatTransport 配置 API 地址和额外参数
 *
 * 渲染逻辑：
 * - 遍历 messages，从 parts 里提取文本渲染
 * - status 为 submitted/streaming 时显示加载动画
 * - 自动滚动到底部
 */
export function Chat({
  agentId,
  threadId,
  agentName,
  systemPrompt,
  initialMessages,
}: {
  agentId: string;
  threadId: string;
  agentName: string;
  systemPrompt: string | null;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 创建 transport(用 useState 保持稳定，避免每次渲染都重建)
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { agentId, threadId },
      })
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
    messages: initialMessages,
  });

  const isGenerating = status === "submitted" || status === "streaming";

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // 从 UIMessage 的 parts 里提取纯文本
  function getMessageText(message: UIMessage): string {
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    // AI SDK 7：用 sendMessage 发送，传入 { text: string }
    sendMessage({ text: input.trim() });
    setInput("");
  }

  // 按 Enter 发送，Shift+Enter 换行
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto rounded-xl border bg-background">
        <div className="flex flex-col gap-4 p-4">
          {/* 欢迎消息(没有历史消息时) */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  欢迎使用「{agentName}」
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {systemPrompt
                    ? "输入消息开始对话吧"
                    : "这个 Agent 还没有设置系统提示词，建议先去配置页设置人设"}
                </p>
              </div>
            </div>
          )}

          {/* 消息渲染 */}
          {messages.map((message) => {
            const isUser = message.role === "user";
            const text = getMessageText(message);
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* 头像 */}
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                {/* 消息气泡 */}
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm sm:max-w-[80%] ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {text || (isGenerating ? "正在思考..." : "")}
                </div>
              </div>
            );
          })}

          {/* 流式生成中的加载指示器(消息列表末尾) */}
          {isGenerating && messages.length > 0 && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bot className="size-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {status === "submitted" ? "思考中…" : "正在回复..."}
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
              回复生成失败，请重试
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows={1}
          className="min-h-[44px] max-h-32 min-w-0 flex-1 resize-none"
          disabled={isGenerating}
        />
        {isGenerating ? (
          <Button
            type="button"
            onClick={stop}
            variant="outline"
            className="shrink-0"
          >
            <Square className="size-4" />
            停止
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0"
          >
            <Send className="size-4" />
            发送
          </Button>
        )}
      </form>
    </div>
  );
}
