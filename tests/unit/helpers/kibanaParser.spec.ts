import { describe, it, expect } from 'vitest'
import { parseKibanaRequests, getRequestAtLine, KibanaRequest } from '../../../src/composables/components/restkibana/kibanaParser'

describe('kibanaParser', () => {
  describe('parseKibanaRequests', () => {
    it('should parse a single request without body', () => {
      const input = 'GET /_search'
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0]).toEqual({
        method: 'GET',
        path: '/_search',
        body: '',
        startLine: 0,
        endLine: 0
      })
    })

    it('should parse a single request with JSON body', () => {
      const input = `POST /_search
{
  "query": {
    "match_all": {}
  }
}`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0].method).toBe('POST')
      expect(requests[0].path).toBe('/_search')
      expect(requests[0].body).toContain('"query"')
      expect(requests[0].startLine).toBe(0)
      expect(requests[0].endLine).toBe(5)
    })

    it('should parse multiple requests separated by request lines', () => {
      const input = `GET /_search
POST /_search
{
  "query": {
    "match_all": {}
  }
}
DELETE /index`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(3)
      
      // First request
      expect(requests[0]).toEqual({
        method: 'GET',
        path: '/_search',
        body: '',
        startLine: 0,
        endLine: 0
      })

      // Second request with body
      expect(requests[1].method).toBe('POST')
      expect(requests[1].path).toBe('/_search')
      expect(requests[1].body).toContain('"query"')
      expect(requests[1].startLine).toBe(1)
      expect(requests[1].endLine).toBe(6)

      // Third request
      expect(requests[2]).toEqual({
        method: 'DELETE',
        path: '/index',
        body: '',
        startLine: 7,
        endLine: 7
      })
    })

    it('should handle empty input', () => {
      expect(parseKibanaRequests('')).toEqual([])
      expect(parseKibanaRequests('   ')).toEqual([])
      expect(parseKibanaRequests('\n\n')).toEqual([])
    })

    it('should skip comment lines starting with #', () => {
      const input = `# This is a comment
GET /_search
# Another comment
POST /_search
{
  "query": {}
}
# Final comment`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(2)
      expect(requests[0]).toEqual({
        method: 'GET',
        path: '/_search',
        body: '',
        startLine: 1,
        endLine: 2
      })
      expect(requests[1].method).toBe('POST')
    })

    it('should handle comments with leading whitespace', () => {
      const input = `GET /_search
  # indented comment
POST /_search`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(2)
      expect(requests[0].path).toBe('/_search')
      expect(requests[1].path).toBe('/_search')
    })

    it('should handle various HTTP methods', () => {
      const input = `GET /test
POST /test
PUT /test
PATCH /test
DELETE /test
HEAD /test
OPTIONS /test`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(7)
      expect(requests.map(r => r.method)).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    })

    it('should handle paths with query parameters and fragments', () => {
      const input = 'GET /_search?index=test&pretty=true'
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0].path).toBe('/_search?index=test&pretty=true')
    })

    it('should handle multiline JSON body', () => {
      const input = `POST /_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "test" } }
      ]
    }
  },
  "size": 10
}`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0].body).toContain('"bool"')
      expect(requests[0].body).toContain('"size": 10')
      expect(requests[0].startLine).toBe(0)
      expect(requests[0].endLine).toBe(10)
    })

    it('should trim trailing empty lines from body', () => {
      const input = `POST /_search
{
  "query": {}
}


GET /_search`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(2)
      expect(requests[0].endLine).toBe(3)
      expect(requests[1].startLine).toBe(6)
    })

    it('should handle request with single line JSON body', () => {
      const input = `POST /_search
{"query":{"match_all":{}}}`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0].body).toBe('{"query":{"match_all":{}}}')
    })

    it('should not parse non-request lines as requests', () => {
      const input = `GET /valid
DELETE /another`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(2)
      expect(requests[0].method).toBe('GET')
      expect(requests[1].method).toBe('DELETE')
    })
  })

  describe('getRequestAtLine', () => {
    it('should return request at exact start line', () => {
      const input = `GET /_search
POST /_search
{
  "query": {}
}`
      const requests = parseKibanaRequests(input)
      
      const result = getRequestAtLine(requests, 0)
      expect(result).toEqual(requests[0])
    })

    it('should return request at exact end line', () => {
      const input = `GET /_search
POST /_search
{
  "query": {}
}`
      const requests = parseKibanaRequests(input)
      
      const result = getRequestAtLine(requests, 4)
      expect(result).toEqual(requests[1])
    })

    it('should return request when line is within request range', () => {
      const input = `GET /_search
POST /_search
{
  "query": {}
}
DELETE /index`
      const requests = parseKibanaRequests(input)
      
      expect(getRequestAtLine(requests, 1)).toEqual(requests[1])
      expect(getRequestAtLine(requests, 2)).toEqual(requests[1])
      expect(getRequestAtLine(requests, 3)).toEqual(requests[1])
      expect(getRequestAtLine(requests, 4)).toEqual(requests[1])
    })

    it('should return null when line is outside all requests', () => {
      const input = `GET /_search

POST /_search`
      const requests = parseKibanaRequests(input)
      
      const result = getRequestAtLine(requests, 1)
      expect(result).toBeNull()
    })

    it('should return null when line exceeds all requests', () => {
      const input = `GET /_search
POST /_search`
      const requests = parseKibanaRequests(input)
      
      const result = getRequestAtLine(requests, 100)
      expect(result).toBeNull()
    })

    it('should find correct request when multiple requests exist', () => {
      const input = `GET /first
POST /second
{
  "body": true
}
DELETE /third
PUT /fourth
{
  "data": "test"
}`
      const requests = parseKibanaRequests(input)
      
      expect(getRequestAtLine(requests, 0)?.path).toBe('/first')
      expect(getRequestAtLine(requests, 1)?.path).toBe('/second')
      expect(getRequestAtLine(requests, 2)?.path).toBe('/second')
      expect(getRequestAtLine(requests, 5)?.path).toBe('/third')
      expect(getRequestAtLine(requests, 6)?.path).toBe('/fourth')
      expect(getRequestAtLine(requests, 8)?.path).toBe('/fourth')
    })

    it('should handle empty requests array', () => {
      const result = getRequestAtLine([], 0)
      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle requests with trailing whitespace', () => {
      const input = 'GET /_search   '
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0].path).toBe('/_search')
    })

    it('should handle body with leading/trailing whitespace', () => {
      const input = `POST /_search
{
  "query": {}
}`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(1)
      expect(requests[0].body).toContain('"query"')
    })

    it('should parse consecutive requests with no gap', () => {
      const input = `GET /first
POST /second
DELETE /third`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(3)
      expect(requests[0].endLine).toBe(0)
      expect(requests[1].startLine).toBe(1)
      expect(requests[1].endLine).toBe(1)
      expect(requests[2].startLine).toBe(2)
    })

    it('should handle single request with empty lines before next request', () => {
      const input = `POST /test
{
  "data": "value"
}



GET /next`
      const requests = parseKibanaRequests(input)

      expect(requests).toHaveLength(2)
      expect(requests[0].endLine).toBe(3)
      expect(requests[1].startLine).toBe(7)
    })
  })
})
