const walkRange = (range, walker) => {
    const nodes = []
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
        const compare = range.comparePoint(node, 0)
        if (compare === 0) nodes.push(node)
        else if (compare > 0) break
    }
    return nodes
}

const walkDocument = (_, walker) => {
    const nodes = []
    for (let node = walker.nextNode(); node; node = walker.nextNode())
        nodes.push(node)
    return nodes
}

const filter = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    | NodeFilter.SHOW_CDATA_SECTION

const acceptNode = node => {
    if (node.nodeType === 1) {
        const name = node.tagName.toLowerCase()
        if (name === 'script' || name === 'style') return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_SKIP
    }
    return NodeFilter.FILTER_ACCEPT
}

const collectTextNodes = (x, filterFunc, intersecting = false) => {
    const root = x.commonAncestorContainer ?? x.body ?? x
    const doc = root.ownerDocument ?? x
    const walker = doc.createTreeWalker(root, filter, { acceptNode: filterFunc || acceptNode })
    if (x.commonAncestorContainer && intersecting) {
        const nodes = []
        if (root.nodeType === 3 && x.intersectsNode(root)) nodes.push(root)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (x.intersectsNode(node) && node.nodeType !== 1) nodes.push(node)
            else if (x.comparePoint(node, 0) > 0) break
        }
        return nodes
    }
    return (x.commonAncestorContainer ? walkRange : walkDocument)(x, walker)
}
const walkTextNodes = function* (nodes, func, clip) {
    if (!nodes.length) return
    const offsets = nodes.map(node => clip?.startContainer === node ? clip.startOffset : 0)
    const strs = nodes.map((node,index) => (node.nodeValue ?? '').slice(offsets[index], clip?.endContainer === node ? clip.endOffset : undefined))
    const makeRange = (startIndex, startOffset, endIndex, endOffset) => {
        const range = nodes[0].ownerDocument.createRange()
        range.setStart(nodes[startIndex], startOffset + offsets[startIndex])
        range.setEnd(nodes[endIndex], endOffset + offsets[endIndex])
        return range
    }
    yield* func(strs, makeRange)
}
export const textWalker = function* (x, func, filterFunc) {
    yield* walkTextNodes(collectTextNodes(x, filterFunc), func)
}
// Search-only paragraph runs. Preserve unwrapped text and inline spans without
// stitching through a nested block or changing the TTS/global text walker.
export const blockTextWalker = function* (x, func, filterFunc) {
    const selector = 'p,li,blockquote,div,h1,h2,h3,h4,h5,h6,pre,td,dd,dt,section,article,body'
    let current = null
    let nodes = []
    for (const node of collectTextNodes(x, filterFunc, true)) {
        const block = node.parentElement?.closest(selector) ?? node.parentNode
        if (block !== current && nodes.length) { yield* walkTextNodes(nodes, func, x.commonAncestorContainer ? x : null); nodes = [] }
        current = block
        nodes.push(node)
    }
    yield* walkTextNodes(nodes, func, x.commonAncestorContainer ? x : null)
}
