export const VERSION_NAME = 'stable'
export const SUPPORTED_MAJOR_VERSIONS = ['7', '8', '9']
export const REQUEST_DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
}
export const UUID_HEADER_NAME = 'X-Elasticvue-Uuid'

export const SUPPORTED_COUNTRY_LOCALES: Record<string, ValidLocale> = {
  en: 'en',
  cn: 'cn',
  zh: 'cn',
  'zh-TW': 'tw',
  tw: 'tw',
  fr: 'fr',
  it: 'it',
  ru: 'ru',
  jp: 'jp',
  ko: 'ko',
  kr: 'ko'
}
export type ValidLocale = 'en' | 'cn' | 'fr' | 'it' | 'ru' | 'jp' | 'tw' | 'ko'
export const DEFAULT_LOCALE: ValidLocale = 'en'

export const DEFAULT_DOCUMENT_FIELD_MAX_LENGTH = 200
export const DEFAULT_ROWS_PER_PAGE = [10, 20, 100, 0]
export const DEFAULT_HIDE_INDICES_REGEX = '^\\..*'
export const DEFAULT_HIDE_NODE_ATTRIBUTES_REGEX = '^(ml|xpack|transform)\\.'
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export const MAX_SEARCH_RESULT_WINDOW = 10000
export const DEFAULT_SEARCH_QUERY_OBJ = {
  query: { query_string: { query: '*' } },
  size: 10,
  from: 0,
  sort: [],
  track_total_hits: true
}
export const DEFAULT_SEARCH_QUERY = JSON.stringify(DEFAULT_SEARCH_QUERY_OBJ)
export const DEFAULT_SEARCH_RESULT_COLUMNS = ['_index', '_type', '_id', '_score']
export const DEFAULT_SORTABLE_COLUMNS = ['_index', '_type', '_id', '_score']
export const DEFAULT_PAGINATION = {
  sortBy: '',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: -1
}

export const DEFAULT_CLUSTER_NAME = 'default cluster'
export const DEFAULT_CLUSTER_URI = 'http://localhost:9200'

export const DISTRIBUTIONS = {
  elasticsearch: 'elasticsearch',
  opensearch: 'opensearch'
}

