/**
 * 飞书多维表自动化 Webhook（Node Runtime）
 *
 * 作用：飞书多维表「调用网页（webhook）」动作会 POST 到这里。
 * 典型场景：某条记录状态改成"成交" → 自动触发本接口 →
 *   1. 用 DeepSeek 基于记录字段生成跟进话术
 *   2. 把话术【回写】到多维表指定字段（完整闭环，AI 结果落进业务表）
 *   3. 可选：给负责人发飞书私信提醒
 *
 * 设计要点（与机器人 webhook 一致）：
 *   - 立即返回 200（ack），重型处理 fire-and-forget 放后台，避免飞书超时重试。
 *   - 本地调试加 ?sync=1 可改为同步执行，方便 curl 看完整结果。
 *   - 用 ?secret= 做最小鉴权，防公网被乱调。
 *
 * 飞书自动化动作里填的 URL 约定：
 *   https://你的域名/api/feishu/base-automation?secret=xxx
 *     &appToken=表app_token&tableId=tblxxx&resultField=AI话术
 *     &triggerField=状态&triggerValue=成交&notifyField=负责人
 */
export const runtime = "nodejs";
export const maxDuration = 30;

import { sendTextMessage, updateBitableRecord } from "@/lib/feishu/client";
import { generateText } from "ai";
import { deepseek } from "@/lib/ai/deepseek";

interface BasePayload {
  // 飞书自动化 POST 出来的字段，键名以你表里的为准（中文亦可）
  fields?: Record<string, unknown>;
  data?: { fields?: Record<string, unknown>; recordId?: string };
  recordId?: string;
  record_id?: string;
}

function extractFields(body: BasePayload): Record<string, unknown> {
  return body.fields ?? body.data?.fields ?? {};
}

function extractRecordId(body: BasePayload): string | undefined {
  return body.recordId ?? body.data?.recordId ?? body.record_id;
}

/**
 * 后台重活：触发判断 → 生成话术 → 回写多维表 → 可选发提醒
 */
async function handleAutomation(params: {
  fields: Record<string, unknown>;
  recordId?: string;
  appToken?: string;
  tableId?: string;
  resultField: string;
  triggerField?: string;
  triggerValue?: string;
  notifyField?: string;
  sync: boolean;
}): Promise<void> {
  const {
    fields,
    recordId,
    appToken,
    tableId,
    resultField,
    triggerField,
    triggerValue,
    notifyField,
    sync,
  } = params;

  try {
    // 1) 触发条件判断（只有配置了 triggerField/triggerValue 才判断）
    if (triggerField && triggerValue) {
      const cur = fields[triggerField];
      const matched = Array.isArray(cur)
        ? cur.map(String).includes(triggerValue)
        : String(cur) === triggerValue;
      if (!matched) {
        console.log(
          `[base-automation] 触发字段 ${triggerField}=${String(cur)} 不匹配 ${triggerValue}，跳过`
        );
        return;
      }
    }

    // 2) 用记录里的信息生成话术（取几个常见字段名，取不到就用默认值）
    const customer = String(
      fields["客户名"] ?? fields["客户"] ?? fields["名称"] ?? "客户"
    );
    const prompt =
      `客户「${customer}」的相关记录刚更新，字段如下：\n` +
      JSON.stringify(fields, null, 2) +
      `\n请生成一段 80 字以内、专业且可直接发送的跟进话术。`;

    const { text: draft } = await generateText({
      model: deepseek.chat("deepseek-chat"),
      system: "你是企业销售跟进助手，输出简洁、专业、可直接发送的跟进话术。",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    console.log("[base-automation] generated draft:", draft.slice(0, 200));

    // 3) 回写多维表（闭环关键）：把 AI 话术写回指定字段
    if (appToken && tableId && recordId) {
      await updateBitableRecord(appToken, tableId, recordId, {
        [resultField]: draft,
      });
      console.log(
        `[base-automation] 已回写 ${resultField} 到记录 ${recordId}`
      );
    } else {
      console.log(
        "[base-automation] 缺少 appToken/tableId/recordId，跳过回写（仅生成）"
      );
    }

    // 4) 可选：给负责人发私信（人员字段底层就是 open_id 字符串或数组）
    if (notifyField && fields[notifyField]) {
      const owner = fields[notifyField];
      const openIds = (Array.isArray(owner) ? owner : [owner]).filter(
        (o): o is string => typeof o === "string" && o.startsWith("ou_")
      );
      for (const oid of openIds) {
        await sendTextMessage(
          oid,
          `【跟进提醒】${customer}：${draft}`,
          "open_id"
        );
      }
    }
  } catch (err) {
    console.error("[base-automation] 处理失败:", err);
    if (sync) throw err; // 同步调试模式把错误抛给调用方，方便定位
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.FEISHU_AUTOMATION_SECRET) {
    return Response.json({ code: 401, msg: "unauthorized" }, { status: 401 });
  }

  let body: BasePayload;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: -1, msg: "invalid json" }, { status: 400 });
  }
  console.log("[base-automation] incoming:", JSON.stringify(body).slice(0, 800));

  const fields = extractFields(body);
  const recordId = extractRecordId(body);
  const appToken = url.searchParams.get("appToken") ?? undefined;
  const tableId = url.searchParams.get("tableId") ?? undefined;
  const resultField = url.searchParams.get("resultField") ?? "AI话术";
  const triggerField = url.searchParams.get("triggerField") ?? undefined;
  const triggerValue = url.searchParams.get("triggerValue") ?? undefined;
  const notifyField = url.searchParams.get("notifyField") ?? undefined;
  const sync = url.searchParams.get("sync") === "1";

  const task = () =>
    handleAutomation({
      fields,
      recordId,
      appToken,
      tableId,
      resultField,
      triggerField,
      triggerValue,
      notifyField,
      sync,
    });

  // 立即 ack（除非调试用 sync=1 同步跑）
  if (!sync) {
    task().catch((e) => console.error("[base-automation] bg error:", e));
    return Response.json({ code: 0 });
  }

  await task();
  return Response.json({ code: 0 });
}
