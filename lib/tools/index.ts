import { tool, type ToolSet } from "ai";
import { z } from "zod";

/**
 * Agent 工具注册表。
 *
 * 提供两类工具：
 * - calculator：四则运算求值，安全实现（shunting-yard），开箱即用。
 * - web_search：联网搜索（Brave Search API），依赖环境变量 BRAVE_API_KEY。
 *
 * resolveTools() 根据「用户勾选的工具」+「当前环境能力」解析出最终注册给
 * 模型的一组工具，未勾选 / 环境不支持的会被静默忽略（不报错）。
 */

/**
 * 安全的四则运算求值。
 *
 * 采用 shunting-yard 算法：中缀表达式 → 逆波兰式(RPN) → 求值。
 * 只接受数字与 `+ - * / ( ) ^ %` 及空白，禁止任何函数调用 / 变量引用，
 * 从根本上杜绝 prompt 注入执行任意代码（绝不使用 eval / new Function）。
 *
 * 返回结果字符串；非法 / 除零等异常返回错误说明字符串（让模型自我纠正，
 * 不抛异常中断对话流）。
 */

// 仅允许数字与运算符 / 括号 / 空白，其余一律拒绝
const ILLEGAL_CHAR = /[^0-9+\-*/().\s^%]/;

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

const PRECEDENCE: Record<string, number> = {
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
  "%": 3,
  "^": 4,
};
// 右结合运算符（^）：同级时栈顶不弹出
const RIGHT_ASSOC: Record<string, boolean> = { "^": true };

function tokenize(input: string): Token[] | { error: string } {
  const tokens: Token[] = [];
  let i = 0;
  // prevType 用于判断一元负号
  let prevType: "start" | "num" | "op" | "lparen" | "rparen" = "start";

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // 数字（支持小数，不支持科学计数法以控制复杂度）
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let numStr = "";
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i];
        i++;
      }
      const num = Number(numStr);
      if (!isFinite(num)) return { error: `非法数字：${numStr}` };
      tokens.push({ type: "num", value: num });
      prevType = "num";
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen" });
      prevType = "lparen";
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      prevType = "rparen";
      i++;
      continue;
    }

    // 运算符
    if ("+-*/^%".includes(ch)) {
      // 一元负号：前一个 token 没有操作数（表达式开头 / 运算符后 / 左括号后）
      if (
        ch === "-" &&
        (prevType === "start" || prevType === "op" || prevType === "lparen")
      ) {
        tokens.push({ type: "num", value: 0 });
        tokens.push({ type: "op", value: "-" });
      } else {
        tokens.push({ type: "op", value: ch });
      }
      prevType = "op";
      i++;
      continue;
    }

    return { error: `非法字符：${ch}` };
  }

  return tokens;
}

function toRPN(tokens: Token[]): Token[] | { error: string } {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokens) {
    if (token.type === "num") {
      output.push(token);
    } else if (token.type === "lparen") {
      stack.push(token);
    } else if (token.type === "rparen") {
      while (stack.length && stack[stack.length - 1].type !== "lparen") {
        output.push(stack.pop()!);
      }
      if (!stack.length) return { error: "括号不匹配" };
      stack.pop(); // 弹出左括号
    } else if (token.type === "op") {
      const o1 = token.value;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "op") break;
        const o2 = (top as Extract<Token, { type: "op" }>).value;
        const p1 = PRECEDENCE[o1];
        const p2 = PRECEDENCE[o2];
        if (
          (RIGHT_ASSOC[o1] && p1 < p2) ||
          (!RIGHT_ASSOC[o1] && p1 <= p2)
        ) {
          output.push(stack.pop()!);
        } else {
          break;
        }
      }
      stack.push(token);
    }
  }

  while (stack.length) {
    const top = stack.pop()!;
    if (top.type === "lparen") return { error: "括号不匹配" };
    output.push(top);
  }

  return output;
}

