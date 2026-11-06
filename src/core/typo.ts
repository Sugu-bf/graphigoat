/**
 * French typography for the text of the page, applied once at boot when <html lang="fr…">:
 * narrow no-break space before ; ! ? and inside « », no-break space before :, curly apostrophe.
 * Authors (and CMS content) can type ordinary spaces; visitors see the right ones, and nothing breaks at the end
 * of a line before a question mark. Straight double quotes are left alone (they may be code): the QA flags them.
 *
 * Skipped: code, pre, kbd, samp, textarea, script, style, [translate="no"], and any text containing "://".
 */
const NNBSP = '\u202f'
const NBSP = '\u00a0'

export const frenchSpacing = (text: string) =>
  text
    .replace(/(\p{L})'(?=\p{L})/gu, '$1\u2019')
    .replace(/[ \u00a0]([;!?])/g, `${NNBSP}$1`)
    .replace(/([^\s\d:;!?«([{])([;!?])(?=[\s»)\]]|$)/gu, `$1${NNBSP}$2`)
    .replace(/ :/g, `${NBSP}:`)
    .replace(/([^\s\d:/])(:)(?=\s|$)/gu, `$1${NBSP}$2`)
    .replace(/«[ \u00a0]?(?=\S)/g, `«${NNBSP}`)
    .replace(/(\S)[ \u00a0]?»/g, `$1${NNBSP}»`)

const SKIP = 'code, pre, kbd, samp, textarea, script, style, [translate="no"]'

export const applyFrenchTypography = (root: Node = document.body) => {
  if (!(document.documentElement.lang || '').toLowerCase().startsWith('fr')) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const text = node.data
    if (!text.trim() || text.includes('://') || node.parentElement?.closest(SKIP)) continue
    const fixed = frenchSpacing(text)
    if (fixed !== text) node.data = fixed
  }
}
