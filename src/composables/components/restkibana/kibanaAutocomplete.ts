import { Completion, CompletionContext, CompletionResult, snippet } from '@codemirror/autocomplete'
import { useConnectionStore } from '../../../store/connection'
import { REQUEST_DEFAULT_HEADERS } from '../../../consts'
import { clusterAuthHeader } from '../../../helpers/elasticsearchAdapter'
import { fetchMethod } from '../../../helpers/fetch'
import { syntaxTree } from '@codemirror/language'

/** Subsequence fuzzy match: does `pattern` appear as a subsequence in `text`? */
const fuzzyMatch = (pattern: string, text: string): boolean => {
  if (!pattern) return true
  let pi = 0
  for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
    if (text[ti] === pattern[pi]) pi++
  }
  return pi === pattern.length
}

/** Higher = better. Match starting earlier ranks first; then contiguous/compact. */
const matchBoost = (pattern: string, text: string): number => {
  if (!pattern) return 0
  let pi = 0
  let start = -1
  for (let i = 0; i < text.length && pi < pattern.length; i++) {
    if (text[i] !== pattern[pi]) continue
    if (start < 0) start = i
    pi++
    if (pi === pattern.length) {
      const span = i - start + 1
      const startScore = 1000 - Math.min(start, 99) * 10
      const compact = Math.round((pattern.length / span) * 9)
      const contiguous = span === pattern.length ? 5 : 0
      return startScore + compact + contiguous
    }
  }
  return 0
}

const fuzzyScored = (items: string[], typed: string) =>
  items
    .filter(item => fuzzyMatch(typed, item.toLowerCase()))
    .map(item => ({ item, boost: matchBoost(typed, item.toLowerCase()) }))
    .sort((a, b) => b.boost - a.boost)

/** Pairs of [from, to) into `text` for subsequence matches, used to highlight typed chars. */
const subsequenceRanges = (pattern: string, text: string): number[] => {
  if (!pattern) return []
  const ranges: number[] = []
  const p = pattern.toLowerCase()
  const t = text.toLowerCase()
  let pi = 0
  let start = -1
  let last = -1
  for (let i = 0; i < t.length && pi < p.length; i++) {
    if (t[i] !== p[pi]) continue
    if (start < 0) start = i
    else if (i !== last + 1) {
      ranges.push(start, last + 1)
      start = i
    }
    last = i
    pi++
  }
  if (start >= 0) ranges.push(start, last + 1)
  return ranges
}

/** Include wrapping quotes (and a following colon) so apply text that adds them does not duplicate. */
const completionRange = (context: CompletionContext, word: { from: number; to: number } | null) => {
  let from = word?.from ?? context.pos
  let to = word?.to ?? context.pos
  if (from > 0 && context.state.sliceDoc(from - 1, from) === '"') {
    from--
    if (to < context.state.doc.length && context.state.sliceDoc(to, to + 1) === '"') to++
  }
  const after = context.state.sliceDoc(to)
  const colon = after.match(/^[ \t]*:[ \t]?/)
  if (colon) to += colon[0].length
  return { from, to }
}

const consumeBalanced = (text: string, start: number): number => {
  if (text[start] !== '{' && text[start] !== '[') return 0
  let depth = 0
  let inStr = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return 0
}

const jsonValueAfter = (state: { sliceDoc: (from: number, to?: number) => string }, to: number) => {
  const after = state.sliceDoc(to)
  const sp = after.match(/^[ \t\n\r]*/)
  const i = sp ? sp[0].length : 0
  const n = consumeBalanced(after, i)
  if (!n) return { end: to, empty: true }
  const inner = after.slice(i + 1, n - 1).trim()
  return { end: to + n, empty: inner === '' }
}

const snippetOption = (template: string, completion: Completion): Completion => {
  const applyInner = snippet(template)
  return {
    ...completion,
    apply(view, c, from, to) {
      const { end, empty } = jsonValueAfter(view.state, to)
      if (!empty) {
        const old = view.state.sliceDoc(from, to)
        const insert = /^(\s*)"[^"]+"/.test(old)
          ? old.replace(/^(\s*)"[^"]+"/, `$1"${completion.label}"`)
          : `"${completion.label}"`
        view.dispatch({ changes: { from, to, insert } })
        return
      }
      applyInner(view, c, from, end)
    }
  }
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH', 'OPTIONS']
const ES_ENDPOINTS = [
  '_search', '_count', '_doc', '_bulk', '_update', '_update_by_query',
  '_delete_by_query', '_mapping', '_settings', '_alias', '_aliases',
  '_cat/indices', '_cat/shards', '_cat/nodes', '_cat/health', '_cat/aliases',
  '_cat/recovery', '_cat/segments', '_cat/count', '_cat/thread_pool',
  '_cluster/health', '_cluster/stats', '_cluster/settings', '_cluster/state',
  '_nodes', '_nodes/stats', '_nodes/hot_threads',
  '_refresh', '_flush', '_forcemerge', '_cache/clear',
  '_reindex', '_analyze', '_validate/query',
  '_snapshot', '_snapshot/_all', '_snapshot/_status',
  '_slm/policy', '_template', '_index_template',
  '_security/api_key', '_tasks', '_ingest/pipeline',
  '_msearch', '_mget', '_field_caps', '_resolve/index'
]
const INDEX_APIS = [
  '_search', '_count', '_doc', '_bulk', '_update', '_update_by_query',
  '_delete_by_query', '_mapping', '_settings', '_alias', '_aliases',
  '_refresh', '_flush', '_forcemerge', '_cache/clear',
  '_analyze', '_validate/query', '_msearch', '_mget', '_field_caps'
]
/** Next path segment after `completedPrefix` (e.g. `_cat` → `indices`). */
const nextPathSegments = (endpoints: string[], completedPrefix: string): string[] => {
  const prefix = completedPrefix.toLowerCase()
  const segs: string[] = []
  const seen = new Set<string>()
  for (const ep of endpoints) {
    const rest = !prefix
      ? ep
      : ep.toLowerCase().startsWith(prefix + '/')
        ? ep.slice(prefix.length + 1)
        : null
    if (!rest) continue
    const next = rest.split('/')[0]
    const key = next.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    segs.push(next)
  }
  return segs
}

