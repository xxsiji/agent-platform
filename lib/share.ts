import { randomBytes } from "crypto";

/**
 * 生成唯一的分享 slug。
 *
 * 用 crypto.randomBytes 生成 8 位 base62 字符串(大小写字母+数字)，
 * 短到能手动输入，长到碰撞概率可忽略(62^8 ≈ 218 万亿)。
 *
 * @param checkUnique - 可选的异步函数，检查 slug 是否已被占用
 * @returns 唯一的 slug 字符串
 */
export async function generateShareSlug(
  checkUnique?: (slug: string) => Promise<boolean>
): Promise<string> {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = randomBytes(8);
    let slug = "";
    for (let i = 0; i < 8; i++) {
      slug += charset[bytes[i] % 62];
    }

    if (!checkUnique) return slug;
    const isUnique = await checkUnique(slug);
    if (isUnique) return slug;
  }

  // 10 次都碰撞了(几乎不可能)，加长到 12 位再试一次
  const bytes = randomBytes(12);
  const charset12 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 12; i++) {
    slug += charset12[bytes[i] % 62];
  }
  return slug;
}
