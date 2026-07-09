"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Reply, Trash2, Send, Loader2, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";

/**
 * 评论区组件（客户端组件）
 *
 * 功能：
 * - 评论列表：顶级评论 + 嵌套回复
 * - 发表评论：输入框，500 字限制
 * - 回复：点"回复"展开输入框，保存时 parentId=被回复评论的 id
 * - 点赞：toggle，乐观更新
 * - 删除：软删除，显示"该评论已删除"
 * - 分页："加载更多"按钮
 *
 * 权限：浏览免登录，互动需登录（未登录跳 /login）
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------
interface CommentUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface CommentItem {
  id: string;
  content: string;
  likeCount: number;
  deletedAt: string | null;
  createdAt: string;
  userId: string;
  parentId: string | null;
  user: CommentUser;
  replies?: CommentItem[];
  /** 乐观更新标记：true 表示本地临时评论，尚未被服务端确认 */
  pending?: boolean;
}

interface CommentSectionProps {
  agentId: string;
  isAuthenticated: boolean;
  /** 当前用户已点赞的评论 ID 列表（SSR 传入，避免闪烁） */
  likedCommentIds: string[];
  currentUserId: string | null;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
export function CommentSection({
  agentId,
  isAuthenticated,
  likedCommentIds,
  currentUserId,
}: CommentSectionProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // 新评论输入
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 已点赞的评论 ID 集合
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set(likedCommentIds));

