import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/
const REQUEST_PARTS_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/

// Decoration for request line (subtle background)
const requestLineHighlight = Decoration.line({ class: 'cm-kibana-request-line' })

// Inline mark decorations for syntax highlighting
const methodMark = Decoration.mark({ class: 'cm-kibana-method' })
const indexMark = Decoration.mark({ class: 'cm-kibana-index' })
const pathMark = Decoration.mark({ class: 'cm-kibana-path' })

// Decoration for current active request block (Kibana-style outline + left bar)
const activeBlockMiddle = Decoration.line({ class: 'cm-kibana-active-block' })
const activeBlockFirst = Decoration.line({ class: 'cm-kibana-active-block cm-kibana-active-block-first' })
const activeBlockLast = Decoration.line({ class: 'cm-kibana-active-block cm-kibana-active-block-last' })
const activeBlockSingle = Decoration.line({ class: 'cm-kibana-active-block cm-kibana-active-block-first cm-kibana-active-block-last' })

/**
 * Plugin that highlights request lines with background + inline syntax coloring
 * for HTTP method, index name, and API path.
 */
const kibanaLineHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      for (let i = 1; i <= view.state.doc.lines; i++) {
        const line = view.state.doc.line(i)
        const match = line.text.match(REQUEST_PARTS_REGEX)
        if (match) {
          // Line background
          builder.add(line.from, line.from, requestLineHighlight)

          // Method highlight (e.g. GET, POST)
          const methodStart = line.from
          const methodEnd = line.from + match[1].length
          builder.add(methodStart, methodEnd, methodMark)

          // Path highlight - split into index and API path
          const pathStr = match[2]
          const pathStart = line.from + match[0].indexOf(pathStr)
          const segments = pathStr.split('/')
          const firstSegment = segments[0]

          if (firstSegment && !firstSegment.startsWith('_')) {
            // First segment is an index name
            builder.add(pathStart, pathStart + firstSegment.length, indexMark)
            // Rest is the API path
            if (pathStr.length > firstSegment.length) {
              builder.add(pathStart + firstSegment.length, pathStart + pathStr.length, pathMark)
            }
          } else {
            // Entire path is an API endpoint (e.g. _cat/indices)
            builder.add(pathStart, pathStart + pathStr.length, pathMark)
          }
        }
      }
      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

/**
 * Plugin that highlights the current request block based on cursor position.
 * It finds which request block the cursor is in and applies a blue left border
 * to all lines of that block.
 */
const kibanaActiveBlockPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc
      const cursorLine = doc.lineAt(view.state.selection.main.head).number

      // Find the request block containing the cursor
      const { startLine, endLine } = this.findRequestBlock(doc, cursorLine)

      if (startLine > 0) {
        for (let i = startLine; i <= endLine; i++) {
          const line = doc.line(i)
          const deco = startLine === endLine ? activeBlockSingle
            : i === startLine ? activeBlockFirst
            : i === endLine ? activeBlockLast
            : activeBlockMiddle
          builder.add(line.from, line.from, deco)
        }
      }

      return builder.finish()
    }

    findRequestBlock(doc: any, cursorLine: number): { startLine: number; endLine: number } {
      const totalLines = doc.lines

      // Find the request line at or before cursor
      let startLine = 0
      for (let i = cursorLine; i >= 1; i--) {
        const line = doc.line(i)
        if (REQUEST_LINE_REGEX.test(line.text)) {
          startLine = i
          break
        }
      }

      if (startLine === 0) return { startLine: 0, endLine: 0 }

      // Find end of this request block (next request line or end of meaningful content)
      let endLine = startLine
      for (let i = startLine + 1; i <= totalLines; i++) {
        const line = doc.line(i)
        if (REQUEST_LINE_REGEX.test(line.text)) {
          break
        }
        if (line.text.trim() !== '') {
          endLine = i
        }
      }

      return { startLine, endLine }
    }
  },
  { decorations: (v) => v.decorations }
)

export const kibanaExtensions = [kibanaLineHighlightPlugin, kibanaActiveBlockPlugin]

