export function joinUrl(...parts) {
  return parts
    .filter(Boolean)
    .map((part, index) => {
      part = String(part).replace(/(^\/+|\/+$)/g, '')
      if (index === 0)
        part = part.replace(/\/+$/, '')
      return part
    })
    .join('/')
}
