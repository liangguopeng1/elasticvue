import { KibanaRequest } from './kibanaParser'

const ELASTIC_DOCS_BASE_URL = 'https://www.elastic.co/guide/en/elasticsearch/reference/current/'

const normalizeBaseUrl = (url: string) => {
  return url.endsWith('/') ? url : `${url}/`
}

const normalizeRequestPath = (path: string) => {
  const withoutBody = path.split(/\s*\{/)[0].trim()
  return withoutBody.startsWith('/') ? withoutBody.slice(1) : withoutBody
}

export const buildCurlCommand = (request: KibanaRequest, clusterUrl = 'http://localhost:9200') => {
  const requestUrl = `${normalizeBaseUrl(clusterUrl)}${normalizeRequestPath(request.path)}`
  let curl = `curl -X ${request.method} "${requestUrl}"`
  if (request.body) {
    const escaped = request.body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')
    curl += ` -H "Content-Type: application/json" -d "${escaped}"`
  }
  return curl
}

export const getApiReferenceUrl = (path: string) => {
  if (path.includes('_search')) return `${ELASTIC_DOCS_BASE_URL}search-search.html`
  if (path.includes('_bulk')) return `${ELASTIC_DOCS_BASE_URL}docs-bulk.html`
  if (path.includes('_cat')) return `${ELASTIC_DOCS_BASE_URL}cat.html`
  return `${ELASTIC_DOCS_BASE_URL}rest-apis.html`
}
