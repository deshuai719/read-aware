// READAWARE: navigation-target hardening. PDF bookmarks and stale/legacy hrefs
// can point at destinations PDF.js cannot turn into a page: a first element
// that is not a ref proxy (missing/malformed outline dest), or a page index
// past the current document's page count (file replaced / synced progress is
// stale). `getPageIndex` throws `Invalid pageIndex request.` for a non-ref
// first element, and a rejection here fails the whole `view.open()` TOC init —
// no reader and no back button. Resolve to a clamped page instead of throwing,
// so the book always opens and stale targets land on a real page.

export const clampPageIndex = (index, numPages) => {
    if (!Number.isFinite(index)) return 0
    if (!Number.isFinite(numPages) || numPages <= 0) return 0
    return Math.max(0, Math.min(Math.floor(index), numPages - 1))
}

// PDF.js's own `isRefProxy` is not exported; mirror its shape test so
// JSON-round-tripped outline dests can be validated before `getPageIndex`.
export const isRefShaped = value =>
    !!value && typeof value === 'object'
    && Number.isInteger(value.num) && value.num >= 0
    && Number.isInteger(value.gen) && value.gen >= 0

export const parseHrefDest = href => {
    try {
        return JSON.parse(href)
    } catch {
        return null
    }
}

export const resolveDestIndex = async ({ dest, getDestination, getPageIndex, numPages }) => {
    let resolved = dest
    try {
        if (typeof dest === 'string') resolved = await getDestination(dest)
        if (!isRefShaped(resolved?.[0])) return 0
        return clampPageIndex(await getPageIndex(resolved[0]), numPages)
    } catch {
        return 0
    }
}