  // 加载评论列表
  const loadComments = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await fetch(
          `/api/agents/${agentId}/comments?page=${pageNum}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();

        // 服务端数据不含 pending（临时评论仅本地存在）；过滤以防万一，
        // 并在整页刷新时保留尚未确认的本地点评，避免被覆盖丢失。
        const incoming = (data.comments as CommentItem[]).filter(
          (c) => !c.pending
        );

        if (append) {
          setComments((prev) => [...prev, ...incoming]);
        } else {
          setComments((prev) => {
            const pending = prev.filter((c) => c.pending);
            return [...pending, ...incoming];
          });
        }
        setTotalPages(data.pagination.totalPages);
      } catch {
        // 加载失败提示用户
        toast("评论加载失败，请重试");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [agentId, toast]
  );

  useEffect(() => {
    loadComments(1, false);
  }, [loadComments]);

  // 发表评论（乐观更新：先本地出现，再等后端确认）
  async function handleSubmit() {
    const trimmed = newComment.trim();
    if (!trimmed || submitting) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // 乐观更新：fetch 之前先用临时 id 插入一条 pending 评论，立即显示在列表最前
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: CommentItem = {
      id: tempId,
      content: trimmed,
      likeCount: 0,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      userId: currentUserId ?? "",
      parentId: null,
      user: { id: currentUserId ?? "", name: "我", avatarUrl: null },
      pending: true,
    };
    setComments((prev) => [optimisticComment, ...prev]);
    setNewComment("");

    // submitting 仅作极短防连点锁，不阻塞评论显示（评论已即时出现）
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      // 用真实评论（真实 id + 真实 user + 服务端时间）替换临时评论
      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId ? { ...(data.comment as CommentItem), pending: false } : c
        )
      );
    } catch {
      // 失败：移除该临时评论，恢复输入方便重试，并提示
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setNewComment(trimmed);
      toast("评论发送失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  // 加载更多
  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    loadComments(nextPage, true);
  }

  return (
    <div className="flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 px-4 py-3">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">评论</h3>
        <span className="text-xs text-muted-foreground">
          ({comments.length > 0 ? "已加载" : "还没有评论"})
        </span>
      </div>

      {/* 评论输入框 */}
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
            placeholder={isAuthenticated ? "写下你的评论..." : "登录后可评论"}
            disabled={!isAuthenticated}
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting || !isAuthenticated}
            className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {newComment.length}/500
        </div>
      </div>

      {/* 评论列表 */}
      <div className="px-4 pb-4">
        {loading ? (
          /* 加载中：3 条骨架评论行 */
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">还没有评论，来抢沙发</p>
            <p className="mt-1 text-xs text-muted-foreground">写下第一条评论，开启讨论吧</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                agentId={agentId}
                isAuthenticated={isAuthenticated}
                currentUserId={currentUserId}
                likedSet={likedSet}
                setLikedSet={setLikedSet}
                onReplyCreated={(reply) => {
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === comment.id
                        ? { ...c, replies: [...(c.replies || []), reply] }
                        : c
                    )
                  );
                }}
                onReplyConfirmed={(tempId, realComment) => {
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === comment.id
                        ? {
                            ...c,
                            replies: (c.replies || []).map((r) =>
                              r.id === tempId
                                ? { ...realComment, pending: false }
                                : r
                            ),
                          }
                        : c
                    )
                  );
                }}
                onReplyRemoved={(tempId) => {
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === comment.id
                        ? {
                            ...c,
                            replies: (c.replies || []).filter(
                              (r) => r.id !== tempId
                            ),
                          }
                        : c
                    )
                  );
                }}
                onDeleted={(commentId) => {
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === commentId
                        ? { ...c, deletedAt: new Date().toISOString() }
                        : {
                            ...c,
                            replies: c.replies?.map((r) =>
                              r.id === commentId
                                ? { ...r, deletedAt: new Date().toISOString() }
                                : r
                            ),
                          }
                    )
                  );
                }}
              />
            ))}
          </div>
        )}

        {/* 加载更多 */}
        {page < totalPages && !loading && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loadingMore && <Loader2 className="size-4 animate-spin" />}
              {loadingMore ? "加载中..." : "加载更多"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 单条评论组件
// ---------------------------------------------------------------------------
interface CommentRowProps {
  comment: CommentItem;
  agentId: string;
  isAuthenticated: boolean;
  currentUserId: string | null;
  likedSet: Set<string>;
  setLikedSet: React.Dispatch<React.SetStateAction<Set<string>>>;
  onReplyCreated: (reply: CommentItem) => void;
  onReplyConfirmed: (tempId: string, realComment: CommentItem) => void;
  onReplyRemoved: (tempId: string) => void;
  onDeleted: (commentId: string) => void;
}

function CommentRow({
  comment,
  agentId,
  isAuthenticated,
  currentUserId,
  likedSet,
  setLikedSet,
  onReplyCreated,
  onReplyConfirmed,
  onReplyRemoved,
  onDeleted,
}: CommentRowProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likeCount);

  const isLiked = likedSet.has(comment.id);
  const isDeleted = !!comment.deletedAt;
  const isOwner = currentUserId === comment.userId;

  // 点赞
  async function handleLike() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // 乐观更新
    const newLiked = !isLiked;
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (newLiked) next.add(comment.id);
      else next.delete(comment.id);
      return next;
    });
    setLikeCount((c) => c + (newLiked ? 1 : -1));

    try {
      const res = await fetch(
        `/api/agents/${agentId}/comments/${comment.id}/like`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLikeCount(data.likeCount);
    } catch {
      // 回滚
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (newLiked) next.delete(comment.id);
        else next.add(comment.id);
        return next;
      });
      setLikeCount((c) => c + (newLiked ? -1 : 1));
      toast("点赞失败，请重试");
    }
  }

  // 回复（乐观更新：先本地插入，再等后端确认）
  async function handleReply() {
    const trimmed = replyText.trim();
    if (!trimmed || replying) return;

    // 乐观更新：fetch 之前先用临时 id 构造一条 pending 回复，插入到本评论的 replies
    const tempId = `temp-${Date.now()}`;
    const optimisticReply: CommentItem = {
      id: tempId,
      content: trimmed,
      likeCount: 0,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      userId: currentUserId ?? "",
      parentId: comment.id,
      user: { id: currentUserId ?? "", name: "我", avatarUrl: null },
      pending: true,
    };
    onReplyCreated(optimisticReply);
    setReplyText("");
    setShowReplyInput(false);

    // replying 仅作极短防连点锁
    setReplying(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, parentId: comment.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      // 用真实回复替换临时回复
      onReplyConfirmed(tempId, data.comment as CommentItem);
    } catch {
      // 失败：从对应评论的 replies 中移除该临时回复，恢复输入框，并提示
      onReplyRemoved(tempId);
      setReplyText(trimmed);
      setShowReplyInput(true);
      toast("回复失败，请重试");
    } finally {
      setReplying(false);
    }
  }

  // 删除
  async function handleDelete() {
    if (!isAuthenticated || !isOwner) return;

    try {
      const res = await fetch(
        `/api/agents/${agentId}/comments/${comment.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      onDeleted(comment.id);
    } catch {
      // 删除失败提示用户
      toast("删除失败，请重试");
    }
  }

