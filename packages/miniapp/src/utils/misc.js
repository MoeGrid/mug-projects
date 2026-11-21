export function joinUrl(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/(^\/+|\/+$)/g, ''))
    .join('/')
}
