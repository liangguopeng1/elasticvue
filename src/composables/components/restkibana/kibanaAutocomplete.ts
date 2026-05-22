import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
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
  '_snapshot', '_slm/policy', '_template', '_index_template',
  '_security/api_key', '_tasks', '_ingest/pipeline',
  '_msearch', '_mget', '_field_caps', '_resolve/index'
]

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
const ES_KEYWORD_SNIPPETS: Record<string, string> = {
  'match_all': '"match_all": {}',
  'match_none': '"match_none": {}',
  'track_total_hits': '"track_total_hits": true',
  'match': '"match": {\n    "FIELD": "TEXT"\n  }',
  'match_phrase': '"match_phrase": {\n    "FIELD": "TEXT"\n  }',
  'match_phrase_prefix': '"match_phrase_prefix": {\n    "FIELD": "TEXT"\n  }',
  'multi_match': '"multi_match": {\n    "query": "TEXT",\n    "fields": ["FIELD1", "FIELD2"]\n  }',
  'term': '"term": {\n    "FIELD": "VALUE"\n  }',
  'terms': '"terms": {\n    "FIELD": ["VALUE1", "VALUE2"]\n  }',
  'range': '"range": {\n    "FIELD": {\n      "gte": 10,\n      "lte": 20\n    }\n  }',
  'exists': '"exists": {\n    "field": "FIELD"\n  }',
  'prefix': '"prefix": {\n    "FIELD": "VALUE"\n  }',
  'wildcard': '"wildcard": {\n    "FIELD": "VALUE*"\n  }',
  'regexp': '"regexp": {\n    "FIELD": "PATTERN"\n  }',
  'fuzzy': '"fuzzy": {\n    "FIELD": {\n      "value": "TEXT",\n      "fuzziness": "AUTO"\n    }\n  }',
  'ids': '"ids": {\n    "values": ["ID1", "ID2"]\n  }',
  'bool': '"bool": {\n    "must": [],\n    "should": [],\n    "must_not": [],\n    "filter": []\n  }',
  'nested': '"nested": {\n    "path": "FIELD",\n    "query": {}\n  }',
  'query': '"query": {\n    \n  }',
  'query_string': '"query_string": {\n    "query": "TEXT",\n    "default_field": "FIELD"\n  }',
  'simple_query_string': '"simple_query_string": {\n    "query": "TEXT",\n    "fields": ["FIELD"]\n  }',
  'constant_score': '"constant_score": {\n    "filter": {},\n    "boost": 1.0\n  }',
  'function_score': '"function_score": {\n    "query": {},\n    "functions": []\n  }',
  'dis_max': '"dis_max": {\n    "queries": []\n  }',
  'boosting': '"boosting": {\n    "positive": {},\n    "negative": {},\n    "negative_boost": 0.5\n  }',
  'has_child': '"has_child": {\n    "type": "CHILD_TYPE",\n    "query": {}\n  }',
  'has_parent': '"has_parent": {\n    "parent_type": "PARENT_TYPE",\n    "query": {}\n  }',
  'geo_distance': '"geo_distance": {\n    "distance": "10km",\n    "FIELD": { "lat": 0, "lon": 0 }\n  }',
  'more_like_this': '"more_like_this": {\n    "fields": ["FIELD"],\n    "like": "TEXT",\n    "min_term_freq": 1\n  }',
  'highlight': '"highlight": {\n    "fields": {\n      "FIELD": {}\n    }\n  }',
  'sort': '"sort": [\n    { "FIELD": { "order": "desc" } }\n  ]',
  'aggs': '"aggs": {\n    "NAME": {\n      "terms": { "field": "FIELD" }\n    }\n  }',
  'aggregations': '"aggregations": {\n    "NAME": {\n      "terms": { "field": "FIELD" }\n    }\n  }',
  '_source': '"_source": ["FIELD1", "FIELD2"]',
  'script': '"script": {\n    "source": "SCRIPT",\n    "lang": "painless"\n  }',
  'collapse': '"collapse": {\n    "field": "FIELD"\n  }',
  'rescore': '"rescore": {\n    "window_size": 50,\n    "query": {\n      "rescore_query": {}\n    }\n  }',
  'suggest': '"suggest": {\n    "NAME": {\n      "text": "TEXT",\n      "term": { "field": "FIELD" }\n    }\n  }',
  'date_histogram': '"date_histogram": {\n    "field": "FIELD",\n    "calendar_interval": "month"\n  }',
  'histogram': '"histogram": {\n    "field": "FIELD",\n    "interval": 10\n  }'
}