  // 格式化时间
  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    return date.toLocaleDateString("zh-CN");
  }

  return (
    <div className={cn(comment.pending && "opacity-60")}>
      {/* 顶级评论 */}
      <div className="flex gap-3">
        {/* 头像 */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {comment.user.name?.[0] || "?"}
        </div>

        <div className="min-w-0 flex-1">
          {/* 用户名 + 时间 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {comment.user.name || "匿名用户"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(comment.createdAt)}
            </span>
            {comment.pending && (
              <span className="text-xs text-muted-foreground">· 发送中</span>
            )}
          </div>

          {/* 内容 */}
          {isDeleted ? (
            <p className="mt-1 text-sm italic text-muted-foreground">
              该评论已删除
            </p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {comment.content}
            </p>
          )}

          {/* 操作按钮（已删除或 pending 的评论不显示操作） */}
          {!isDeleted && !comment.pending && (
            <div className="mt-2 flex items-center gap-4">
              {/* 点赞 */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Heart
                  className={cn(
                    "size-3.5 transition-colors",
                    isLiked && "fill-red-500 text-red-500"
                  )}
                />
                <span className={isLiked ? "text-red-500" : ""}>
                  {likeCount > 0 ? likeCount : "点赞"}
                </span>
              </button>

              {/* 回复（只有顶级评论才能被回复） */}
              {comment.parentId === null && (
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      router.push("/login");
                      return;
                    }
                    setShowReplyInput((s) => !s);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Reply className="size-3.5" />
                  回复
                </button>
              )}

              {/* 删除（只有自己的评论才能删） */}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-red-500"
                >
                  <Trash2 className="size-3.5" />
                  删除
                </button>
              )}
            </div>
          )}

          {/* 回复输入框 */}
          {showReplyInput && (
            <div className="mt-2 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                placeholder={`回复 ${comment.user.name || "匿名用户"}...`}
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || replying}
                className="flex min-h-[44px] shrink-0 items-center rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {replying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </button>
            </div>
          )}

          {/* 回复列表 */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 pl-3 sm:pl-4">
              {comment.replies.map((reply) => (
                <ReplyRow
                  key={reply.id}
                  reply={reply}
                  agentId={agentId}
                  isAuthenticated={isAuthenticated}
                  currentUserId={currentUserId}
                  likedSet={likedSet}
                  setLikedSet={setLikedSet}
                  onDeleted={onDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 回复组件（跟评论组件类似，但不能再被回复）
// ---------------------------------------------------------------------------
interface ReplyRowProps {
  reply: CommentItem;
  agentId: string;
  isAuthenticated: boolean;
  currentUserId: string | null;
  likedSet: Set<string>;
  setLikedSet: React.Dispatch<React.SetStateAction<Set<string>>>;
  onDeleted: (commentId: string) => void;
}

function ReplyRow({
  reply,
  agentId,
  isAuthenticated,
  currentUserId,
  likedSet,
  setLikedSet,
  onDeleted,
}: ReplyRowProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [likeCount, setLikeCount] = useState(reply.likeCount);

  const isLiked = likedSet.has(reply.id);
  const isDeleted = !!reply.deletedAt;
  const isOwner = currentUserId === reply.userId;

  async function handleLike() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const newLiked = !isLiked;
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (newLiked) next.add(reply.id);
      else next.delete(reply.id);
      return next;
    });
    setLikeCount((c) => c + (newLiked ? 1 : -1));

    try {
      const res = await fetch(
        `/api/agents/${agentId}/comments/${reply.id}/like`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLikeCount(data.likeCount);
    } catch {
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (newLiked) next.delete(reply.id);
        else next.add(reply.id);
        return next;
      });
      setLikeCount((c) => c + (newLiked ? -1 : 1));
      toast("点赞失败，请重试");
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(
        `/api/agents/${agentId}/comments/${reply.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      onDeleted(reply.id);
    } catch {
      // 删除失败提示用户
      toast("删除失败，请重试");
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    return date.toLocaleDateString("zh-CN");
  }

  return (
    <div className={cn(reply.pending && "opacity-60", "flex gap-2")}>
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
        {reply.user.name?.[0] || "?"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {reply.user.name || "匿名用户"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(reply.createdAt)}
          </span>
          {reply.pending && (
            <span className="text-xs text-muted-foreground">· 发送中</span>
          )}
        </div>

        {isDeleted ? (
          <p className="mt-0.5 text-xs italic text-muted-foreground">
            该评论已删除
          </p>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
            {reply.content}
          </p>
        )}

        {!isDeleted && !reply.pending && (
          <div className="mt-1 flex items-center gap-4">
            <button
              onClick={handleLike}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Heart
                className={cn(
                  "size-3 transition-colors",
                  isLiked && "fill-red-500 text-red-500"
                )}
              />
              <span className={isLiked ? "text-red-500" : ""}>
                {likeCount > 0 ? likeCount : "赞"}
              </span>
            </button>

            {isOwner && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-red-500"
              >
                <Trash2 className="size-3" />
                删除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
