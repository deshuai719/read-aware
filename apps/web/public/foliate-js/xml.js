// Tolerant XML reading for package metadata.
//
// Real-world EPUBs ship OPF/NCX files that are XML by name only: a bare "&" in
// a description, an HTML entity XML never defined, a stray control character
// from a text export. A strict parse rejects the whole book, while every
// mainstream reader opens it. Repair is deliberately narrow — escape what was
// meant as literal text and retry once — and a still-broken document keeps its
// original parser error so the caller can report it honestly.

const XML_ENTITIES = {
    nbsp: '160', ensp: '8194', emsp: '8195', thinsp: '8201',
    mdash: '8212', ndash: '8211', hellip: '8230', middot: '183', bull: '8226',
    lsquo: '8216', rsquo: '8217', ldquo: '8220', rdquo: '8221', sbquo: '8218', bdquo: '8222',
    laquo: '171', raquo: '187', copy: '169', reg: '174', trade: '8482',
    deg: '176', times: '215', divide: '247', plusmn: '177', frac12: '189',
    shy: '173', zwj: '8205', zwnj: '8204', lrm: '8206', rlm: '8207',
}

// XML 1.0 forbids these outright; they usually arrive from a Windows or PDF
// text export rather than from a deliberate choice.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
const NAMED_ENTITY = /&([a-zA-Z][a-zA-Z0-9]{1,31});/g
const BARE_AMPERSAND = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g

export const sanitizeXML = str => str
    .replace(INVALID_XML_CHARS, '')
    // HTML-only entities become numeric references so the text survives intact.
    .replace(NAMED_ENTITY, (match, name) => {
        const code = XML_ENTITIES[name.toLowerCase()]
        return code ? `&#${code};` : match
    })
    .replace(BARE_AMPERSAND, '&amp;')

const hasParseError = doc => !!doc?.querySelector?.('parsererror')
    || !doc?.documentElement

/** Strict parse first; a repair pass only runs when the document is rejected. */
export const parseXML = (parser, str) => {
    const strict = parser.parseFromString(str, 'application/xml')
    if (!hasParseError(strict)) return strict
    const repairedText = sanitizeXML(str)
    if (repairedText === str) return strict
    const repaired = parser.parseFromString(repairedText, 'application/xml')
    if (hasParseError(repaired)) return strict
    console.warn('Recovered an invalid XML document by escaping literal text')
    return repaired
}
