// Archive paths vs. manifest hrefs.
//
// A hand-built book routinely disagrees with itself: the OPF says
// "chapter%201.xhtml" while the zip stores "chapter 1.xhtml", or one half uses
// a different capitalisation. An exact lookup drops the chapter; resolving the
// entry that actually exists saves the book without inventing content.

/** The alternate spellings an href may be stored under. */
export const pathVariants = name => {
    const variants = []
    // Some Windows tools write zip entries with backslashes, which no spec
    // allows and every other reader quietly accepts.
    if (name.includes('\\')) variants.push(name.replaceAll('\\', '/'))
    try {
        const decoded = decodeURIComponent(name)
        if (decoded !== name) variants.push(decoded)
    } catch {}
    try {
        const encoded = encodeURI(name).replaceAll('#', '%23')
        if (encoded !== name) variants.push(encoded)
    } catch {}
    return variants
}

/** Resolve `name` to a value in a Map keyed by archive path. */
export const resolveEntry = (map, name) => {
    if (map.has(name)) return map.get(name)
    for (const variant of pathVariants(name)) {
        const hit = map.get(variant)
        if (hit) return hit
    }
    const lower = name.replaceAll('\\', '/').toLowerCase()
    for (const [key, value] of map) {
        const normalized = key.replaceAll('\\', '/').toLowerCase()
        if (normalized === lower) return value
    }
    return null
}
