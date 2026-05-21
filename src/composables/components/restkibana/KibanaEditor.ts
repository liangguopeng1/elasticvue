import { onMounted, Ref } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { Compartment } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { autocompletion } from '@codemirror/autocomplete'
import { baseTheme } from '../../CodeEditor/theme'
import { useCodeEditorStore } from '../../../store/codeEditor'
import { parseKibanaRequests, getRequestAtLine } from './kibanaParser'
import { kibanaExtensions, kibanaTheme } from './kibanaDecorations'
import { kibanaCompletionSource } from './kibanaAutocomplete'
import { vim } from '@replit/codemirror-vim'

export const useKibanaEditor = (
  editorRef: Ref<HTMLElement | null>,
  { initialValue, emit }: {
    initialValue: string
    emit: any
  }
) => {
  const codeEditorStore = useCodeEditorStore()
  let editorView: EditorView

  const executeCurrentRequest = () => {
    const state = editorView.state
    const line = state.doc.lineAt(state.selection.main.head).number - 1
    const content = state.doc.toString()
    const requests = parseKibanaRequests(content)
    const request = getRequestAtLine(requests, line)
    if (request) {
      emit('execute', request)
    }
    return true
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

    // Listen for gutter button clicks on the editor DOM directly
    editorView.dom.addEventListener('kibana-run', ((e: CustomEvent) => {
      const line = e.detail.line
      const content = editorView.state.doc.toString()
      const requests = parseKibanaRequests(content)
      const request = getRequestAtLine(requests, line)
      if (request) emit('execute', request)
    }) as EventListener)
  })

  return { executeCurrentRequest }
}
