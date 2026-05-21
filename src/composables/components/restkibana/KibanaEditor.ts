import { onMounted, Ref } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { Compartment } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { autocompletion } from '@codemirror/autocomplete'
import { baseTheme } from '../../CodeEditor/theme'
import { useCodeEditorStore } from '../../../store/codeEditor'
import { useConnectionStore } from '../../../store/connection'
import { beautify } from '../../../helpers/beautify'
import { writeToClipboard } from '../../../helpers/clipboard'
import { parseKibanaRequests, getRequestAtLine } from './kibanaParser'
import { kibanaExtensions, kibanaTheme } from './kibanaDecorations'
import { kibanaRunWidgetPlugin, kibanaRunWidgetTheme } from './kibanaRunWidget'
import { kibanaCompletionSource } from './kibanaAutocomplete'
import { buildCurlCommand, getApiReferenceUrl } from './kibanaRequestActions'
import { vim } from '@replit/codemirror-vim'

export const useKibanaEditor = (
  editorRef: Ref<HTMLElement | null>,
  { initialValue, emit }: {
    initialValue: string
    emit: any
  }
) => {
  const codeEditorStore = useCodeEditorStore()
  const connectionStore = useConnectionStore()
  let editorView: EditorView

  const executeRequestAtLine = (line: number) => {
    const content = editorView.state.doc.toString()
    const requests = parseKibanaRequests(content)
    const request = getRequestAtLine(requests, line)
    if (request) emit('execute', request)
  }

  const executeCurrentRequest = () => {
    const state = editorView.state
    executeRequestAtLine(state.doc.lineAt(state.selection.main.head).number - 1)
    return true
  }

  const handleAction = (line: number, action: string) => {
    const content = editorView.state.doc.toString()
    const requests = parseKibanaRequests(content)
    const request = getRequestAtLine(requests, line)
    if (!request) return

    switch (action) {
      case 'copy-curl':
        void writeToClipboard(buildCurlCommand(request, connectionStore.activeCluster?.uri || 'http://localhost:9200'))
        break
      case 'auto-indent':
        if (request.body) {
          const formatted = beautify(request.body)
          const doc = editorView.state.doc
          const startLine = doc.line(request.startLine + 2)
          const endLine = doc.line(request.endLine + 1)
          editorView.dispatch({
            changes: { from: startLine.from, to: endLine.to, insert: formatted }
          })
        }
        break
      case 'open-docs':
        window.open(getApiReferenceUrl(request.path), '_blank')
        break
    }
  }

  onMounted(() => {
    if (!editorRef.value) return

    const onChange = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      emit('update:modelValue', editorView.state.doc.toString())
    })

    const wrapLines = new Compartment()
    const vimExtension = vim()

    editorView = new EditorView({
      extensions: [
        codeEditorStore.vimMode ? vimExtension : [],
        basicSetup,
        json(),
        autocompletion({
          override: [kibanaCompletionSource],
          activateOnTyping: true
        }),
        ...kibanaExtensions,
        kibanaTheme,
        kibanaRunWidgetPlugin,
        kibanaRunWidgetTheme,
        onChange,
        keymap.of([indentWithTab]),
        keymap.of([
          { key: 'Ctrl-Enter', run: executeCurrentRequest },
          { key: 'Cmd-Enter', run: executeCurrentRequest }
        ]),
        wrapLines.of(codeEditorStore.wrapLines ? EditorView.lineWrapping : []),
        baseTheme
      ],
      parent: editorRef.value,
      doc: initialValue
    })

    editorView.dom.addEventListener('kibana-run', ((e: CustomEvent) => {
      executeRequestAtLine(e.detail.line)
    }) as EventListener)

    editorView.dom.addEventListener('kibana-action', ((e: CustomEvent) => {
      handleAction(e.detail.line, e.detail.action)
    }) as EventListener)
  })

  return { executeCurrentRequest }
}
