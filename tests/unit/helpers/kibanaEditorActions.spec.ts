import { describe, expect, it } from 'vitest'
import { buildCurlCommand, getApiReferenceUrl } from '../../../src/composables/components/restkibana/kibanaRequestActions'
import { KibanaRequest } from '../../../src/composables/components/restkibana/kibanaParser'

describe('KibanaEditor helpers', () => {
  it('builds a curl command using the active cluster URL and request body', () => {
    const request: KibanaRequest = {
      method: 'POST',
      path: '_search',
      body: '{"query":{"match_all":{}}}',
      startLine: 0,
      endLine: 1
    }

    expect(buildCurlCommand(request, 'http://localhost:9200')).toBe(
      `curl -X POST "http://localhost:9200/_search" -H "Content-Type: application/json" -d "{\\"query\\":{\\"match_all\\":{}}}"`
    )
  })

  it('maps known Elasticsearch endpoints to their API reference pages', () => {
    expect(getApiReferenceUrl('/my-index/_search')).toBe(
      'https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html'
    )
    expect(getApiReferenceUrl('/_bulk')).toBe(
      'https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html'
    )
    expect(getApiReferenceUrl('/_cat/indices')).toBe(
      'https://www.elastic.co/guide/en/elasticsearch/reference/current/cat.html'
    )
    expect(getApiReferenceUrl('/_cluster/health')).toBe(
      'https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html'
    )
  })
})