export const REST_QUERY_EXAMPLES = [
  {
    id: 'cat_indices',
    method: 'GET',
    path: '_cat/indices',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-indices.html'
  },
  {
    id: 'cat_aliases',
    method: 'GET',
    path: '_cat/aliases',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-aliases.html'
  },
  {
    id: 'cat_shards',
    method: 'GET',
    path: '_cat/shards',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-shards.html'
  },
  {
    id: 'bulk',
    method: 'POST',
    path: '_bulk',
    body:
      '{ "index" : { "_index" : "test", "_id" : "1" } }\n' +
      '{ "field1" : "value1" }\n' +
      '{ "delete" : { "_index" : "test", "_id" : "2" } }\n' +
      '{ "create" : { "_index" : "test", "_id" : "3" } }\n' +
      '{ "field1" : "value3" }\n' +
      '{ "update" : {"_id" : "1", "_index" : "test"} }\n' +
      '{ "doc" : {"field2" : "value2"} }\n' +
      '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html'
  },
  {
    id: 'create_api_key',
    method: 'POST',
    path: '_security/api_key',
    body: '{"name": "my-api-key","expiration": "1d"}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/security-api-create-api-key.html'
  },
  {
    id: 'flush',
    method: 'POST',
    path: '_flush',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-flush.html'
  },
  {
    id: 'reload_secure_settings',
    method: 'POST',
    path: '_nodes/reload_secure_settings',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster-nodes-reload-secure-settings.html'
  },
  {
    id: 'create_index',
    method: 'PUT',
    path: 'example_test_index',
    body: '{"settings": {"index": {"number_of_shards": 2,"number_of_replicas": 1}}}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-create-index.html'
  },
  {
    id: 'set_writable',
    method: 'PUT',
    path: '_all/settings',
    body: '{"index": {"blocks": {"read_only_allow_delete": "false" } } }',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-blocks.html'
  },
  {
    id: 'delete_index',
    method: 'DELETE',
    path: 'example_test_index',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-delete-index.html'
  },
  {
    id: 'cluster_health',
    method: 'GET',
    path: '_cluster/health',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster-health.html'
  },
  {
    id: 'cat_nodes',
    method: 'GET',
    path: '_cat/nodes',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/cat-nodes.html'
  },
  {
    id: 'search_match_all',
    method: 'POST',
    path: '_search',
    body: '{\n  "query": {\n    "match_all": {}\n  }\n}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html'
  },
  {
    id: 'search_bool',
    method: 'POST',
    path: 'example_test_index/_search',
    body:
      '{\n' +
      '  "track_total_hits": true,\n' +
      '  "query": {\n' +
      '    "bool": {\n' +
      '      "must": [{ "match": { "title": "elasticsearch" } }],\n' +
      '      "filter": [{ "range": { "year": { "gte": 2020, "lte": 2026 } } }]\n' +
      '    }\n' +
      '  },\n' +
      '  "sort": [{ "_score": { "order": "desc" } }]\n' +
      '}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-bool-query.html'
  },
  {
    id: 'search_aggs',
    method: 'POST',
    path: 'example_test_index/_search',
    body:
      '{\n' +
      '  "size": 0,\n' +
      '  "aggs": {\n' +
      '    "genres": {\n' +
      '      "terms": { "field": "genre.keyword" }\n' +
      '    }\n' +
      '  }\n' +
      '}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html'
  },
  {
    id: 'count',
    method: 'POST',
    path: 'example_test_index/_count',
    body: '{\n  "query": {\n    "match_all": {}\n  }\n}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/search-count.html'
  },
  {
    id: 'get_mapping',
    method: 'GET',
    path: 'example_test_index/_mapping',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-get-mapping.html'
  },
  {
    id: 'put_mapping',
    method: 'PUT',
    path: 'example_test_index/_mapping',
    body:
      '{\n' +
      '  "properties": {\n' +
      '    "title": { "type": "text" },\n' +
      '    "created_at": { "type": "date" }\n' +
      '  }\n' +
      '}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-put-mapping.html'
  },
  {
    id: 'index_doc',
    method: 'PUT',
    path: 'example_test_index/_doc/1',
    body: '{\n  "title": "Hello Elasticsearch",\n  "created_at": "2026-01-01"\n}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html'
  },
  {
    id: 'get_doc',
    method: 'GET',
    path: 'example_test_index/_doc/1',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html'
  },
  {
    id: 'reindex',
    method: 'POST',
    path: '_reindex',
    body:
      '{\n' +
      '  "source": { "index": "example_test_index" },\n' +
      '  "dest": { "index": "example_test_index_copy" }\n' +
      '}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-reindex.html'
  },
  {
    id: 'list_snapshots',
    method: 'GET',
    path: '_snapshot',
    body: '',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/get-snapshot-repo-api.html'
  },
  {
    id: 'put_snapshot_repo',
    method: 'PUT',
    path: '_snapshot/es_backup',
    body:
      '{\n' +
      '  "type": "fs",\n' +
      '  "settings": {\n' +
      '    "location": "/mount/backups/es_backup"\n' +
      '  }\n' +
      '}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/put-snapshot-repo-api.html'
  },
  {
    id: 'analyze',
    method: 'POST',
    path: '_analyze',
    body: '{\n  "analyzer": "standard",\n  "text": "The quick brown fox"\n}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-analyze.html'
  },
  {
    id: 'update_by_query',
    method: 'POST',
    path: 'example_test_index/_update_by_query',
    body:
      '{\n' +
      '  "query": { "term": { "status": "old" } },\n' +
      '  "script": {\n' +
      '    "source": "ctx._source.status = \\"new\\"",\n' +
      '    "lang": "painless"\n' +
      '  }\n' +
      '}',
    doc: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-update-by-query.html'
  }
]
