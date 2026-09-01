// ===== 外部开放 API 响应契约 =====
//
// 内部接口（/api/**）历史上直接返回裸对象，形状各不相同 —— 对内可以接受，
// 但对外必须给第三方一个稳定契约，否则每次改字段都是破坏性变更。
// 因此 /api/v1/** 统一包裹为：{ code, message, data, requestId }
//
// code = 0 表示成功；非 0 为业务错误码，规则是「HTTP 状态码 × 100 + 序号」，
// 例如 40101 = 401 的第 1 种情况（缺少 api_token）。
// requestId 每次请求唯一，与 api_audit_logs.request_id 对应，便于第三方报障时定位。

/** 业务错误码表（对外文档需与此保持一致） */
export const API_CODE = {
  OK: 0,

  // 400 参数
  BAD_REQUEST: 40001,
  INVALID_PARAM: 40002,
  MISSING_PARAM: 40003,
  CONFIRM_REQUIRED: 40004,

  // 401 鉴权
  TOKEN_MISSING: 40101,
  TOKEN_INVALID: 40102,
  TOKEN_DISABLED: 40103,
  TOKEN_EXPIRED: 40104,
  TOKEN_ISSUER_DISABLED: 40105,

  // 403 授权
  SCHOOL_DISABLED: 40301,
  SCOPE_DENIED: 40302,
  OUT_OF_RANGE: 40303,

  // 404
  NOT_FOUND: 40401,

  // 409
  CONFLICT: 40901,

  // 429
  RATE_LIMITED: 42901,

  // 500
  INTERNAL: 50001,
} as const

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
  requestId: string
}

/** 成功响应。v1 端点一律 `return apiOk(event, data)` */
export function apiOk<T>(event: any, data: T, message = 'ok'): ApiEnvelope<T> {
  return {
    code: API_CODE.OK,
    message,
    data,
    requestId: String(event?.context?.apiRequestId || ''),
  }
}

/**
 * 失败响应。抛 h3 错误并把业务码塞进 data.bizCode，
 * 由 server/plugins/api-audit.ts 的 error hook 统一改写成契约格式。
 */
export function apiError(statusCode: number, bizCode: number, message: string): never {
  throw createError({
    statusCode,
    statusMessage: httpStatusText(statusCode),
    message,
    data: { bizCode },
  })
}

/**
 * 把任意异常转换成契约格式并直接作为响应返回（而不是继续往外抛）。
 *
 * 【为什么不靠 nitro 的错误处理器】
 * h3 在 onError 里让 nitro 的 errorHandler 直接把响应发出去，随后 event.handled=true，
 * beforeResponse / afterResponse 两个钩子都会被跳过。若放任 v1 抛错：
 *   1) 第三方拿到的错误体是 h3 默认形状，与成功响应契约不一致；
 *   2) 失败请求不会进审计日志 —— 而失败恰恰是最需要留痕的部分。
 * 因此 v1 链路上不向外抛错，一律在此收敛为正常返回。
 */
export function respondApiError(event: any, err: any): ApiEnvelope<null> {
  const statusCode = Number(err?.statusCode) || 500
  const bizCode = Number(err?.data?.bizCode) || (statusCode === 500 ? API_CODE.INTERNAL : statusCode * 100 + 1)
  const message = statusCode === 500
    ? '服务器内部错误'
    : String(err?.message || err?.statusMessage || '请求失败')

  // 未预期的 500 需要留栈供排查；已知业务错误不刷日志
  if (statusCode >= 500) {
    console.error('[CSMS][api/v1] 未处理异常:', err)
  }

  setResponseStatus(event, statusCode, httpStatusText(statusCode))
  event.context.apiErrorMessage = message

  return {
    code: bizCode,
    message,
    data: null,
    requestId: String(event?.context?.apiRequestId || ''),
  }
}

/**
 * v1 端点统一入口。除了少写 try/catch，更重要的作用是保证
 * 「任何异常都转成契约格式 + 都能进审计日志」这条不变量。
 */
export function defineApiV1Handler<T>(handler: (event: any) => Promise<T> | T) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    } catch (err: any) {
      return respondApiError(event, err)
    }
  })
}

function httpStatusText(code: number): string {
  switch (code) {
    case 400: return 'Bad Request'
    case 401: return 'Unauthorized'
    case 403: return 'Forbidden'
    case 404: return 'Not Found'
    case 409: return 'Conflict'
    case 429: return 'Too Many Requests'
    default: return 'Error'
  }
}

// ===== 统一分页 / 排序参数解析 =====

export interface PageParams {
  page: number
  limit: number
  offset: number
}

/** page 默认 1，limit 默认 20、上限 100（防止第三方一次拉走整校数据） */
export function parsePageParams(query: Record<string, any>): PageParams {
  let page = Number(query.page)
  let limit = Number(query.limit)
  if (!Number.isFinite(page) || page < 1) page = 1
  if (!Number.isFinite(limit) || limit < 1) limit = 20
  page = Math.floor(page)
  limit = Math.min(Math.floor(limit), 100)
  return { page, limit, offset: (page - 1) * limit }
}

/**
 * 解析排序参数。sortBy 必须命中白名单 —— 它最终会拼进 SQL 的 ORDER BY，
 * 直接透传会形成注入面。
 */
export function parseSortParams(
  query: Record<string, any>,
  allowed: readonly string[],
  fallback: string,
): { sortBy: string; desc: boolean } {
  const raw = String(query.sortBy || '').trim()
  const sortBy = allowed.includes(raw) ? raw : fallback
  const desc = String(query.order || 'desc').toLowerCase() !== 'asc'
  return { sortBy, desc }
}

/** 分页响应体统一形状 */
export function pageResult<T>(list: T[], total: number, p: PageParams) {
  return { list, total, page: p.page, limit: p.limit }
}
