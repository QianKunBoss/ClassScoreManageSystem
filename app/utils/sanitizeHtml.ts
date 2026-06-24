// HTML 安全过滤工具 - 基于白名单的 XSS 防护

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'code', 'pre', 'blockquote',
  'hr', 'div',
])

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  span: new Set(['style']),
  div: new Set(['style']),
  p: new Set(['style']),
}

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

const ALLOWED_STYLE_PROPERTIES = new Set([
  'color', 'background-color', 'font-weight', 'font-style',
  'text-decoration', 'text-align', 'font-size',
])

/**
 * 安全过滤 HTML 字符串，防止 XSS 攻击
 * 仅允许白名单中的标签和属性
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  if (typeof document === 'undefined') {
    return stripAllHtml(html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstChild as HTMLElement

  if (!container) return ''

  sanitizeNode(container, doc)

  return container.innerHTML
}

function stripAllHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function sanitizeNode(node: Node, doc: Document): void {
  const children = Array.from(node.childNodes)

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const tagName = el.tagName.toLowerCase()

      if (!ALLOWED_TAGS.has(tagName)) {
        const textNode = doc.createTextNode(el.textContent || '')
        node.replaceChild(textNode, el)
        continue
      }

      sanitizeAttributes(el, tagName)

      if (tagName === 'a') {
        const href = el.getAttribute('href') || ''
        if (!isSafeUrl(href)) {
          el.removeAttribute('href')
        } else {
          if (!el.getAttribute('target')) {
            el.setAttribute('target', '_blank')
          }
          if (!el.getAttribute('rel')) {
            el.setAttribute('rel', 'noopener noreferrer')
          }
        }
      }

      if (el.childNodes.length > 0) {
        sanitizeNode(el, doc)
      }
    } else if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.COMMENT_NODE) {
      node.removeChild(child)
    }
  }
}

function sanitizeAttributes(el: HTMLElement, tagName: string): void {
  const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || new Set<string>()
  const attrs = Array.from(el.attributes)

  for (const attr of attrs) {
    const attrName = attr.name.toLowerCase()

    if (!allowedAttrs.has(attrName)) {
      el.removeAttribute(attr.name)
      continue
    }

    if (attrName === 'style') {
      const sanitizedStyle = sanitizeStyle(attr.value)
      if (sanitizedStyle) {
        el.setAttribute('style', sanitizedStyle)
      } else {
        el.removeAttribute('style')
      }
    }

    if (attrName === 'href' && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name)
    }

    if (attrName.startsWith('on')) {
      el.removeAttribute(attr.name)
    }
  }

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('on') || attr.name.startsWith('data-')) {
      el.removeAttribute(attr.name)
    }
  }
}

function sanitizeStyle(style: string): string {
  const declarations = style.split(';').filter(d => d.trim())
  const safeDeclarations: string[] = []

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1) continue

    const prop = decl.slice(0, colonIdx).trim().toLowerCase()
    const value = decl.slice(colonIdx + 1).trim()

    if (ALLOWED_STYLE_PROPERTIES.has(prop) && !value.includes('url(') && !value.includes('expression') && !value.includes('javascript')) {
      safeDeclarations.push(`${prop}: ${value}`)
    }
  }

  return safeDeclarations.join('; ')
}

function isSafeUrl(url: string): boolean {
  if (!url) return false

  const trimmed = url.trim().toLowerCase()

  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return true
  }

  try {
    const urlObj = new URL(url, window.location.origin)
    return ALLOWED_URL_PROTOCOLS.has(urlObj.protocol)
  } catch {
    return false
  }
}
