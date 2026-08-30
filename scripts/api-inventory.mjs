// API 清单生成器：扫描 server/api，推导路由 + 鉴权层级
// 用法: node scripts/api-inventory.mjs
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const API_DIR = join(process.cwd(), 'server', 'api')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

function authLevel(src) {
  // 顺序敏感：先看显式守卫，再看手写的 session+角色校验。
  // requireAdmin 必须优先于 role!=='super_admin' 启发式 —— 后者常只是
  // 在已登录基础上收窄数据范围（如 schools/:id 限制到本校），入口仍是 ADMIN。
  if (/requireSuperAdmin/.test(src)) return 'SUPER'
  if (/requireAdmin/.test(src)) return 'ADMIN'
  if (/requireStudent/.test(src)) return 'STUDENT'
  // 手写守卫：getAdminFromSession + 角色判断（未走统一 require* helper）
  if (/getAdminFromSession/.test(src) && /admin\.role\s*!==\s*['"]super_admin['"]/.test(src)) return 'SUPER*'
  if (/getAdminFromSession/.test(src)) return 'ADMIN*'
  if (/getStudentFromSession/.test(src)) return 'STUDENT*'
  return 'PUBLIC'
}

const rows = walk(API_DIR).map((full) => {
  const rel = relative(API_DIR, full).split(sep).join('/').replace(/\.ts$/, '')
  const m = rel.match(/\.(get|post|patch|delete|put)$/)
  const method = m ? m[1].toUpperCase() : 'ANY'
  const path =
    '/api/' +
    rel
      .replace(/\.(get|post|patch|delete|put)$/, '')
      .replace(/\/index$/, '')
      .replace(/\[(\w+)\]/g, ':$1')
  return { level: authLevel(readFileSync(full, 'utf8')), method, path, file: 'server/api/' + rel + '.ts' }
})

const order = { PUBLIC: 0, STUDENT: 1, 'STUDENT*': 2, ADMIN: 3, 'ADMIN*': 4, 'SUPER*': 5, SUPER: 6 }
rows.sort((a, b) => order[a.level] - order[b.level] || a.path.localeCompare(b.path))

const counts = rows.reduce((acc, r) => ((acc[r.level] = (acc[r.level] || 0) + 1), acc), {})
console.log(`TOTAL\t${rows.length}`)
console.log(`COUNTS\t${JSON.stringify(counts)}`)
for (const r of rows) console.log(`${r.level}\t${r.method}\t${r.path}`)
