import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'

type RestKibanaState = {
  editorContent: string
}

const DEFAULT_CONTENT = `# Kibana style queries
# Example:
GET _cat/indices

POST bookmarks/_search
{
  "query": {
    "match_all": {}
  }
}
`

export const useRestKibanaStore = () => {
  const connectionStore = useConnectionStore()
  const clusterUuid = connectionStore.activeCluster?.uuid || ''
  return defineStore(`rest-kibana-${clusterUuid}`, {
    state: (): RestKibanaState => ({
      editorContent: DEFAULT_CONTENT
    }),
    persist: {
      pick: ['editorContent'],
      key: `rest-kibana-${clusterUuid}`
    }
  })()
}