// Values (non-key strings)
const ES_QUERY_VALUES = [
  'AND', 'OR', 'NOT',
  'asc', 'desc',
  'true', 'false',
  'phrase', 'phrase_prefix',
  'best_fields', 'most_fields', 'cross_fields',
  'all', 'none',
  'AUTO',
  'epoch_millis', 'epoch_second', 'strict_date_optional_time'
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

  // Determine if we're inside a JSON body (between { })
  let isInsideBody = false
  let braceDepth = 0
  for (let i = 0; i < currentLine; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') braceDepth++
      else if (ch === '}') braceDepth--
    }
  }
  if (braceDepth > 0) isInsideBody = true

  // A line is a "request line" context if it already has a method,
  // OR if it's not inside a body block (user might be typing a new method)
  const hasMethod = REQUEST_LINE_REGEX.test(lineText)
  const isRequestLineContext = hasMethod || !isInsideBody

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

  return { isRequestLine: isRequestLineContext, lineText, currentLine, indexName }
}

/**
 * Determine if cursor is in a "property name" position (expects a key)
 * vs a "property value" position (expects a value).
 * Uses the syntax tree from CodeMirror's JSON parser.
 */
const isPropertyNamePosition = (context: CompletionContext): boolean => {
  const node = syntaxTree(context.state).resolveInner(context.pos, -1)
  // In JSON, property names are inside "PropertyName" or at Object level expecting a key
  return node.name === 'Object' || node.name === 'PropertyName' || node.name === '⚠'
}

export const kibanaCompletionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
  // Only trigger on word characters - not on punctuation like comma, colon, braces
  const word = context.matchBefore(/[a-zA-Z_][\w.]*/)
  if (!word && !context.explicit) return null

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
  const typed = word.text.toLowerCase()

  if (!hasMethod) {
    // No method yet - only suggest HTTP methods
    const matchedMethods = HTTP_METHODS.filter(m => fuzzyMatch(typed, m.toLowerCase()))
    return {
      from: word.from,
      filter: false,
      options: matchedMethods.map(m => ({ label: m, type: 'keyword', boost: 2 }))
    }
  }

  // Method already typed - suggest indices and endpoints for the path portion
  // Detect current segment: the part after the last "/"
  const fullPath = word.text
  const lastSlashIdx = fullPath.lastIndexOf('/')
  const currentSegment = lastSlashIdx >= 0 ? fullPath.slice(lastSlashIdx + 1).toLowerCase() : fullPath.toLowerCase()
  const segmentFrom = lastSlashIdx >= 0 ? word.from + lastSlashIdx + 1 : word.from
  const isAfterSlash = lastSlashIdx >= 0

  const matchedEndpoints = ES_ENDPOINTS.filter(ep => fuzzyMatch(currentSegment, ep.toLowerCase()))
  const options = [
    ...matchedEndpoints.map(ep => ({ label: ep, type: 'function', boost: 0 }))
  ]

  // Only show indices before the first slash (i.e. at the start of the path)
  if (!isAfterSlash) {
    const indices = await fetchIndices()
    const matchedIndices = indices.filter(idx => fuzzyMatch(currentSegment, idx.toLowerCase()))
    options.unshift(...matchedIndices.map(idx => ({ label: idx, type: 'variable', boost: 1 })))
  }

  return { from: segmentFrom, filter: false, options }
}

/**
 * Detect the parent key context by scanning backwards from cursor position.
 * Returns the nearest parent key name (e.g. "query", "bool", "aggs").
 */
