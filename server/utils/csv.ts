// 轻量 CSV 解析 / 序列化（无第三方依赖，兼容引号/逗号/换行/BOM）
// 解析：首行为表头，返回 { headers, rows }
// 序列化：给定表头与二维数据，返回带 BOM 的 CSV 文本

/** 解析 CSV 文本 → { headers, rows } */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!text) return { headers: [], rows: [] }
  // 去除 UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\r') {
        // 忽略，等待 \n 结束行
      } else if (c === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else {
        field += c
      }
    }
  }
  // 收尾最后一段（文件可能不以换行结尾）
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // 过滤全空行
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!nonEmpty.length) return { headers: [], rows: [] }

  const headers = nonEmpty[0].map((h) => h.trim())
  const data = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
  return { headers, rows: data }
}

/** 将值转义为 CSV 单元格 */
function escapeCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** 序列化二维数据为 CSV（首行表头，带 BOM 便于 Excel 识别 UTF-8） */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const r of rows) lines.push(r.map(escapeCell).join(','))
  return '﻿' + lines.join('\r\n')
}
