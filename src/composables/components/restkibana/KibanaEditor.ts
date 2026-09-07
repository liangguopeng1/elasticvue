import { onMounted, Ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { Compartment, Prec } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { autocompletion } from '@codemirror/autocomplete'
import { baseTheme } from '../../CodeEditor/theme'
import { useCodeEditorStore } from '../../../store/codeEditor'
import { useConnectionStore } from '../../../store/connection'
import { beautify } from '../../../helpers/beautify'
import { writeToClipboard } from '../../../helpers/clipboard'
import { parseKibanaRequests, getActiveRequestAtLine } from './kibanaParser'
import { kibanaExtensions, kibanaTheme } from './kibanaDecorations'
import { kibanaRunWidgetPlugin, kibanaRunWidgetTheme, kibanaTranslateFacet } from './kibanaRunWidget'
import { kibanaCompletionSource } from './kibanaAutocomplete'
import { buildCurlCommand, getApiReferenceUrl } from './kibanaRequestActions'
import { vim } from '@replit/codemirror-vim'
import { useTranslation } from '../../i18n'
import { useSnackbar } from '../../Snackbar'

export const useKibanaEditor = (
  editorRef: Ref<HTMLElement | null>,
  { modelValue, emit }: {
    modelValue: Ref<string>
    emit: any
  }
) => {
  const codeEditorStore = useCodeEditorStore()
  const connectionStore = useConnectionStore()
  const t = useTranslation()
  const { showSuccessSnackbar, showErrorSnackbar } = useSnackbar()
  let editorView: EditorView

  const executeRequestAtLine = (line: number) => {
    const content = editorView.state.doc.toString()
    const requests = parseKibanaRequests(content)
    const request = getActiveRequestAtLine(requests, line)
    if (request) emit('execute', request)
  }

  const executeCurrentRequest = (view: EditorView = editorView) => {
    if (!view) return true
    const line = view.state.doc.lineAt(view.state.selection.main.head).number - 1
    executeRequestAtLine(line)
    return true
  }

  const handleAction = (line: number, action: string) => {
    const content = editorView.state.doc.toString()
    const requests = parseKibanaRequests(content)
    const request = getRequestAtLine(requests, line)
    if (!request) return

    switch (action) {
      case 'copy-curl':
        writeToClipboard(buildCurlCommand(request, connectionStore.activeCluster?.uri || 'http://localhost:9200'))
          .then(() => showSuccessSnackbar({ title: t('rest_kibana.menu.copy_success') }))
          .catch(() => showErrorSnackbar({ title: t('rest_kibana.menu.copy_failed') }))
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
        kibanaTranslateFacet.of((key: string) => t(key)),
        onChange,
        keymap.of([indentWithTab]),
        Prec.highest(keymap.of([
          { key: 'Ctrl-Enter', run: executeCurrentRequest },
          { key: 'Cmd-Enter', run: executeCurrentRequest },
          { key: 'Mod-Enter', run: executeCurrentRequest }
        ])),
        wrapLines.of(codeEditorStore.wrapLines ? EditorView.lineWrapping : []),
        baseTheme
      ],
      parent: editorRef.value,
      doc: modelValue.value
    })

    editorView.dom.addEventListener('kibana-run', ((e: CustomEvent) => {
      executeRequestAtLine(e.detail.line)
    }) as EventListener)

    editorView.dom.addEventListener('kibana-action', ((e: CustomEvent) => {
      handleAction(e.detail.line, e.detail.action)
    }) as EventListener)

    editorView.dom.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.isComposing) return
      e.preventDefault()
      e.stopPropagation()
      executeCurrentRequest(editorView)
    }, true)
  })

  watch(modelValue, (newValue) => {
    if (!editorView) return
    if (newValue === editorView.state.doc.toString()) return
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: newValue }
    })
  })

  return { executeCurrentRequest }
}
