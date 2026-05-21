import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AuthType, BuildFlavor, useConnectionStore } from '../../src/store/connection'
import { useRestKibanaStore } from '../../src/store/restKibana'
import { useRestKibana } from '../../src/composables/components/restkibana/RestKibana'
import type { KibanaRequest } from '../../src/composables/components/restkibana/kibanaParser'

const { fetchMethodMock, showErrorSnackbarMock } = vi.hoisted(() => ({
  fetchMethodMock: vi.fn(),
  showErrorSnackbarMock: vi.fn()
}))

vi.mock('../../src/helpers/fetch', () => ({
  fetchMethod: fetchMethodMock
}))

vi.mock('../../src/composables/Snackbar', () => ({
  useSnackbar: () => ({
    showErrorSnackbar: showErrorSnackbarMock
  })
}))

const setActiveCluster = () => {
  const connectionStore = useConnectionStore()
  connectionStore.clusters = [
    {
      name: 'default',
      uri: 'http://localhost:9200',
      clusterName: 'default',
      version: '8.0.0',
      majorVersion: '8',
      distribution: 'elasticsearch',
      uuid: 'cluster-1',
      status: 'green',
      flavor: BuildFlavor.default,
      auth: {
        authType: AuthType.none,
        authData: {}
      }
    }
  ]
  connectionStore.activeClusterIndex = 0
}

describe('rest kibana store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setActiveCluster()
    fetchMethodMock.mockReset()
    showErrorSnackbarMock.mockReset()
  })

  it('stores history entries and trims them to max size', () => {
    const store = useRestKibanaStore()

    expect(store.activeTab).toBe('shell')

    store.setMaxHistorySize(1)
    store.addHistory({ method: 'GET', path: '_cat/indices', body: '', status: '200 OK' })
    store.addHistory({ method: 'POST', path: 'bookmarks/_search', body: '{"query":{}}', status: '500 Error' })

    expect(store.maxHistorySize).toBe(1)
    expect(store.history).toHaveLength(1)
    expect(store.history[0]).toMatchObject({
      method: 'POST',
      path: 'bookmarks/_search',
      body: '{"query":{}}',
      status: '500 Error'
    })
    expect(store.history[0].id).toEqual(expect.any(Number))
    expect(store.history[0].timestamp).toEqual(expect.any(Number))
  })
})

describe('useRestKibana', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setActiveCluster()
    fetchMethodMock.mockReset()
    showErrorSnackbarMock.mockReset()
  })

  it('records successful requests in history', async () => {
    fetchMethodMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      ok: true,
      text: () => Promise.resolve('{"ok":true}')
    })

    const store = useRestKibanaStore()
    const { executeRequest, responseBody, responseStatus, responseOk, loading } = useRestKibana()
    const request: KibanaRequest = {
      method: 'POST',
      path: 'bookmarks/_search',
      body: '{"query":{"match_all":{}}}',
      startLine: 0,
      endLine: 1
    }

    await executeRequest(request)

    expect(fetchMethodMock).toHaveBeenCalledWith(
      'http://localhost:9200/bookmarks/_search',
      expect.objectContaining({
        method: 'POST',
        body: '{"query":{"match_all":{}}}'
      })
    )
    expect(responseStatus.value).toBe('200 OK')
    expect(responseBody.value).toBe('{"ok":true}')
    expect(responseOk.value).toBe(true)
    expect(loading.value).toBe(false)
    expect(store.history[0]).toMatchObject({
      method: 'POST',
      path: 'bookmarks/_search',
      body: '{"query":{"match_all":{}}}',
      status: '200 OK'
    })
  })

  it('records network errors in history', async () => {
    fetchMethodMock.mockRejectedValue(new Error('Network Error'))

    const store = useRestKibanaStore()
    const { executeRequest, responseBody, responseStatus, responseOk, loading } = useRestKibana()
    const request: KibanaRequest = {
      method: 'GET',
      path: '_cat/indices',
      body: '',
      startLine: 0,
      endLine: 0
    }

    await executeRequest(request)

    expect(responseStatus.value).toBe('')
    expect(responseBody.value).toBe('// Network Error')
    expect(responseOk.value).toBe(false)
    expect(loading.value).toBe(false)
    expect(showErrorSnackbarMock).toHaveBeenCalledWith({ title: 'Error', body: 'Network Error' })
    expect(store.history[0]).toMatchObject({
      method: 'GET',
      path: '_cat/indices',
      body: '',
      status: 'Error'
    })
  })
})