function evalRPN(rpn: Token[]): number | { error: string } {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token.type === "num") {
      stack.push(token.value);
      continue;
    }
    // op
    if (token.type !== "op") return { error: "表达式无效" };
    if (stack.length < 2) return { error: "表达式不完整" };
    const b = stack.pop()!;
    const a = stack.pop()!;
    let r: number;
    switch (token.value) {
      case "+":
        r = a + b;
        break;
      case "-":
        r = a - b;
        break;
      case "*":
        r = a * b;
        break;
      case "/":
        if (b === 0) return { error: "除数不能为 0" };
        r = a / b;
        break;
      case "%":
        if (b === 0) return { error: "除数不能为 0" };
        r = a % b;
        break;
      case "^":
        r = Math.pow(a, b);
        break;
      default:
        return { error: `未知运算符：${token.value}` };
    }
    if (!isFinite(r)) return { error: "计算结果溢出" };
    stack.push(r);
  }
  if (stack.length !== 1) return { error: "表达式无效" };
  return stack[0];
}

export function safeEval(expression: string): string {
  const trimmed = (expression ?? "").trim();
  if (!trimmed) return "计算错误：表达式为空";
  if (ILLEGAL_CHAR.test(trimmed)) {
    return "计算错误：包含不允许的字符（仅支持数字与 + - * / ( ) ^ %）";
  }

  const tokens = tokenize(trimmed);
  if ("error" in tokens) return `计算错误：${tokens.error}`;

  const rpn = toRPN(tokens);
  if ("error" in rpn) return `计算错误：${rpn.error}`;

  const result = evalRPN(rpn);
  if (typeof result === "object") return `计算错误：${result.error}`;

  // 控制浮点精度，避免 0.1 + 0.2 显示 0.30000000000000004
  const rounded = Math.round(result * 1e10) / 1e10;
  return String(rounded);
}

// ---- calculator 工具（始终可用）----
const calculatorTool = tool({
  description:
    "对数学表达式求值并返回结果。支持加减乘除、括号、幂(^)、取模(%)。仅接受纯数字与运算符，不能调用任何函数。结果为数值。",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("要计算的数学表达式，例如 '123 * 456' 或 '(1+2)^3 - 4/2'"),
  }),
  execute: async ({ expression }) => {
    return safeEval(expression);
  },
});

// ---- web_search 工具（依赖 BRAVE_API_KEY）----
const webSearchTool = tool({
  description:
    "联网搜索，返回与查询最相关的前 5 条网页结果的标题、链接与摘要。用于回答需要实时或最新信息的问题（如新闻、股价、天气等）。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词或问题"),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      return "联网搜索当前不可用（未配置搜索服务）。";
    }
    try {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", "5");
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
        cache: "no-store", // 保证时效性，不缓存
      });
      if (!res.ok) {
        return `联网搜索失败（HTTP ${res.status}）。`;
      }
      const data = await res.json();
      const results: Array<{ title?: string; url?: string; description?: string }> =
        data?.web?.results ?? [];
      if (results.length === 0) return "未找到相关搜索结果。";
      const text = results
        .slice(0, 5)
        .map(
          (r, i) =>
            `${i + 1}. ${r.title ?? ""}\n${r.url ?? ""}\n${r.description ?? ""}`
        )
        .join("\n\n");
      return text;
    } catch {
      return "联网搜索出错，请稍后重试。";
    }
  },
});

export type ResolvedTools = {
  tools: ToolSet;
  hasTools: boolean;
};

/**
 * 根据用户勾选的工具 + 当前环境能力，解析出最终注册给模型的一组工具。
 *
 * 规则：
 * - calculator：用户勾选即加入（永远可用，无外部依赖）。
 * - web_search：仅在「用户勾选」且「BRAVE_API_KEY 存在」时加入；否则静默忽略。
 *
 * @param agentTools 来自 agent.tools 字段，应为 string[]（如 ["web_search","calculator"]）；非法/空 → []
 * @param env 运行时环境变量（传入 process.env）
 */
export function resolveTools(
  agentTools: unknown,
  env: Record<string, string | undefined>
): ResolvedTools {
  const selected = Array.isArray(agentTools)
    ? (agentTools as string[])
    : [];

  const tools: ToolSet = {};

  if (selected.includes("calculator")) {
    tools.calculator = calculatorTool;
  }
  if (selected.includes("web_search") && env.BRAVE_API_KEY) {
    tools.web_search = webSearchTool;
  }

  return {
    tools,
    hasTools: Object.keys(tools).length > 0,
  };
}
