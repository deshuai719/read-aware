// length for context in excerpts
const CONTEXT_LENGTH = 50

const normalizeWhitespace = str => str.replace(/\s+/g, ' ')

const toRange = (strs, start, end) => {
    let startIndex = 0, startBase = 0
    while (startIndex < strs.length - 1 && startBase + strs[startIndex].length <= start)
        startBase += strs[startIndex++].length
    let endIndex = startIndex, endBase = startBase
    while (endIndex < strs.length - 1 && endBase + strs[endIndex].length < end)
        endBase += strs[endIndex++].length
    return { startIndex, startOffset: start - startBase, endIndex, endOffset: end - endBase }
}
const makeExcerpt = (strs, { startIndex, startOffset, endIndex, endOffset }) => {
    let pre = strs[startIndex].slice(0, startOffset).slice(-50)
    for (let i = startIndex - 1; i >= 0 && pre.length < 50; i--)
        pre = strs[i].slice(-(50 - pre.length)) + pre
    let post = strs[endIndex].slice(endOffset, endOffset + 50)
    for (let i = endIndex + 1; i < strs.length && post.length < 50; i++)
        post += strs[i].slice(0, 50 - post.length)
    const match = startIndex === endIndex ? strs[startIndex].slice(startOffset, endOffset)
        : strs[startIndex].slice(startOffset) + strs.slice(startIndex + 1, endIndex).join('') + strs[endIndex].slice(0, endOffset)
    return { pre: (pre.length >= 50 ? '…' : '') + pre, match, post: post + (post.length >= 50 ? '…' : '') }
}
const wordChar = char => !!char && /[\p{L}\p{N}\p{M}_]/u.test(char)
const simpleSearch = function* (strs, query, { locales, sensitivity, granularity }) {
    const haystack = strs.join('')
    if (!query || !haystack) return
    const whole = granularity === 'word'
    const emit = (start, end) => {
        if (whole && (wordChar(haystack.slice(0, start).at(-1)) || wordChar(haystack[end]))) return null
        const range = toRange(strs, start, end)
        return { range, excerpt: makeExcerpt(strs, range) }
    }
    if (sensitivity === 'variant') {
        for (let from = 0; from <= haystack.length - query.length;) {
            const start = haystack.indexOf(query, from)
            if (start < 0) break
            const found = emit(start, start + query.length)
            if (found) yield found
            from = start + query.length
        }
        return
    }
    // A conservative grapheme fallback retains ORIGINAL offsets even when case
    // folding expands characters (for example İ). Do not index into a folded string.
    const units = []
    let offset = 0
    for (const char of haystack) {
        if (/[\p{M}]/u.test(char) && units.length) {
            const last = units.at(-1); last.text += char; last.end += char.length
        } else units.push({text:char,start:offset,end:offset+char.length})
        offset += char.length
    }
    const queryLength = Array.from(query).filter(char => !/[\p{M}]/u.test(char)).length
    const collator = new Intl.Collator(locales, {sensitivity,usage:'search'})
    for (let i = 0; queryLength && i + queryLength <= units.length; i++) {
        const start = units[i].start, end = units[i + queryLength - 1].end
        if (collator.compare(query, haystack.slice(start,end)) !== 0) continue
        const found = emit(start,end)
        if (found) { yield found; i += queryLength - 1 }
    }
}
const segmenterSearch = function* (strs, query, options = {}) {
    const { locales = 'en', granularity = 'word', sensitivity = 'base' } = options
    let segmenter, collator
    try {
        segmenter = new Intl.Segmenter(locales, { usage: 'search', granularity })
        collator = new Intl.Collator(locales, { sensitivity })
    } catch (e) {
        console.warn(e)
        segmenter = new Intl.Segmenter('en', { usage: 'search', granularity })
        collator = new Intl.Collator('en', { sensitivity })
    }
    const queryLength = Array.from(segmenter.segment(query)).length

    const substrArr = []
    let strIndex = 0
    let segments = segmenter.segment(strs[strIndex])[Symbol.iterator]()
    main: while (strIndex < strs.length) {
        while (substrArr.length < queryLength) {
            const { done, value } = segments.next()
            if (done) {
                // the current string is exhausted
                // move on to the next string
                strIndex++
                if (strIndex < strs.length) {
                    segments = segmenter.segment(strs[strIndex])[Symbol.iterator]()
                    continue
                } else break main
            }
            const { index, segment } = value
            // ignore formatting characters
            if (!/[^\p{Format}]/u.test(segment)) continue
            // normalize whitespace
            if (/\s/u.test(segment)) {
                if (!/\s/u.test(substrArr[substrArr.length - 1]?.segment))
                    substrArr.push({ strIndex, index, segment: ' ' })
                continue
            }
            value.strIndex = strIndex
            substrArr.push(value)
        }
        const substr = substrArr.map(x => x.segment).join('')
        if (collator.compare(query, substr) === 0) {
            const endIndex = strIndex
            const lastSeg = substrArr[substrArr.length - 1]
            const endOffset = lastSeg.index + lastSeg.segment.length
            const startIndex = substrArr[0].strIndex
            const startOffset = substrArr[0].index
            const range = { startIndex, startOffset, endIndex, endOffset }
            yield { range, excerpt: makeExcerpt(strs, range) }
        }
        substrArr.shift()
    }
}

export const search = (strs, query, options) => {
    const { granularity = 'grapheme', sensitivity = 'base' } = options
    if (!Intl?.Segmenter || granularity === 'grapheme'
    && (sensitivity === 'variant' || sensitivity === 'accent'))
        return simpleSearch(strs, query, options)
    return segmenterSearch(strs, query, options)
}

// ReadAware patch: all query terms must occur in the same leaf text block.
// Ranges are still real character ranges; never intersect different terms by CFI.
export const searchMatcher = (textWalker, opts) => {
    const { defaultLocale, matchCase, matchDiacritics, matchWholeWords, acceptNode, queryTerms } = opts
    return function* (doc, query) {
        const terms = queryTerms?.length ? queryTerms : [query]
        const options = {
            locales: (doc.commonAncestorContainer?.ownerDocument ?? doc).body?.lang || (doc.commonAncestorContainer?.ownerDocument ?? doc).documentElement?.lang || defaultLocale || 'en',
            granularity: matchWholeWords ? 'word' : 'grapheme',
            sensitivity: matchDiacritics && matchCase ? 'variant'
                : matchDiacritics && !matchCase ? 'accent'
                : !matchDiacritics && matchCase ? 'case' : 'base',
        }
        for (const result of textWalker(doc, function* (strs, makeRange) {
            for (const term of terms.slice(1)) if (search(strs, term, options).next().done) {
                if (options.reportProgress) yield { type: 'block' }
                return
            }
            for (const result of search(strs, terms[0], options)) {
                const { startIndex, startOffset, endIndex, endOffset } = result.range
                result.range = makeRange(startIndex, startOffset, endIndex, endOffset)
                yield result
            }
            if (options.reportProgress) yield { type: 'block' }
        }, acceptNode)) yield result
    }
}
