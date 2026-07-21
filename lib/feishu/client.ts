/**
 * 飞书开放平台客户端（最小可用封装）
 *
 * 只做两件事：
 *   1. getTenantAccessToken —— 用 app_id/app_secret 换租户凭证（带缓存，避免每次都请求）
 *   2. sendTextMessage      —— 往某个会话（群/单聊）发一条文本消息
 *
 * 飞书 API 基础地址：https://open.feishu.cn/open-apis
 * 文档：https://open.feishu.cn/document/server-docs/im-v1
 */

const FEISHU_BASE = "https://open.feishu.cn/open-apis";

// 模块级缓存，同一 serverless 实例内复用，避免重复换 token
let tokenCache: { token: string; exp: number } | null = null;

/** 获取 tenant_access_token（企业内部应用） */
export async function getTenantAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.exp > now + 60_000) {
    return tokenCache.token;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET，无法获取飞书凭证");
  }

  const res = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = (await res.json()) as {
    code: number;
    msg: string;
    tenant_access_token?: string;
    expire?: number;
  };

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`飞书获取 tenant_access_token 失败: ${data.code} ${data.msg}`);
  }

  tokenCache = {
    token: data.tenant_access_token,
    exp: now + (data.expire ?? 7200) * 1000,
  };
  return tokenCache.token;
}

/**
 * 发送文本消息
 * @param chatId 会话 ID（群 ID 或 单聊 open_id，取决于 receiveIdType）
 * @param text   文本内容
 * @param receiveIdType 默认 chat_id（群）
 */
export async function sendTextMessage(
  chatId: string,
  text: string,
  receiveIdType: "chat_id" | "open_id" = "chat_id"
): Promise<void> {
  const token = await getTenantAccessToken();

  const res = await fetch(
    `${FEISHU_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: "text",
        // content 必须是 JSON 字符串：{"text":"..."}
        content: JSON.stringify({ text }),
      }),
    }
  );

  const data = (await res.json()) as { code: number; msg: string };
  if (data.code !== 0) {
    throw new Error(`飞书发送消息失败: ${data.code} ${data.msg}`);
  }
}