// Comprehensive ES query DSL keywords (property keys that expect objects/values)
const ES_QUERY_KEYWORDS = [
  // Top-level search params
  'query', 'size', 'from', 'sort', '_source', 'timeout', 'track_total_hits',
  'highlight', 'aggs', 'aggregations', 'post_filter', 'rescore',
  'collapse', 'search_after', 'pit', 'min_score', 'explain',
  'version', 'seq_no_primary_term', 'stored_fields', 'script_fields',
  'indices_boost', 'suggest', 'profile', 'ext',

  // Query types
  'match', 'match_all', 'match_none', 'match_phrase', 'match_phrase_prefix',
  'multi_match', 'query_string', 'simple_query_string', 'combined_fields',

  // Term-level queries
  'term', 'terms', 'terms_set', 'range', 'exists', 'prefix',
  'wildcard', 'regexp', 'fuzzy', 'ids', 'type',

  // Compound queries
  'bool', 'must', 'must_not', 'should', 'filter',
  'boosting', 'constant_score', 'dis_max', 'function_score',

  // Nested/Joining
  'nested', 'has_child', 'has_parent', 'parent_id',

  // Geo queries
  'geo_bounding_box', 'geo_distance', 'geo_polygon', 'geo_shape',

  // Special
  'more_like_this', 'percolate', 'rank_feature', 'script', 'script_score',
  'wrapper', 'pinned',

  // Common params inside queries
  'value', 'boost', 'analyzer', 'operator', 'fuzziness',
  'prefix_length', 'max_expansions', 'minimum_should_match',
  'lenient', 'zero_terms_query', 'cutoff_frequency',
  'fields', 'tie_breaker', 'flags', 'default_field',
  'default_operator', 'allow_leading_wildcard',

  // Sort params
  'order', 'mode', 'missing', 'unmapped_type',

  // Aggregation types
  'avg', 'sum', 'min', 'max', 'count', 'stats', 'extended_stats',
  'cardinality', 'percentiles', 'percentile_ranks',
  'value_count', 'top_hits', 'date_histogram', 'histogram',
  'terms', 'range', 'date_range', 'filter', 'filters',
  'global', 'missing', 'nested', 'reverse_nested', 'composite',
  'bucket_sort', 'bucket_script',

  // Highlight params
  'pre_tags', 'post_tags', 'fragment_size', 'number_of_fragments',

  // Source filtering
  'includes', 'excludes',

  // Range params
  'gte', 'gt', 'lte', 'lt', 'format', 'time_zone',

  // Index settings / mappings
  'settings', 'mappings', 'properties', 'index',
  'number_of_shards', 'number_of_replicas'
]

// Snippet templates for keywords with fixed syntax structures
// Use ${1:FIELD} so the cursor lands on the field; subsequent lines indent relative to the current line
const ES_KEYWORD_SNIPPETS: Record<string, string> = {
  'match_all': '"match_all": {${1}}',
  'match_none': '"match_none": {${1}}',
  'track_total_hits': '"track_total_hits": ${1:true}',
  'match': '"match": {\n\t"${1:FIELD}": "${2:TEXT}"\n}',
  'match_phrase': '"match_phrase": {\n\t"${1:FIELD}": "${2:TEXT}"\n}',
  'match_phrase_prefix': '"match_phrase_prefix": {\n\t"${1:FIELD}": "${2:TEXT}"\n}',
  'multi_match': '"multi_match": {\n\t"query": "${2:TEXT}",\n\t"fields": ["${1:FIELD}"]\n}',
  'term': '"term": {\n\t"${1:FIELD}": "${2:VALUE}"\n}',
  'terms': '"terms": {\n\t"${1:FIELD}": ["${2:VALUE1}", "${3:VALUE2}"]\n}',
  'range': '"range": {\n\t"${1:FIELD}": {\n\t\t"gte": ${2:10},\n\t\t"lte": ${3:20}\n\t}\n}',
  'exists': '"exists": {\n\t"field": "${1:FIELD}"\n}',
  'prefix': '"prefix": {\n\t"${1:FIELD}": "${2:VALUE}"\n}',
  'wildcard': '"wildcard": {\n\t"${1:FIELD}": "${2:VALUE*}"\n}',
  'regexp': '"regexp": {\n\t"${1:FIELD}": "${2:PATTERN}"\n}',
  'fuzzy': '"fuzzy": {\n\t"${1:FIELD}": {\n\t\t"value": "${2:TEXT}",\n\t\t"fuzziness": "${3:AUTO}"\n\t}\n}',
  'ids': '"ids": {\n\t"values": ["${1:ID1}", "${2:ID2}"]\n}',
  'bool': '"bool": {\n\t${1}\n}',
  'must': '"must": [\n\t{${1}}\n]',
  'should': '"should": [\n\t{${1}}\n]',
  'must_not': '"must_not": [\n\t{${1}}\n]',
  'filter': '"filter": [\n\t{${1}}\n]',
  'nested': '"nested": {\n\t"path": "${1:FIELD}",\n\t"query": {${2}}\n}',
  'query': '"query": {\n\t${1}\n}',
  'query_string': '"query_string": {\n\t"query": "${2:TEXT}",\n\t"default_field": "${1:FIELD}"\n}',
  'simple_query_string': '"simple_query_string": {\n\t"query": "${2:TEXT}",\n\t"fields": ["${1:FIELD}"]\n}',
  'constant_score': '"constant_score": {\n\t"filter": {${1}},\n\t"boost": 1.0\n}',
  'function_score': '"function_score": {\n\t"query": {${1}},\n\t"functions": []\n}',
  'dis_max': '"dis_max": {\n\t"queries": [${1}]\n}',
  'boosting': '"boosting": {\n\t"positive": {${1}},\n\t"negative": {},\n\t"negative_boost": 0.5\n}',
  'has_child': '"has_child": {\n\t"type": "${1:CHILD_TYPE}",\n\t"query": {${2}}\n}',
  'has_parent': '"has_parent": {\n\t"parent_type": "${1:PARENT_TYPE}",\n\t"query": {${2}}\n}',
  'geo_distance': '"geo_distance": {\n\t"distance": "10km",\n\t"${1:FIELD}": { "lat": 0, "lon": 0 }\n}',
  'more_like_this': '"more_like_this": {\n\t"fields": ["${1:FIELD}"],\n\t"like": "${2:TEXT}",\n\t"min_term_freq": 1\n}',
  'highlight': '"highlight": {\n\t"fields": {\n\t\t"${1:FIELD}": {}\n\t}\n}',
  'sort': '"sort": [\n\t{ "${1:FIELD}": { "order": "desc" } }\n]',
  'aggs': '"aggs": {\n\t"${2:NAME}": {\n\t\t"terms": { "field": "${1:FIELD}" }\n\t}\n}',
  'aggregations': '"aggregations": {\n\t"${2:NAME}": {\n\t\t"terms": { "field": "${1:FIELD}" }\n\t}\n}',
  '_source': '"_source": ["${1:FIELD}"]',
  'script': '"script": {\n\t"source": "${1:SCRIPT}",\n\t"lang": "painless"\n}',
  'collapse': '"collapse": {\n\t"field": "${1:FIELD}"\n}',
  'rescore': '"rescore": {\n\t"window_size": 50,\n\t"query": {\n\t\t"rescore_query": {${1}}\n\t}\n}',
  'suggest': '"suggest": {\n\t"${2:NAME}": {\n\t\t"text": "${3:TEXT}",\n\t\t"term": { "field": "${1:FIELD}" }\n\t}\n}',
  'date_histogram': '"date_histogram": {\n\t"field": "${1:FIELD}",\n\t"calendar_interval": "month"\n}',
  'histogram': '"histogram": {\n\t"field": "${1:FIELD}",\n\t"interval": 10\n}'
}

