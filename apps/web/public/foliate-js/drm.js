// Content encryption vs. font obfuscation.
//
// EPUB's encryption.xml covers two very different things: the two IDPF/Adobe
// font-obfuscation schemes (harmless, decodable) and real DRM (AES, ADEPT),
// which this reader cannot open. `Encryption` already knows the first kind, so
// an unknown algorithm is only reported when it covers a reading document —
// an odd-looking font entry must not turn a readable book into an error.

const baseName = path => {
    let value = path
    try { value = decodeURIComponent(value) } catch {}
    return value.split('/').pop().toLowerCase()
}

const isReadingDocument = item => /xhtml|html/i.test(item?.mediaType ?? '')

/** True when an unrecognised encryption scheme covers a reading document. */
export const encryptsContent = (encryptedUris, manifest) => {
    if (!encryptedUris?.length) return false
    const locked = encryptedUris.map(baseName)
    return manifest.some(item => isReadingDocument(item)
        && locked.includes(baseName(item.href ?? '')))
}