export const kibanaTheme = EditorView.baseTheme({
  '.cm-kibana-request-line': {
    backgroundColor: 'transparent'
  },
  '.cm-kibana-active-block': {
    backgroundColor: 'rgba(0, 97, 166, 0.08)',
    boxShadow: 'inset 3px 0 0 #4d8ec4, inset -1px 0 0 #8eb4d0'
  },
  '.cm-kibana-active-block-first': {
    boxShadow: 'inset 3px 0 0 #4d8ec4, inset -1px 0 0 #8eb4d0, inset 0 1px 0 #8eb4d0'
  },
  '.cm-kibana-active-block-last': {
    boxShadow: 'inset 3px 0 0 #4d8ec4, inset -1px 0 0 #8eb4d0, inset 0 -1px 0 #8eb4d0'
  },
  '.cm-kibana-active-block-first.cm-kibana-active-block-last': {
    boxShadow: 'inset 3px 0 0 #4d8ec4, inset -1px 0 0 #8eb4d0, inset 0 1px 0 #8eb4d0, inset 0 -1px 0 #8eb4d0'
  },
  '.cm-kibana-active-block.cm-activeLine': {
    backgroundColor: 'rgba(0, 97, 166, 0.12)'
  },
  '.cm-kibana-method': {
    color: '#d32f2f',
    fontWeight: 'bold'
  },
  '.cm-kibana-index': {
    color: '#6a1b9a',
    fontWeight: '600'
  },
  '.cm-kibana-path': {
    color: '#1565c0'
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid #d3dae6',
    borderRadius: '4px',
    backgroundColor: '#fff',
    color: '#343741',
    boxShadow: '0 2px 8px rgba(15, 25, 45, 0.14)',
    overflow: 'hidden'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '13px',
    minWidth: '220px',
    maxHeight: '16em',
    padding: '2px 0'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 10px',
    lineHeight: '1.45',
    color: '#343741'
  },
  '&light .cm-tooltip-autocomplete ul li[aria-selected]': {
    background: '#e6edf3',
    color: '#343741'
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    color: '#0077cc',
    fontWeight: '700'
  },
  '.cm-completionDetail': {
    marginLeft: 'auto',
    paddingLeft: '16px',
    fontStyle: 'normal',
    fontSize: '11px',
    color: '#98a2b3'
  },
  '.cm-completionIcon': {
    width: '12px',
    height: '14px',
    marginRight: '8px',
    paddingRight: '0',
    opacity: '0.55',
    border: '1px solid currentColor',
    borderRadius: '1px',
    boxSizing: 'border-box',
    backgroundImage: 'linear-gradient(currentColor, currentColor), linear-gradient(currentColor, currentColor), linear-gradient(currentColor, currentColor)',
    backgroundSize: '6px 1.5px',
    backgroundPosition: '2px 3px, 2px 6px, 2px 9px',
    backgroundRepeat: 'no-repeat'
  },
  '.cm-completionIcon-function:after, .cm-completionIcon-method:after, .cm-completionIcon-class:after, .cm-completionIcon-interface:after, .cm-completionIcon-variable:after, .cm-completionIcon-constant:after, .cm-completionIcon-type:after, .cm-completionIcon-enum:after, .cm-completionIcon-property:after, .cm-completionIcon-keyword:after, .cm-completionIcon-namespace:after, .cm-completionIcon-text:after': {
    content: 'none'
  },
  '&dark .cm-kibana-request-line': {
    backgroundColor: 'transparent'
  },
  '&dark .cm-kibana-active-block': {
    backgroundColor: 'rgba(66, 165, 245, 0.14)',
    boxShadow: 'inset 3px 0 0 #1e88e5, inset -1px 0 0 #5c7a94'
  },
  '&dark .cm-kibana-active-block-first': {
    boxShadow: 'inset 3px 0 0 #1e88e5, inset -1px 0 0 #5c7a94, inset 0 1px 0 #5c7a94'
  },
  '&dark .cm-kibana-active-block-last': {
    boxShadow: 'inset 3px 0 0 #1e88e5, inset -1px 0 0 #5c7a94, inset 0 -1px 0 #5c7a94'
  },
  '&dark .cm-kibana-active-block-first.cm-kibana-active-block-last': {
    boxShadow: 'inset 3px 0 0 #1e88e5, inset -1px 0 0 #5c7a94, inset 0 1px 0 #5c7a94, inset 0 -1px 0 #5c7a94'
  },
  '&dark .cm-kibana-method': {
    color: '#ef5350'
  },
  '&dark .cm-kibana-index': {
    color: '#ce93d8'
  },
  '&dark .cm-kibana-path': {
    color: '#64b5f6'
  },
  '&dark .cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: '#2d2d2d',
    borderColor: '#555',
    color: '#e0e0e0'
  },
  '&dark .cm-tooltip-autocomplete ul li[aria-selected]': {
    background: '#3d4a5c',
    color: '#e0e0e0'
  },
  '&dark .cm-completionMatchedText': {
    color: '#64b5f6'
  },
  '&dark .cm-completionDetail': {
    color: '#9e9e9e'
  }
})