// Values only for keys that actually expect these enums — not free-text field values
const CONTEXT_VALUES: Record<string, string[]> = {
  order: ['asc', 'desc'],
  operator: ['AND', 'OR'],
  default_operator: ['AND', 'OR'],
  fuzziness: ['AUTO'],
  type: ['phrase', 'phrase_prefix', 'best_fields', 'most_fields', 'cross_fields'],
  zero_terms_query: ['all', 'none'],
  format: ['epoch_millis', 'epoch_second', 'strict_date_optional_time'],
  track_total_hits: ['true', 'false'],
  explain: ['true', 'false'],
  lenient: ['true', 'false'],
  relation: ['within', 'contains', 'intersects']
}

const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)/

let cachedIndices: string[] = []
const cachedMappings: Map<string, string[]> = new Map()
let lastIndicesFetch = 0
let cachedSnapshotRepos: string[] = []
let lastSnapshotReposFetch = 0

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

const fetchSnapshotRepos = async (): Promise<string[]> => {
  const now = Date.now()
  if (now - lastSnapshotReposFetch < 30000 && cachedSnapshotRepos.length > 0) return cachedSnapshotRepos
  const connectionStore = useConnectionStore()
  if (!connectionStore.activeCluster) return []
  try {
    const headers: Record<string, string> = { ...REQUEST_DEFAULT_HEADERS }
    const authHeader = clusterAuthHeader(connectionStore.activeCluster.auth)
    if (authHeader) headers.Authorization = authHeader
    let url = connectionStore.activeCluster.uri
    if (!url.endsWith('/')) url += '/'
    url += '_snapshot'
    const response = await fetchMethod(url, { method: 'GET', headers })
    if (response.ok) {
      const data = JSON.parse(await response.text())
      cachedSnapshotRepos = Object.keys(data || {}).filter(Boolean).sort()
      lastSnapshotReposFetch = now
    }
  } catch (_e) { /* ignore */ }
  return cachedSnapshotRepos
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

const braceDepthAt = (text: string): number => {
  let depth = 0
  let inStr = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') depth--
  }
  return depth
}

