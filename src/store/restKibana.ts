import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'

export type KibanaHistoryItem = {
  id: number
  method: string
  path: string
  body: string
  status: string
  timestamp: number
}

type RestKibanaState = {
  editorContent: string
  history: KibanaHistoryItem[]
  maxHistorySize: number
  activeTab: string
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
      editorContent: DEFAULT_CONTENT,
      history: [],
      maxHistorySize: 1000,
      activeTab: 'shell'
    }),
    actions: {
      addHistory(item: Omit<KibanaHistoryItem, 'id' | 'timestamp'>) {
        const entry: KibanaHistoryItem = {
          ...item,
          id: Date.now(),
          timestamp: Date.now()
        }
        this.history.unshift(entry)
        if (this.history.length > this.maxHistorySize) {
          this.history = this.history.slice(0, this.maxHistorySize)
        }
      },
      clearHistory() {
        this.history = []
      },
      setMaxHistorySize(size: number) {
        this.maxHistorySize = Math.min(Math.max(size, 1), 9999)
        if (this.history.length > this.maxHistorySize) {
          this.history = this.history.slice(0, this.maxHistorySize)
        }
      }
    },
    persist: {
      pick: ['editorContent', 'history', 'maxHistorySize', 'activeTab'],
      key: `rest-kibana-${clusterUuid}`
    }
  })()
}
