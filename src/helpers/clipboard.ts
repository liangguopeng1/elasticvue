import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { buildConfig } from '../buildConfig.ts'

export const writeToClipboard = async (text: string) => {
  try {
    if (buildConfig.tauri) {
      await writeText(text)
      return
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    /* fall through to execCommand */
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const ok = document.execCommand('copy')
  textarea.remove()
  if (!ok) throw new Error('copy failed')
}

export const readFromClipboard = () => {
  if (buildConfig.tauri) {
    return readText()
  }
  return navigator.clipboard.readText()
}

/**
 * Route navigator.clipboard through the Tauri plugin (same IPC as writeToClipboard).
 * Needed for code that calls the Web Clipboard API directly (e.g. codemirror-vim "+ register).
 * WebView2 often does not expose a working async clipboard the same way a normal browser does.
 */
export function installTauriNavigatorClipboardShim() {
  if (!buildConfig.tauri) return
  try {
    const clip = navigator.clipboard
    if (!clip) return
    Object.defineProperty(clip, 'writeText', {
      value: (text: string) => writeText(text),
      configurable: true,
      enumerable: true,
      writable: true
    })
    Object.defineProperty(clip, 'readText', {
      value: () => readText(),
      configurable: true,
      enumerable: true,
      writable: true
    })
  } catch {
    /* clipboard object may be sealed in some WebView builds */
  }
}
