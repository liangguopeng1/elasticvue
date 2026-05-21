import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'

const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)/
const MENU_STYLE_ID = 'kibana-run-widget-menu-styles'

type MenuAction = 'copy-curl' | 'auto-indent' | 'open-docs'

const menuItems: Array<{ icon: string; label: string; action: MenuAction }> = [
  { icon: '📋', label: 'Copy as curl', action: 'copy-curl' },
  { icon: '⟳', label: 'Auto-indent', action: 'auto-indent' },
  { icon: '📖', label: 'Open API reference', action: 'open-docs' }
]

export const findRequestLineNumbers = (input: string) => {
  return input.split('\n').flatMap((line, index) => REQUEST_LINE_REGEX.test(line) ? [index] : [])
}

class RunButtonWidget extends WidgetType {
  constructor(private readonly lineNumber: number) {
    super()
  }

  eq(other: RunButtonWidget) {
    return this.lineNumber === other.lineNumber
  }

  toDOM(view: EditorView) {
    const container = document.createElement('span')
    container.className = 'kibana-run-widget'

    const runBtn = document.createElement('button')
    runBtn.className = 'kibana-run-btn'
    runBtn.innerHTML = '&#9654;'
    runBtn.title = 'Run (Ctrl+Enter)'
    runBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const event = new CustomEvent('kibana-run', { detail: { line: this.lineNumber }, bubbles: true })
      view.dom.dispatchEvent(event)
    })

    const moreBtn = document.createElement('button')
    moreBtn.className = 'kibana-more-btn'
    moreBtn.innerHTML = '&#8942;'
    moreBtn.title = 'More actions'
    moreBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.showMenu(view, moreBtn)
    })

    container.append(runBtn, moreBtn)
    return container
  }

  private showMenu(view: EditorView, anchor: HTMLElement) {
    const existing = document.querySelector('.kibana-context-menu')
    if (existing) existing.remove()

    const menu = document.createElement('div')
    menu.className = 'kibana-context-menu'

    menuItems.forEach(item => {
      const menuItem = document.createElement('div')
      menuItem.className = 'kibana-context-menu-item'
      menuItem.innerHTML = `<span class="kibana-menu-icon">${item.icon}</span>${item.label}`
      menuItem.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        menu.remove()
        const event = new CustomEvent('kibana-action', {
          detail: { line: this.lineNumber, action: item.action },
          bubbles: true
        })
        view.dom.dispatchEvent(event)
      })
      menu.appendChild(menuItem)
    })

    const rect = anchor.getBoundingClientRect()
    menu.style.position = 'fixed'
    menu.style.top = `${rect.bottom + 4}px`
    menu.style.left = `${Math.max(8, rect.right - 160)}px`
    document.body.appendChild(menu)

    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove()
        document.removeEventListener('mousedown', closeMenu)
      }
    }

    setTimeout(() => document.addEventListener('mousedown', closeMenu), 0)
  }

  ignoreEvent() {
    return true
  }
}

export const kibanaRunWidgetPlugin = ViewPlugin.fromClass(
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
          builder.add(line.to, line.to, Decoration.widget({ widget: new RunButtonWidget(i - 1), side: 1 }))
        }
      }

      return builder.finish()
    }
  },
  { decorations: v => v.decorations }
)

export const kibanaRunWidgetTheme = EditorView.baseTheme({
  '.kibana-run-widget': {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    zIndex: '10'
  },
  '.kibana-run-btn': {
    border: 'none',
    background: '#1976d2',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '3px',
    lineHeight: '1',
    fontWeight: 'bold'
  },
  '.kibana-run-btn:hover': {
    background: '#1565c0'
  },
  '.kibana-more-btn': {
    border: 'none',
    background: '#e0e0e0',
    color: '#424242',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px 6px',
    borderRadius: '3px',
    lineHeight: '1'
  },
  '.kibana-more-btn:hover': {
    background: '#bdbdbd'
  },
  '&dark .kibana-more-btn': {
    background: '#424242',
    color: '#e0e0e0'
  },
  '&dark .kibana-more-btn:hover': {
    background: '#616161'
  }
})

const menuStyles = `
.kibana-context-menu {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
  z-index: 9999;
  font-size: 13px;
}
.kibana-context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.1s;
}
.kibana-context-menu-item:hover {
  background: #f5f5f5;
}
.kibana-menu-icon {
  font-size: 14px;
}
@media (prefers-color-scheme: dark) {
  .kibana-context-menu {
    background: #2d2d2d;
    border-color: #424242;
  }
  .kibana-context-menu-item:hover {
    background: #383838;
  }
}
`

if (typeof document !== 'undefined' && !document.getElementById(MENU_STYLE_ID)) {
  const style = document.createElement('style')
  style.id = MENU_STYLE_ID
  style.textContent = menuStyles
  document.head.appendChild(style)
}
