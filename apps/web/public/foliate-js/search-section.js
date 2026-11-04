export const abortError = () => Object.assign(new Error('Search cancelled'), { name: 'AbortError' })
export const readSearchDocument = (section, { signal, timeoutMs = 8000 } = {}) => {
    if (signal?.aborted) return Promise.reject(abortError())
    return new Promise((resolve, reject) => {
        let settled = false
        let timer
        const finish = (fn, value) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            signal?.removeEventListener('abort', onAbort)
            fn(value)
        }
        const onAbort = () => finish(reject, abortError())
        signal?.addEventListener('abort', onAbort, { once: true })
        timer = setTimeout(() => finish(reject, Object.assign(new Error('Search section timed out'), { code: 'SEARCH_SECTION_TIMEOUT' })), timeoutMs)
        Promise.resolve().then(() => section.createDocument()).then(
            doc => finish(resolve, doc), cause => finish(reject, cause))
    })
}
export const yieldSearchControl = () => new Promise(resolve => setTimeout(resolve, 0))
export const chapterSearchRange = (doc,index,span) => {
    if (!span) return doc
    const range = doc.createRange()
    range.selectNodeContents(doc.body)
    const point = anchor => {
        const target = anchor(doc)
        if (target === 0) { const top = doc.createRange(); top.selectNodeContents(doc.body); top.collapse(true); return top }
        if (!target) throw new Error('Chapter anchor unavailable')
        const result = target.cloneRange ? target.cloneRange() : doc.createRange()
        if (!target.cloneRange) result.selectNodeContents(target)
        result.collapse(true)
        return result
    }
    if (index === span.startIndex && span.startAnchor) {
        const start = point(span.startAnchor); range.setStart(start.startContainer,start.startOffset)
    }
    if (index === span.endIndex && span.endAnchor) {
        const end = point(span.endAnchor); range.setEnd(end.startContainer,end.startOffset)
    }
    return range
}
