// 通用的数据库 dump / restore（基于 libsql raw client）
// 用于「整机备份」与「按范围备份/恢复」：把每个 db 的所有用户表序列化为 JSON，
// 恢复时清空并重新插入（关闭外键约束，对 schema 差异（多余/缺失列）保持容错）。

/** 列出 db 中的用户表（排除 sqlite 内部表） */
async function listTables(client: any): Promise<string[]> {
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )
  return (res.rows as any[]).map((r) => r.name as string)
}

/** 获取表的列名（按定义顺序） */
async function tableColumns(client: any, table: string): Promise<string[]> {
  const res = await client.execute(`PRAGMA table_info(${table})`)
  return (res.rows as any[]).map((r) => r.name as string)
}

export interface DumpedTable {
  table: string
  columns: string[]
  rows: Record<string, any>[]
}

/** 导出某个 db 的所有表 */
export async function dumpDb(client: any): Promise<DumpedTable[]> {
  const tables = await listTables(client)
  const dumped: DumpedTable[] = []
  for (const t of tables) {
    const cols = await tableColumns(client, t)
    const res = await client.execute(`SELECT * FROM ${t}`)
    const rows = (res.rows as any[]).map((r) => {
      const o: Record<string, any> = {}
      for (const c of cols) o[c] = (r as any)[c]
      return o
    })
    dumped.push({ table: t, columns: cols, rows })
  }
  return dumped
}

/** 恢复某个 db：清空并插入（仅处理已存在的表，忽略 schema 差异列） */
export async function restoreDb(
  client: any,
  tables: { table: string; columns?: string[]; rows?: Record<string, any>[] }[],
): Promise<{ tables: number; rows: number }> {
  await client.execute('PRAGMA foreign_keys = OFF')
  let tableCount = 0
  let rowCount = 0
  try {
    for (const t of tables || []) {
      // 仅当该表在目标库中真实存在才处理
      const exists = await client.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = '${t.table}'`,
      )
      if (!(exists.rows as any[]).length) {
        console.warn(`[CSMS-BACKUP] 恢复跳过未知表 ${t.table}（目标库无此表）`)
        continue
      }
      const cols = await tableColumns(client, t.table)
      const validCols = (t.columns || []).filter((c) => cols.includes(c))
      if (!validCols.length) continue

      await client.execute(`DELETE FROM ${t.table}`)
      tableCount++

      const placeholders = validCols.map(() => '?').join(',')
      for (const row of t.rows || []) {
        const vals = validCols.map((c) => (row as any)[c])
        await client.execute(
          `INSERT INTO ${t.table} (${validCols.join(',')}) VALUES (${placeholders})`,
          vals,
        )
        rowCount++
      }
    }
  } finally {
    await client.execute('PRAGMA foreign_keys = ON')
  }
  return { tables: tableCount, rows: rowCount }
}
