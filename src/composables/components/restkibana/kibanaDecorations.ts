import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/

// Decoration for request line (subtle background)
const requestLineHighlight = Decoration.line({ class: 'cm-kibana-request-line' })

// Decoration for current active request block (blue left border)
const activeBlockLine = Decoration.line({ class: 'cm-kibana-active-block' })

/**
 * Plugin that highlights all request lines with a background color
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
        if (REQUEST_LINE_REGEX.test(line.text)) {
          builder.add(line.from, line.from, requestLineHighlight)
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
          builder.add(line.from, line.from, activeBlockLine)
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
    backgroundColor: 'rgba(76, 175, 80, 0.08)'
  },
  '.cm-kibana-active-block': {
    borderLeft: '3px solid #1976d2',
    paddingLeft: '8px'
  },
  '&dark .cm-kibana-request-line': {
    backgroundColor: 'rgba(76, 175, 80, 0.15)'
  },
  '&dark .cm-kibana-active-block': {
    borderLeft: '3px solid #42a5f5'
  }
})
