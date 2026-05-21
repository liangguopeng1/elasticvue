import { ref } from 'vue'
import { useConnectionStore } from '../../../store/connection'
import { useRestKibanaStore } from '../../../store/restKibana'
import { useSnackbar } from '../../Snackbar'
import { REQUEST_DEFAULT_HEADERS } from '../../../consts'
import { clusterAuthHeader } from '../../../helpers/elasticsearchAdapter'
import { fetchMethod } from '../../../helpers/fetch'
import { KibanaRequest } from './kibanaParser'
import stripJsonComments from 'strip-json-comments'

export const useRestKibana = () => {
  const connectionStore = useConnectionStore()
  const restKibanaStore = useRestKibanaStore()
  const { showErrorSnackbar } = useSnackbar()

  const responseBody = ref('')
  const responseStatus = ref('')
  const responseOk = ref(false)
  const loading = ref(false)
  const responseDuration = ref(0)

  const executeRequest = async (request: KibanaRequest) => {
    if (!connectionStore.activeCluster || !request) return

    loading.value = true
    responseStatus.value = ''
    responseBody.value = ''
    responseOk.value = false
    responseDuration.value = 0

    const method = request.method
    const body = ['GET', 'HEAD'].includes(method) ? null : stripJsonComments(request.body)

    const headers: Record<string, string> = { ...REQUEST_DEFAULT_HEADERS }
    const authHeader = clusterAuthHeader(connectionStore.activeCluster.auth)
    if (authHeader) headers.Authorization = authHeader

    let url = connectionStore.activeCluster.uri
    if (!url.endsWith('/') && !request.path.startsWith('/')) url += '/'
    url += request.path

    const startTime = performance.now()

    try {
      const response = await fetchMethod(url, { method, body, headers })
      responseDuration.value = Math.round(performance.now() - startTime)
      responseStatus.value = `${response.status} ${response.statusText}`
      responseOk.value = response.ok
      const text = await response.text()
      responseBody.value = text || ''

      restKibanaStore.addHistory({
        method: request.method,
        path: request.path,
        body: request.body,
        status: responseStatus.value
      })
    } catch (_e) {
      responseDuration.value = Math.round(performance.now() - startTime)
      responseBody.value = '// Network Error'
      showErrorSnackbar({ title: 'Error', body: 'Network Error' })
      restKibanaStore.addHistory({
        method: request.method,
        path: request.path,
        body: request.body,
        status: 'Error'
      })
    } finally {
      loading.value = false
    }
  }

  return {
    responseBody,
    responseStatus,
    responseOk,
    loading,
    responseDuration,
    executeRequest
  }
}
