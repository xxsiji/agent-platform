/**
 * 文本切片模块。
 *
 * RAG 管线的第二环：把一篇长文档切成若干小块（chunk），
 * 每个块单独向量化、单独检索。
 *
 * 设计目标：
 * 1. 尽量在“句子边界”（句号/问号/感叹号/换行）处切，不把一句话从中间劈开；
 * 2. 相邻块之间留 overlap 个字符的重叠，保证跨块上下文的连续性；
 * 3. 太短的小尾巴（< 50 字）合并到上一块，避免产生无意义的碎片。
 */

/**
 * 把长文本切成块。
 *
 * @param text      待切分的纯文本
 * @param chunkSize 每块目标字数（默认 500）
 * @param overlap   相邻块重叠字数（默认 100，必须小于 chunkSize）
 * @returns         切片后的字符串数组
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 100
): string[] {
  // 规范空白：CRLF → LF，压缩多余空格，去首尾空白
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!clean) return [];

  // 按句子边界切分（保留分隔符，方便拼接回原样）
  const segments = clean.split(/(?<=[。！？!?\n])/);

  const chunks: string[] = [];
  let buf = "";

  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;

    // 单句超长（比如一大段没标点的英文/代码）→ 退化为按字符硬切，同样带 overlap
    if (seg.length > chunkSize) {
      if (buf) {
        chunks.push(buf);
        buf = "";
      }
      const step = Math.max(1, chunkSize - overlap);
      for (let i = 0; i < seg.length; i += step) {
        chunks.push(seg.slice(i, i + chunkSize));
      }
      continue;
    }

    // 常规：能塞进当前块就拼接，否则先收尾、下一块从重叠处起头
    if (buf.length + seg.length <= chunkSize) {
      buf += seg;
    } else {
      chunks.push(buf);
      buf = buf.slice(-overlap) + seg;
    }
  }
  if (buf) chunks.push(buf);

  // 最后一块太短（< 50 字）就合并进前一块
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 50) {
    chunks[chunks.length - 2] += chunks.pop()!;
  }

  return chunks;
}
