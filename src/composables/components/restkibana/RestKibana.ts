import { ref } from 'vue'
import { useConnectionStore } from '../../../store/connection'
import { useSnackbar } from '../../Snackbar'
import { REQUEST_DEFAULT_HEADERS } from '../../../consts'
import { clusterAuthHeader } from '../../../helpers/elasticsearchAdapter'
import { fetchMethod } from '../../../helpers/fetch'
import { KibanaRequest } from './kibanaParser'
import stripJsonComments from 'strip-json-comments'

export const useRestKibana = () => {
  const connectionStore = useConnectionStore()
  const { showErrorSnackbar } = useSnackbar()

  const responseBody = ref('')
  const responseStatus = ref('')
  const responseOk = ref(false)
  const loading = ref(false)

  const executeRequest = async (request: KibanaRequest) => {
    if (!connectionStore.activeCluster || !request) return

    loading.value = true
    responseStatus.value = ''
    responseBody.value = ''

    const method = request.method
    const body = ['GET', 'HEAD'].includes(method) ? null : stripJsonComments(request.body)

    const headers: Record<string, string> = { ...REQUEST_DEFAULT_HEADERS }
    const authHeader = clusterAuthHeader(connectionStore.activeCluster.auth)
    if (authHeader) headers.Authorization = authHeader

    let url = connectionStore.activeCluster.uri
    if (!url.endsWith('/') && !request.path.startsWith('/')) url += '/'
    url += request.path

    try {
      const response = await fetchMethod(url, { method, body, headers })
      responseStatus.value = `${response.status} ${response.statusText}`
      responseOk.value = response.ok
      const text = await response.text()
      responseBody.value = text || ''
    } catch (_e) {
      responseBody.value = '// Network Error'
      showErrorSnackbar({ title: 'Error', body: 'Network Error' })
    } finally {
      loading.value = false
    }
  }

  return {
    responseBody,
    responseStatus,
    responseOk,
    loading,
    executeRequest
  }
}
