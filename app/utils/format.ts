// 日期格式化工具函数

/**
 * 安全格式化日期（避免 Invalid Date）
 * @param dateStr - 日期字符串或 null/undefined
 * @param options - toLocaleDateString 的选项
 * @returns 格式化后的日期字符串，或 '未知'
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '未知'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '未知'
  return d.toLocaleDateString('zh-CN', options)
}

/**
 * 安全格式化日期时间（避免 Invalid Date）
 * @param dateStr - 日期字符串或 null/undefined
 * @param options - toLocaleString 的选项
 * @returns 格式化后的日期时间字符串，或 '未知'
 */
export function formatTime(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '未知'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '未知'
  return d.toLocaleString('zh-CN', options)
}
