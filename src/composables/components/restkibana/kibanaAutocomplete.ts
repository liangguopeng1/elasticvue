import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { useConnectionStore } from '../../../store/connection'
import { REQUEST_DEFAULT_HEADERS } from '../../../consts'
import { clusterAuthHeader } from '../../../helpers/elasticsearchAdapter'
import { fetchMethod } from '../../../helpers/fetch'
import { queryKeywords, queryValues } from '../../../autocomplete'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS']
const ES_ENDPOINTS = [
  '_search', '_count', '_doc', '_bulk', '_update', '_update_by_query',
  '_delete_by_query', '_mapping', '_settings', '_alias', '_aliases',
  '_cat/indices', '_cat/shards', '_cat/nodes', '_cat/health', '_cat/aliases',
  '_cat/recovery', '_cat/segments', '_cat/count',
  '_cluster/health', '_cluster/stats', '_cluster/settings', '_cluster/state',
  '_nodes', '_nodes/stats', '_nodes/hot_threads',
  '_refresh', '_flush', '_forcemerge', '_cache/clear',
  '_reindex', '_analyze', '_validate/query',
  '_snapshot', '_slm/policy', '_template', '_index_template',
  '_security/api_key', '_tasks', '_ingest/pipeline'
]

const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)/

let cachedIndices: string[] = []
const cachedMappings: Map<string, string[]> = new Map()
let lastIndicesFetch = 0

const fetchIndices = async (): Promise<string[]> => {
  const now = Date.now()
  if (now - lastIndicesFetch < 30000 && cachedIndices.length > 0) return cachedIndices

  const connectionStore = useConnectionStore()
  if (!connectionStore.activeCluster) return []

  try {
    const headers: Record<string, string> = { ...REQUEST_DEFAULT_HEADERS }
    const authHeader = clusterAuthHeader(connectionStore.activeCluster.auth)
    if (authHeader) headers.Authorization = authHeader

    let url = connectionStore.activeCluster.uri
    if (!url.endsWith('/')) url += '/'
    url += '_cat/indices?format=json&h=index'

    const response = await fetchMethod(url, { method: 'GET', headers })
    if (response.ok) {
      const text = await response.text()
      const data = JSON.parse(text)
      cachedIndices = data.map((item: any) => item.index).filter(Boolean).sort()
      lastIndicesFetch = now
    }
  } catch (_e) { /* ignore */ }

  return cachedIndices
}

const fetchMappingFields = async (indexName: string): Promise<string[]> => {
  if (cachedMappings.has(indexName)) return cachedMappings.get(indexName)!

  const connectionStore = useConnectionStore()
  if (!connectionStore.activeCluster) return []

  try {
    const headers: Record<string, string> = { ...REQUEST_DEFAULT_HEADERS }
    const authHeader = clusterAuthHeader(connectionStore.activeCluster.auth)
    if (authHeader) headers.Authorization = authHeader

    let url = connectionStore.activeCluster.uri
    if (!url.endsWith('/')) url += '/'
    url += `${indexName}/_mapping`

    const response = await fetchMethod(url, { method: 'GET', headers })
    if (response.ok) {
      const text = await response.text()
      const data = JSON.parse(text)
      const fields = extractFieldsFromMapping(data)
      cachedMappings.set(indexName, fields)
      return fields
    }
  } catch (_e) { /* ignore */ }

  return []
}

const extractFieldsFromMapping = (data: any): string[] => {
  const fields: string[] = []

  const extract = (properties: any, prefix = '') => {
    if (!properties) return
    for (const [key, value] of Object.entries(properties)) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      fields.push(fullPath)
      if ((value as any).properties) {
        extract((value as any).properties, fullPath)
      }
    }
  }

  for (const indexData of Object.values(data)) {
    const mappings = (indexData as any).mappings
    if (mappings?.properties) {
      extract(mappings.properties)
    }
  }

  return [...new Set(fields)].sort()
}

const getRequestLineContext = (doc: string, pos: number) => {
  const lines = doc.split('\n')
  let charCount = 0
  let currentLine = 0

  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= pos) {
      currentLine = i
      break
    }
    charCount += lines[i].length + 1
  }

  const lineText = lines[currentLine]

  let indexName = ''
  for (let i = currentLine; i >= 0; i--) {
    const match = lines[i].match(REQUEST_LINE_REGEX)
    if (match) {
      const path = match[2].trim()
      const parts = path.split('/')
      if (parts[0] && !parts[0].startsWith('_')) {
        indexName = parts[0]
      }
      break
    }
  }

  return { isRequestLine: REQUEST_LINE_REGEX.test(lineText), lineText, currentLine, indexName }
}

export const kibanaCompletionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
  const doc = context.state.doc.toString()
  const pos = context.pos
  const { isRequestLine, lineText, indexName } = getRequestLineContext(doc, pos)

  if (isRequestLine) {
    return getRequestLineCompletions(context, lineText)
  } else {
    return getBodyCompletions(context, indexName)
  }
}

const getRequestLineCompletions = async (
  context: CompletionContext,
  lineText: string
): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/[\w._/]*/)
  if (!word) return null

  const hasMethod = REQUEST_LINE_REGEX.test(lineText)

  if (!hasMethod) {
    return {
      from: word.from,
      options: HTTP_METHODS.map(m => ({ label: m, type: 'keyword' }))
    }
  }

  const indices = await fetchIndices()
  const options = [
    ...indices.map(idx => ({ label: idx, type: 'variable', boost: 1 })),
    ...ES_ENDPOINTS.map(ep => ({ label: ep, type: 'function', boost: 0 }))
  ]

  return { from: word.from, options }
}

const getBodyCompletions = async (
  context: CompletionContext,
  indexName: string
): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/[\w.]*/)
  if (!word && !context.explicit) return null

  const from = word?.from ?? context.pos

  const options = [
    ...queryKeywords.map(w => ({ label: w, type: 'keyword', apply: `"${w}"` })),
    ...queryValues.map(w => ({ label: w, type: 'text', apply: `"${w}"` }))
  ]

  if (indexName) {
    const fields = await fetchMappingFields(indexName)
    fields.forEach(f => {
      options.push({ label: f, type: 'property', apply: `"${f}"` })
    })
  }

  return { from, options }
}

export const clearKibanaAutocompleteCache = () => {
  cachedIndices = []
  cachedMappings.clear()
  lastIndicesFetch = 0
}
