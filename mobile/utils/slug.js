export function productSlug(commodity, classification) {
  const base = slugify(commodity || '')
  const cls = slugify(classification || '')
  const name = cls ? `${base}-${cls}` : base
  return name ? `${name}-prices-in-kenya` : ''
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
