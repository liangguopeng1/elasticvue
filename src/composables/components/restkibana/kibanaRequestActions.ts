import { KibanaRequest } from './kibanaParser'

const ELASTIC_DOCS_BASE_URL = 'https://www.elastic.co/guide/en/elasticsearch/reference/current/'

const normalizeBaseUrl = (url: string) => {
  return url.endsWith('/') ? url : `${url}/`
}

const normalizeRequestPath = (path: string) => {
  return path.startsWith('/') ? path.slice(1) : path
}

export const buildCurlCommand = (request: KibanaRequest, clusterUrl = 'http://localhost:9200') => {
  const requestUrl = `${normalizeBaseUrl(clusterUrl)}${normalizeRequestPath(request.path)}`
  let curl = `curl -X ${request.method} "${requestUrl}"`

  if (request.body) {
    curl += ` -H "Content-Type: application/json" -d '${request.body}'`
  }

  return curl
}

export const getApiReferenceUrl = (path: string) => {
  if (path.includes('_search')) return `${ELASTIC_DOCS_BASE_URL}search-search.html`
  if (path.includes('_bulk')) return `${ELASTIC_DOCS_BASE_URL}docs-bulk.html`
  if (path.includes('_cat')) return `${ELASTIC_DOCS_BASE_URL}cat.html`
  return `${ELASTIC_DOCS_BASE_URL}rest-apis.html`
}