const isKeyPositionByText = (doc: string, pos: number): boolean => {
  const before = doc.slice(0, pos)
  let inStr = false
  let strStart = -1
  let escaped = false
  for (let i = 0; i < before.length; i++) {
    const ch = before[i]
    if (inStr) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') { inStr = false; strStart = -1 }
      continue
    }
    if (ch === '"') { inStr = true; strStart = i }
  }
  const prefix = (inStr && strStart >= 0 ? before.slice(0, strStart) : before).trimEnd()
  return /[{,]$/.test(prefix) || /[{,]\s*"?[a-zA-Z_][\w.]*$/.test(prefix)
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
  const isInsideBody = braceDepthAt(doc.slice(0, pos)) > 0
  const isRequestLineContext = !isInsideBody

  let indexName = ''
  let requestPath = ''
  for (let i = currentLine; i >= 0; i--) {
    const match = lines[i].match(REQUEST_LINE_REGEX)
    if (match) {
      requestPath = match[2].trim().split('?')[0].replace(/\s*\{[\s\S]*$/, '').trim()
      const parts = requestPath.split('/')
      if (parts[0] && !parts[0].startsWith('_')) {
        indexName = parts[0]
      }
      break
    }
  }

  return { isRequestLine: isRequestLineContext, lineText, currentLine, indexName, requestPath }
}

/**
 * Determine if cursor is in a "property name" position (expects a key)
 * vs a "property value" position (expects a value).
 * Uses the syntax tree from CodeMirror's JSON parser.
 */
const isPropertyNamePosition = (context: CompletionContext): boolean => {
  const node = syntaxTree(context.state).resolveInner(context.pos, -1)
  if (node.name === 'PropertyName') return true
  for (let n = node.parent; n; n = n.parent) {
    if (n.name === 'PropertyName') return true
    if (n.name === 'Property' || n.name === 'JsonText') break
  }
  return isKeyPositionByText(context.state.doc.toString(), context.pos)
}

export const kibanaCompletionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
  // Only trigger on word characters - not on punctuation like comma, colon, braces
  const word = context.matchBefore(/[a-zA-Z_][\w.]*/)
  if (!word && !context.explicit) return null

  const doc = context.state.doc.toString()
  const pos = context.pos
  const { isRequestLine, lineText, indexName, requestPath } = getRequestLineContext(doc, pos)

  if (isRequestLine) {
    return getRequestLineCompletions(context, lineText)
  } else {
    return getBodyCompletions(context, indexName, requestPath)
  }
}

const getRequestLineCompletions = async (
  context: CompletionContext,
  lineText: string
): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/[\w._/]*/)
  if (!word) return null

  const hasMethod = REQUEST_LINE_REGEX.test(lineText)
  const typed = word.text.toLowerCase()

  if (!hasMethod) {
    // No method yet - only suggest HTTP methods
    return {
      from: word.from,
      filter: false,
      options: fuzzyScored(HTTP_METHODS, typed).map(({ item, boost }) => ({ label: item, type: 'keyword', boost })),
      getMatch: (c) => subsequenceRanges(typed, c.label)
    }
  }

  // Method already typed - suggest indices and endpoints for the path portion
  // Detect current segment: the part after the last "/"
  const fullPath = word.text
  const lastSlashIdx = fullPath.lastIndexOf('/')
  const currentSegment = lastSlashIdx >= 0 ? fullPath.slice(lastSlashIdx + 1).toLowerCase() : fullPath.toLowerCase()
  const segmentFrom = lastSlashIdx >= 0 ? word.from + lastSlashIdx + 1 : word.from
  const isAfterSlash = lastSlashIdx >= 0
  let candidates: string[]
  if (!isAfterSlash) {
    candidates = ES_ENDPOINTS
    const indices = await fetchIndices()
    const options = [
      ...fuzzyScored(indices, currentSegment).map(({ item, boost }) => ({ label: item, type: 'variable', boost: boost * 10 + 1 })),
      ...fuzzyScored(candidates, currentSegment).map(({ item, boost }) => ({ label: item, type: 'function', boost: boost * 10 }))
    ]
    options.sort((a, b) => b.boost - a.boost)
    if (!options.length) return null
    return { from: segmentFrom, filter: false, options, getMatch: (c) => subsequenceRanges(currentSegment, c.label) }
  }
  const completedPrefix = fullPath.slice(0, lastSlashIdx)
  const firstSeg = completedPrefix.split('/')[0]
  if (firstSeg.startsWith('_')) {
    candidates = nextPathSegments(ES_ENDPOINTS, completedPrefix)
    if (/^_snapshot$/i.test(completedPrefix)) {
      candidates = [...candidates, ...await fetchSnapshotRepos()]
    } else if (/^_snapshot\/[^/]+$/i.test(completedPrefix)) {
      candidates = ['_all', '_status']
    } else if (/^_snapshot\/[^/]+\/[^/]+$/i.test(completedPrefix)) {
      candidates = ['_restore', '_status']
    }
  } else {
    const slash = completedPrefix.indexOf('/')
    const afterIndex = slash >= 0 ? completedPrefix.slice(slash + 1) : ''
    candidates = nextPathSegments(INDEX_APIS, afterIndex)
  }
  const options = fuzzyScored(candidates, currentSegment).map(({ item, boost }) => ({ label: item, type: 'function', boost: boost * 10 }))
  options.sort((a, b) => b.boost - a.boost)
  if (!options.length) return null
  return { from: segmentFrom, filter: false, options, getMatch: (c) => subsequenceRanges(currentSegment, c.label) }
}

/**
 * Detect enclosing JSON keys from innermost to outer (e.g. ["catalogID", "range", "query"]).
 */
const getParentKeyPath = (doc: string, pos: number): string[] => {
  const before = doc.slice(0, pos)
  const keys: string[] = []
  let depth = 0
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i]
    if (ch === '}' || ch === ']') depth++
    else if (ch === '{' || ch === '[') {
      if (depth === 0) {
        const preceding = before.slice(0, i).trimEnd()
        const keyMatch = preceding.match(/"([^"]+)"\s*:\s*(?:\[\s*)?$/)
        keys.push(keyMatch ? keyMatch[1] : 'root')
      } else {
        depth--
      }
    }
  }
  if (!keys.length) keys.push('root')
  return keys
}

