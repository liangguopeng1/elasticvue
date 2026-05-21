import { describe, expect, it } from 'vitest'
import { findRequestLineNumbers } from '../../../src/composables/components/restkibana/kibanaRunWidget'

describe('kibanaRunWidget', () => {
  it('returns zero-based line numbers for each request line', () => {
    const input = `GET /_search
{
  "query": {
    "match_all": {}
  }
}

POST /_bulk
DELETE /test`

    expect(findRequestLineNumbers(input)).toEqual([0, 7, 8])
  })

  it('ignores comments and non-request lines', () => {
    const input = `# comment
  # another comment
foo
PATCH /index/_doc/1
{
  "doc": {
    "name": "demo"
  }
}`

    expect(findRequestLineNumbers(input)).toEqual([3])
  })
})