const getParentKeyContext = (doc: string, pos: number): string => {
  const before = doc.slice(0, pos)
  let depth = 0

  // Walk backwards to find the nearest enclosing key
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i]
    if (ch === '}' || ch === ']') depth++
    else if (ch === '{' || ch === '[') {
      if (depth === 0) {
        // Found the opening brace for our level - find the key before it
        const preceding = before.slice(0, i).trimEnd()
        // Look for "key": pattern
        const keyMatch = preceding.match(/"([^"]+)"\s*:\s*$/)
        if (keyMatch) return keyMatch[1]
        return 'root'
      }
      depth--
    }
  }
  return 'root'
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
  match: ['query', 'operator', 'analyzer', 'fuzziness', 'prefix_length', 'max_expansions', 'lenient', 'zero_terms_query', 'boost'],
  match_phrase: ['query', 'analyzer', 'slop', 'boost'],
  multi_match: ['query', 'fields', 'type', 'operator', 'analyzer', 'tie_breaker', 'fuzziness', 'boost'],
  term: ['value', 'boost'],
  range: ['gte', 'gt', 'lte', 'lt', 'format', 'time_zone', 'boost'],
  query_string: ['query', 'default_field', 'fields', 'default_operator', 'analyzer', 'allow_leading_wildcard', 'fuzziness', 'boost'],
  simple_query_string: ['query', 'fields', 'default_operator', 'flags', 'analyzer', 'boost'],
  function_score: ['query', 'functions', 'score_mode', 'boost_mode', 'max_boost', 'min_score', 'boost'],
  nested: ['path', 'query', 'score_mode', 'ignore_unmapped'],
  has_child: ['type', 'query', 'min_children', 'max_children', 'score_mode'],
  has_parent: ['parent_type', 'query', 'score', 'ignore_unmapped'],
  highlight: ['fields', 'pre_tags', 'post_tags', 'fragment_size', 'number_of_fragments', 'type', 'order'],
  sort: ['order', 'mode', 'missing', 'unmapped_type', 'nested'],
  aggs: [],
  aggregations: [],
  _source: ['includes', 'excludes'],
  collapse: ['field', 'inner_hits', 'max_concurrent_group_searches'],
  rescore: ['window_size', 'query'],
  suggest: [],
  script: ['source', 'lang', 'params'],
  settings: ['number_of_shards', 'number_of_replicas', 'refresh_interval', 'analysis'],
  mappings: ['properties', 'dynamic', '_source'],
  properties: ['type', 'analyzer', 'index', 'store', 'fields', 'properties', 'format']
}

const getKeywordsForContext = (parentContext: string): string[] => {
  // Check for exact context match
  if (CONTEXT_KEYWORDS[parentContext]) {
    return CONTEXT_KEYWORDS[parentContext]
  }
  // For query-type contexts (inside must/should/filter arrays), show query types
  if (['must', 'must_not', 'should', 'filter', 'post_filter'].includes(parentContext)) {
    return CONTEXT_KEYWORDS['query']
  }
  // Default: show all keywords
  return ES_QUERY_KEYWORDS
}

const getBodyCompletions = async (
  context: CompletionContext,
  indexName: string
): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/[a-zA-Z_][\w.]*/)
  if (!word && !context.explicit) return null

  const from = word?.from ?? context.pos
  const typed = (word?.text || '').toLowerCase()
  const isKeyPosition = isPropertyNamePosition(context)
  const parentContext = getParentKeyContext(context.state.doc.toString(), context.pos)

  if (isKeyPosition) {
    // Get context-appropriate keywords
    const allowedKeywords = getKeywordsForContext(parentContext)
    const options = allowedKeywords
      .filter(w => fuzzyMatch(typed, w))
      .map(w => {
        const snippet = ES_KEYWORD_SNIPPETS[w]
        if (snippet) {
          return { label: w, type: 'keyword', apply: snippet, detail: '⟨snippet⟩', boost: 1 }
        }
        return { label: w, type: 'keyword', apply: `"${w}": `, boost: 0 }
      })

    // Add mapping fields as property keys too
    if (indexName) {
      const fields = await fetchMappingFields(indexName)
      fields
        .filter(f => fuzzyMatch(typed, f.toLowerCase()))
        .forEach(f => {
          options.push({ label: f, type: 'property', apply: `"${f}": `, boost: 0 })
        })
    }

    return { from, filter: false, options }
  } else {
    // Suggest values (no colon), fuzzy filtered
    const options = ES_QUERY_VALUES
      .filter(w => fuzzyMatch(typed, w.toLowerCase()))
      .map(w => ({
        label: w,
        type: 'text',
        apply: `"${w}"`
      }))

    return { from, filter: false, options }
  }
}

export const clearKibanaAutocompleteCache = () => {
  cachedIndices = []
  cachedMappings.clear()
  lastIndicesFetch = 0
}