/** Property key of the value the cursor is in (`"type": |` → `type`). */
const getCurrentPropertyKey = (doc: string, pos: number): string => {
  const before = doc.slice(0, pos)
  const re = /"([^"]+)"\s*:\s*/g
  let last = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(before))) {
    const after = before.slice(m.index + m[0].length)
    if (/[{[]/.test(after)) continue
    last = m[1]
  }
  return last
}

const BOOL_VALUES = ['true', 'false']
const INDEX_SETTING_KEYS = [
  'number_of_shards', 'number_of_replicas', 'refresh_interval', 'analysis', 'codec',
  'auto_expand_replicas', 'max_result_window', 'max_inner_result_window',
  'blocks', 'routing', 'lifecycle', 'default_pipeline', 'final_pipeline',
  'mapping', 'merge', 'translog', 'search', 'indexing', 'hidden', 'priority'
]
const MAPPING_ROOT_KEYS = [
  'properties', 'dynamic', '_source', 'runtime', 'dynamic_templates',
  'date_detection', 'numeric_detection'
]
const MAPPING_TYPES = [
  'text', 'keyword', 'match_only_text', 'search_as_you_type', 'wildcard', 'constant_keyword',
  'long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float',
  'date', 'date_nanos', 'boolean', 'binary', 'ip', 'version', 'completion', 'token_count',
  'object', 'nested', 'flattened', 'join', 'alias',
  'geo_point', 'geo_shape', 'dense_vector', 'sparse_vector', 'rank_feature', 'rank_features',
  'integer_range', 'float_range', 'long_range', 'double_range', 'date_range', 'ip_range',
  'histogram', 'aggregate_metric_double', 'percolator', 'semantic_text'
]
const SNAPSHOT_REPO_SETTINGS = [
  'location', 'compress', 'chunk_size', 'max_snapshot_bytes_per_sec', 'max_restore_bytes_per_sec',
  'readonly', 'concurrent_streams',
  'bucket', 'client', 'base_path', 'region', 'protocol', 'path_style_access',
  'server_side_encryption', 'buffer_size', 'canned_acl', 'storage_class',
  'container', 'account', 'url'
]
const INGEST_PROCESSORS = [
  'append', 'bytes', 'circle', 'convert', 'csv', 'date', 'date_index_name', 'dissect',
  'dot_expander', 'drop', 'fail', 'foreach', 'geoip', 'grok', 'gsub', 'html_strip',
  'join', 'json', 'kv', 'lowercase', 'network_direction', 'pipeline', 'redact',
  'remove', 'rename', 'reroute', 'script', 'set', 'sort', 'split', 'trim',
  'uppercase', 'urldecode', 'uri_parts', 'user_agent'
]
const CLUSTER_SETTING_KEYS = [
  'cluster.routing.allocation.enable',
  'cluster.routing.allocation.disk.threshold_enabled',
  'cluster.routing.rebalance.enable',
  'cluster.max_shards_per_node',
  'cluster.blocks.read_only',
  'cluster.blocks.read_only_allow_delete',
  'indices.recovery.max_bytes_per_sec',
  'action.auto_create_index',
  'search.max_buckets'
]
type ApiBodySpec = {
  root: string[]
  keys?: Record<string, string[]>
  values?: Record<string, string[]>
}
const API_BODY_SPECS: Record<string, ApiBodySpec> = {
  snapshot_repository: {
    root: ['type', 'settings', 'verify'],
    keys: { settings: SNAPSHOT_REPO_SETTINGS },
    values: {
      type: ['fs', 's3', 'url', 'gcs', 'azure', 'hdfs', 'source'],
      verify: BOOL_VALUES,
      compress: BOOL_VALUES,
      readonly: BOOL_VALUES,
      path_style_access: BOOL_VALUES,
      server_side_encryption: BOOL_VALUES,
      protocol: ['http', 'https']
    }
  },
  snapshot_create: {
    root: ['indices', 'ignore_unavailable', 'include_global_state', 'partial', 'metadata', 'feature_states'],
    values: {
      ignore_unavailable: BOOL_VALUES,
      include_global_state: BOOL_VALUES,
      partial: BOOL_VALUES
    }
  },
  snapshot_restore: {
    root: [
      'indices', 'ignore_unavailable', 'include_global_state', 'include_aliases', 'partial',
      'rename_pattern', 'rename_replacement', 'index_settings', 'ignore_index_settings', 'feature_states'
    ],
    keys: { index_settings: INDEX_SETTING_KEYS },
    values: {
      ignore_unavailable: BOOL_VALUES,
      include_global_state: BOOL_VALUES,
      include_aliases: BOOL_VALUES,
      partial: BOOL_VALUES
    }
  },
  index_settings: {
    root: ['index', 'settings', 'analysis', ...INDEX_SETTING_KEYS],
    keys: {
      index: INDEX_SETTING_KEYS,
      settings: ['index', ...INDEX_SETTING_KEYS],
      analysis: ['analyzer', 'tokenizer', 'filter', 'char_filter', 'normalizer']
    }
  },
  create_index: {
    root: ['settings', 'mappings', 'aliases'],
    keys: {
      settings: ['index', ...INDEX_SETTING_KEYS],
      index: INDEX_SETTING_KEYS,
      mappings: MAPPING_ROOT_KEYS,
      analysis: ['analyzer', 'tokenizer', 'filter', 'char_filter', 'normalizer']
    },
    values: { dynamic: ['true', 'false', 'strict', 'runtime'] }
  },
  mapping: {
    root: MAPPING_ROOT_KEYS,
    values: { dynamic: ['true', 'false', 'strict', 'runtime'] }
  },
  reindex: {
    root: ['source', 'dest', 'script', 'conflicts', 'size', 'max_docs'],
    keys: {
      source: ['index', 'query', 'remote', 'size', 'slice', '_source', 'runtime_mappings'],
      dest: ['index', 'op_type', 'pipeline', 'routing', 'version_type'],
      remote: ['host', 'username', 'password']
    },
    values: {
      conflicts: ['proceed', 'abort'],
      op_type: ['index', 'create'],
      version_type: ['internal', 'external', 'external_gte']
    }
  },
  update_by_query: {
    root: ['query', 'script', 'conflicts', 'max_docs', 'slices'],
    values: { conflicts: ['proceed', 'abort'] }
  },
  delete_by_query: {
    root: ['query', 'max_docs', 'conflicts', 'slices'],
    values: { conflicts: ['proceed', 'abort'] }
  },
  update: {
    root: ['doc', 'script', 'upsert', 'doc_as_upsert', 'detect_noop', 'scripted_upsert'],
    values: { doc_as_upsert: BOOL_VALUES, detect_noop: BOOL_VALUES, scripted_upsert: BOOL_VALUES }
  },
  cluster_settings: {
    root: ['persistent', 'transient'],
    keys: { persistent: CLUSTER_SETTING_KEYS, transient: CLUSTER_SETTING_KEYS },
    values: {
      'cluster.routing.allocation.enable': ['all', 'primaries', 'new_primaries', 'none'],
      'cluster.routing.rebalance.enable': ['all', 'primaries', 'replicas', 'none']
    }
  },
  template: {
    root: ['index_patterns', 'settings', 'mappings', 'aliases', 'order', 'version'],
    keys: { settings: ['index', ...INDEX_SETTING_KEYS], mappings: MAPPING_ROOT_KEYS }
  },
  index_template: {
    root: ['index_patterns', 'template', 'composed_of', 'priority', 'version', '_meta', 'data_stream', 'allow_auto_create'],
    keys: {
      template: ['settings', 'mappings', 'aliases'],
      settings: ['index', ...INDEX_SETTING_KEYS],
      mappings: MAPPING_ROOT_KEYS
    }
  },
  ingest_pipeline: {
    root: ['description', 'processors', 'on_failure', 'version', '_meta'],
    keys: { processors: INGEST_PROCESSORS, on_failure: INGEST_PROCESSORS }
  },
  slm_policy: {
    root: ['name', 'schedule', 'repository', 'config', 'retention'],
    keys: {
      config: ['indices', 'ignore_unavailable', 'include_global_state', 'partial', 'feature_states'],
      retention: ['expire_after', 'min_count', 'max_count']
    },
    values: { ignore_unavailable: BOOL_VALUES, include_global_state: BOOL_VALUES, partial: BOOL_VALUES }
  },
  api_key: {
    root: ['name', 'expiration', 'role_descriptors', 'metadata']
  },
  analyze: {
    root: ['text', 'analyzer', 'tokenizer', 'filter', 'char_filter', 'field', 'explain', 'attributes', 'normalizer'],
    values: { explain: BOOL_VALUES }
  },
  validate_query: {
    root: ['query', 'explain'],
    values: { explain: BOOL_VALUES }
  },
  aliases: {
    root: ['actions'],
    keys: {
      actions: ['add', 'remove', 'remove_index'],
      add: ['index', 'indices', 'alias', 'aliases', 'filter', 'routing', 'search_routing', 'index_routing', 'is_write_index', 'is_hidden'],
      remove: ['index', 'indices', 'alias', 'aliases', 'must_exist'],
      remove_index: ['index']
    },
    values: { is_write_index: BOOL_VALUES, is_hidden: BOOL_VALUES, must_exist: BOOL_VALUES }
  },
  alias: {
    root: ['filter', 'routing', 'search_routing', 'index_routing', 'is_write_index', 'is_hidden'],
    values: { is_write_index: BOOL_VALUES, is_hidden: BOOL_VALUES }
  },
  count: {
    root: ['query']
  },
  mget: {
    root: ['docs', 'ids'],
    keys: { docs: ['_index', '_id', '_source', 'routing'] }
  },
  bulk: {
    root: ['index', 'create', 'update', 'delete'],
    keys: {
      index: ['_index', '_id', 'routing', 'pipeline', 'require_alias'],
      create: ['_index', '_id', 'routing', 'pipeline', 'require_alias'],
      update: ['_index', '_id', 'routing', 'retry_on_conflict'],
      delete: ['_index', '_id', 'routing']
    }
  },
  forcemerge: {
    root: ['max_num_segments', 'only_expunge_deletes', 'flush'],
    values: { only_expunge_deletes: BOOL_VALUES, flush: BOOL_VALUES }
  }
}

const classifyRequestApi = (path: string): string => {
  const parts = path.replace(/^\//, '').split('/').filter(Boolean)
  const has = (seg: string) => parts.includes(seg)
  if (parts[0] === '_snapshot') {
    if (has('_restore')) return 'snapshot_restore'
    if (parts.length >= 3 && !parts[2].startsWith('_')) return 'snapshot_create'
    return 'snapshot_repository'
  }
  if (parts[0] === '_reindex') return 'reindex'
  if (parts[0] === '_cluster' && parts[1] === 'settings') return 'cluster_settings'
  if (parts[0] === '_template') return 'template'
  if (parts[0] === '_index_template') return 'index_template'
  if (parts[0] === '_ingest') return 'ingest_pipeline'
  if (parts[0] === '_slm') return 'slm_policy'
  if (parts[0] === '_security') return 'api_key'
  if (parts[0] === '_aliases') return 'aliases'
  if (parts[0] === '_analyze' || has('_analyze')) return 'analyze'
  if (has('_update_by_query')) return 'update_by_query'
  if (has('_delete_by_query')) return 'delete_by_query'
  if (has('_update')) return 'update'
  if (has('_mapping')) return 'mapping'
  if (has('_settings')) return 'index_settings'
  if (has('_validate')) return 'validate_query'
  if (has('_alias')) return 'alias'
  if (has('_count')) return 'count'
  if (has('_mget')) return 'mget'
  if (has('_bulk')) return 'bulk'
  if (has('_forcemerge')) return 'forcemerge'
  if (has('_search') || has('_msearch') || parts[0] === '_search') return 'search'
  if (has('_doc') || has('_create')) return 'doc'
  if (parts.length === 1 && parts[0] && !parts[0].startsWith('_')) return 'create_index'
  return 'search'
}

// Context-aware keyword sets
const CONTEXT_KEYWORDS: Record<string, string[]> = {
  root: [
    'query', 'size', 'from', 'sort', '_source', 'timeout', 'track_total_hits',
    'highlight', 'aggs', 'aggregations', 'post_filter', 'rescore',
    'collapse', 'search_after', 'pit', 'min_score', 'explain',
    'version', 'seq_no_primary_term', 'stored_fields', 'script_fields',
    'indices_boost', 'suggest', 'profile', 'ext', 'script'
  ],
  query: [
    'match', 'match_all', 'match_none', 'match_phrase', 'match_phrase_prefix',
    'multi_match', 'query_string', 'simple_query_string', 'combined_fields',
    'term', 'terms', 'terms_set', 'range', 'exists', 'prefix',
    'wildcard', 'regexp', 'fuzzy', 'ids',
    'bool', 'boosting', 'constant_score', 'dis_max', 'function_score',
    'nested', 'has_child', 'has_parent', 'parent_id',
    'geo_bounding_box', 'geo_distance', 'geo_polygon', 'geo_shape',
    'more_like_this', 'percolate', 'rank_feature', 'script_score',
    'wrapper', 'pinned'
  ],
  bool: ['must', 'must_not', 'should', 'filter', 'minimum_should_match', 'boost'],
  multi_match: ['query', 'fields', 'type', 'operator', 'analyzer', 'tie_breaker', 'fuzziness', 'boost'],
  exists: ['field'],
  ids: ['values', 'boost'],
  more_like_this: ['fields', 'like', 'unlike', 'min_term_freq', 'max_query_terms', 'min_doc_freq', 'max_doc_freq', 'minimum_should_match', 'analyzer', 'include', 'boost'],
  geo_distance: ['distance', 'distance_type', 'validation_method', 'ignore_unmapped'],
  query_string: ['query', 'default_field', 'fields', 'default_operator', 'analyzer', 'allow_leading_wildcard', 'fuzziness', 'boost'],
  simple_query_string: ['query', 'fields', 'default_operator', 'flags', 'analyzer', 'boost'],
  function_score: ['query', 'functions', 'score_mode', 'boost_mode', 'max_boost', 'min_score', 'boost'],
  nested: ['path', 'query', 'score_mode', 'ignore_unmapped'],
  has_child: ['type', 'query', 'min_children', 'max_children', 'score_mode'],
  has_parent: ['parent_type', 'query', 'score', 'ignore_unmapped'],
  highlight: ['fields', 'pre_tags', 'post_tags', 'fragment_size', 'number_of_fragments', 'type', 'order'],
  aggs: [],
  aggregations: [],
  _source: ['includes', 'excludes'],
  collapse: ['field', 'inner_hits', 'max_concurrent_group_searches'],
  rescore: ['window_size', 'query'],
  suggest: [],
  script: ['source', 'lang', 'params'],
  settings: INDEX_SETTING_KEYS,
  mappings: MAPPING_ROOT_KEYS,
  properties: [
    'type', 'analyzer', 'normalizer', 'index', 'store', 'fields', 'properties', 'format',
    'ignore_above', 'doc_values', 'copy_to', 'null_value', 'coerce', 'path', 'dims',
    'similarity', 'index_options', 'eager_global_ordinals', 'norms', 'dynamic', 'enabled'
  ]
}

// Params inside `"queryType": { "FIELD": { ... } }` (parent is the field name)
const FIELD_VALUE_PARAMS: Record<string, string[]> = {
  range: ['gte', 'gt', 'lte', 'lt', 'from', 'to', 'format', 'time_zone', 'boost', 'relation'],
  term: ['value', 'boost', 'case_insensitive'],
  match: ['query', 'operator', 'analyzer', 'fuzziness', 'boost', 'lenient', 'prefix_length', 'max_expansions', 'minimum_should_match', 'zero_terms_query'],
  match_phrase: ['query', 'analyzer', 'slop', 'boost', 'zero_terms_query'],
  match_phrase_prefix: ['query', 'analyzer', 'max_expansions', 'slop', 'boost', 'zero_terms_query'],
  prefix: ['value', 'boost', 'case_insensitive', 'rewrite'],
  wildcard: ['value', 'boost', 'case_insensitive', 'rewrite'],
  regexp: ['value', 'flags', 'max_determinized_states', 'boost', 'case_insensitive', 'rewrite'],
  fuzzy: ['value', 'fuzziness', 'prefix_length', 'max_expansions', 'transpositions', 'boost'],
  terms_set: ['terms', 'minimum_should_match_field', 'minimum_should_match_script', 'boost'],
  sort: ['order', 'mode', 'missing', 'unmapped_type', 'nested', 'format', 'numeric_type'],
  geo_bounding_box: ['top_left', 'bottom_right', 'top_right', 'bottom_left', 'top', 'left', 'bottom', 'right'],
  geo_distance: ['lat', 'lon'],
  geo_shape: ['shape', 'indexed_shape', 'relation', 'ignore_unmapped'],
  fields: ['fragment_size', 'number_of_fragments', 'type', 'pre_tags', 'post_tags', 'order', 'highlight_query', 'no_match_size']
}
const AGG_PARAMS: Record<string, string[]> = {
  terms: ['field', 'size', 'order', 'min_doc_count', 'include', 'exclude', 'missing'],
  date_histogram: ['field', 'calendar_interval', 'fixed_interval', 'format', 'time_zone', 'min_doc_count'],
  histogram: ['field', 'interval', 'min_doc_count', 'missing'],
  avg: ['field', 'missing'],
  sum: ['field', 'missing'],
  min: ['field', 'missing'],
  max: ['field', 'missing'],
  stats: ['field', 'missing'],
  cardinality: ['field', 'precision_threshold', 'missing'],
  value_count: ['field'],
  top_hits: ['size', 'from', 'sort', '_source'],
  range: ['field', 'ranges'],
  date_range: ['field', 'format', 'ranges', 'time_zone'],
  nested: ['path'],
  missing: ['field']
}

const AGG_TYPES = [
  'avg', 'sum', 'min', 'max', 'stats', 'extended_stats', 'cardinality',
  'percentiles', 'percentile_ranks', 'value_count', 'top_hits',
  'date_histogram', 'histogram', 'terms', 'range', 'date_range',
  'filter', 'filters', 'global', 'missing', 'nested', 'reverse_nested',
  'composite', 'bucket_sort', 'bucket_script', 'sampler', 'significant_terms'
]

// Query types whose object keys are mapping field names, not DSL keywords
const FIELD_KEY_CONTEXTS = [
  'match', 'match_phrase', 'match_phrase_prefix', 'term', 'terms', 'terms_set',
  'range', 'prefix', 'wildcard', 'regexp', 'fuzzy',
  'sort', 'highlight', 'fields', 'properties',
  'geo_distance', 'geo_bounding_box', 'geo_shape'
]

const getKeywordsForContext = (parentContext: string, apiKind: string): string[] => {
  const spec = API_BODY_SPECS[apiKind]
  if (parentContext === 'root') return spec?.root || CONTEXT_KEYWORDS.root
  if (spec?.keys?.[parentContext]) return spec.keys[parentContext]
  if (CONTEXT_KEYWORDS[parentContext]) return CONTEXT_KEYWORDS[parentContext]
  if (['must', 'must_not', 'should', 'filter', 'post_filter'].includes(parentContext)) {
    return CONTEXT_KEYWORDS.query
  }
  return []
}

const getContextValues = (parentContext: string, parentPath: string[], apiKind: string): string[] | undefined => {
  const spec = API_BODY_SPECS[apiKind]
  if (spec?.values?.[parentContext]) return spec.values[parentContext]
  if ((parentPath.includes('properties') || parentPath.includes('mappings')) && parentContext === 'type') {
    return MAPPING_TYPES
  }
  if (parentPath.includes('highlight') && parentContext === 'type') {
    return ['unified', 'plain', 'fvh']
  }
  return CONTEXT_VALUES[parentContext]
}

const getBodyCompletions = async (
  context: CompletionContext,
  indexName: string,
  requestPath: string
): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/[a-zA-Z_][\w.]*/)
  if (!word && !context.explicit) return null

  const { from, to } = completionRange(context, word)
  const typed = (word?.text || '').toLowerCase()
  const isKeyPosition = isPropertyNamePosition(context)
  const parentPath = getParentKeyPath(context.state.doc.toString(), context.pos)
  const parentContext = parentPath[0] || 'root'
  const grandparentContext = parentPath[1]
  const apiKind = classifyRequestApi(requestPath)
  const spec = API_BODY_SPECS[apiKind]

  if (isKeyPosition) {
    const options: Completion[] = []
    let allowedKeywords: string[] | null = null
    const inAggs = parentPath.includes('aggs') || parentPath.includes('aggregations')
    const specKeys = parentContext === 'root' ? spec?.root : spec?.keys?.[parentContext]
    if (specKeys) {
      allowedKeywords = specKeys
    } else if (inAggs && AGG_PARAMS[parentContext]) {
      allowedKeywords = AGG_PARAMS[parentContext]
    } else if (apiKind === 'doc' && parentContext === 'root' && indexName) {
      const fields = await fetchMappingFields(indexName)
      fuzzyScored(fields, typed).forEach(({ item, boost }) => {
        options.push({ label: item, type: 'property', apply: `"${item}": `, boost: boost * 10, detail: 'field' })
      })
    } else if (FIELD_KEY_CONTEXTS.includes(parentContext)) {
      if (indexName) {
        const fields = await fetchMappingFields(indexName)
        fuzzyScored(fields, typed).forEach(({ item, boost }) => {
          options.push({ label: item, type: 'property', apply: `"${item}": `, boost: boost * 10, detail: 'field' })
        })
      }
      const extra = CONTEXT_KEYWORDS[parentContext]
      if (extra?.length) allowedKeywords = extra
    } else if (grandparentContext && FIELD_KEY_CONTEXTS.includes(grandparentContext)) {
      allowedKeywords = FIELD_VALUE_PARAMS[grandparentContext] || CONTEXT_KEYWORDS[grandparentContext] || []
    } else if ((grandparentContext === 'aggs' || grandparentContext === 'aggregations') && !CONTEXT_KEYWORDS[parentContext]) {
      allowedKeywords = AGG_TYPES
    } else {
      allowedKeywords = getKeywordsForContext(parentContext, apiKind)
    }
    if (allowedKeywords) {
      fuzzyScored(allowedKeywords, typed).forEach(({ item, boost }) => {
        const snippet = ES_KEYWORD_SNIPPETS[item]
        if (snippet) {
          options.push(snippetOption(snippet, { label: item, type: 'keyword', detail: '⟨snippet⟩', boost: boost * 10 + 1 }))
        } else {
          options.push({ label: item, type: 'keyword', apply: `"${item}": `, boost: boost * 10 })
        }
      })
    }
    options.sort((a, b) => b.boost - a.boost)
    if (!options.length) return null
    return { from, to, filter: false, options, getMatch: (c) => subsequenceRanges(typed, c.label) }
  } else {
    const propKey = getCurrentPropertyKey(context.state.doc.toString(), context.pos) || parentContext
    const allowedValues = getContextValues(propKey, parentPath, apiKind)
    if (!allowedValues?.length) return null
    const options = fuzzyScored(allowedValues, typed).map(({ item, boost }) => ({
      label: item,
      type: 'text',
      apply: item === 'true' || item === 'false' ? item : `"${item}"`,
      boost: boost * 10
    }))
    if (!options.length) return null
    return { from, to, filter: false, options, getMatch: (c) => subsequenceRanges(typed, c.label) }
  }
}

export const clearKibanaAutocompleteCache = () => {
  cachedIndices = []
  cachedMappings.clear()
  lastIndicesFetch = 0
  cachedSnapshotRepos = []
  lastSnapshotReposFetch = 0
}
