import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, GutterMarker, gutter } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/

class RunGutterMarker extends GutterMarker {
  lineNumber: number

  constructor(lineNumber: number) {
    super()
    this.lineNumber = lineNumber
  }

  toDOM() {
    const btn = document.createElement('span')
    btn.className = 'kibana-run-btn'
    btn.textContent = '▶'
    btn.title = 'Run request (Ctrl+Enter)'
    btn.style.cursor = 'pointer'
    return btn
  }
}

const kibanaRunGutter = gutter({
  class: 'cm-kibana-run-gutter',
  markers(view) {
    const builder = new RangeSetBuilder<GutterMarker>()
    for (let i = 1; i <= view.state.doc.lines; i++) {
      const line = view.state.doc.line(i)
      if (REQUEST_LINE_REGEX.test(line.text)) {
        builder.add(line.from, line.from, new RunGutterMarker(i - 1))
      }
    }
    return builder.finish()
  },
  domEventHandlers: {
    mousedown(view, line) {
      const lineInfo = view.state.doc.lineAt(line.from)
      if (REQUEST_LINE_REGEX.test(lineInfo.text)) {
        const lineNumber = lineInfo.number - 1
        const event = new CustomEvent('kibana-run', { detail: { line: lineNumber }, bubbles: true })
        view.dom.dispatchEvent(event)
        return true
      }
      return false
    }
  }
})

const requestLineHighlight = Decoration.line({ class: 'cm-kibana-request-line' })

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

export const kibanaExtensions = [kibanaRunGutter, kibanaLineHighlightPlugin]

export const kibanaTheme = EditorView.baseTheme({
  '.cm-kibana-run-gutter': {
    width: '20px',
    textAlign: 'center'
  },
  '.cm-kibana-request-line': {
    backgroundColor: 'rgba(76, 175, 80, 0.08)'
  },
  '.kibana-run-btn': {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#4caf50',
    fontSize: '14px',
    padding: '0',
    lineHeight: '1'
  },
  '&dark .cm-kibana-request-line': {
    backgroundColor: 'rgba(76, 175, 80, 0.15)'
  }
})
