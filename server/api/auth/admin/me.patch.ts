// 兼容别名：旧版本/预览构建的客户端可能仍调用 /api/auth/admin/me，
// 这里直接复用 /api/auth/me 的 PATCH 处理逻辑，避免返回 404。
import handler from '../me.patch'
export default handler
