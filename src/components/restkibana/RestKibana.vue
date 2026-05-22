<template>
  <div>
    <q-card class="q-mb-md">
      <q-card-section class="q-pb-none">
        <q-tabs v-model="restKibanaStore.activeTab" dense class="text-grey" active-color="primary" indicator-color="primary" align="left" narrow-indicator>
          <q-tab name="shell" label="Shell" />
          <q-tab name="history" label="历史记录" />
          <q-tab name="settings" label="配置" />
        </q-tabs>
      </q-card-section>

      <q-separator />

      <q-tab-panels v-model="restKibanaStore.activeTab" animated>
        <q-tab-panel name="shell" class="q-pa-md">
          <resizable-container v-model="resizeStore.restForm" class="q-mb-md">
            <div class="row full-height" style="min-height: 400px">
              <div class="col-6 q-pr-sm full-height">
                <kibana-code-editor
                  :model-value="restKibanaStore.editorContent"
                  @update:model-value="restKibanaStore.editorContent = $event"
                  @execute="executeRequest"
                />
              </div>
              <div class="col-6 q-pl-sm full-height" style="position: relative">
                <q-spinner v-if="loading" class="absolute-center" style="z-index: 5" size="2em" color="primary" />
                <code-viewer :value="responseBody" />
                <div v-if="responseStatus || responseDuration" class="q-pa-xs" style="position: absolute; bottom: 4px; right: 8px; display: flex; align-items: center; gap: 8px; z-index: 5">
                  <q-chip v-if="responseStatus" :label="responseStatus" :class="statusClass" dense size="sm" />
                  <q-chip v-if="responseDuration" :label="`${responseDuration} ms`" color="grey-3" text-color="grey-8" dense size="sm" icon="schedule" />
                </div>
              </div>
            </div>
          </resizable-container>
          <div class="text-caption text-grey">
            Ctrl+Enter / Cmd+Enter: {{ t('rest_kibana.run_request') }}
          </div>
        </q-tab-panel>

        <q-tab-panel name="history" class="q-pa-md">
          <div class="q-mb-md flex justify-between items-center">
            <span class="text-subtitle1">{{ t('rest_kibana.history.title') }} ({{ restKibanaStore.history.length }})</span>
            <q-btn flat color="negative" :label="t('rest_kibana.history.clear')" icon="delete" size="sm" @click="restKibanaStore.clearHistory()" />
          </div>
          <q-list v-if="restKibanaStore.history.length > 0" bordered separator>
            <q-item v-for="item in restKibanaStore.history" :key="item.id" clickable @click="togglePreview(item.id)">
              <q-item-section side>
                <q-badge :color="item.status.startsWith('2') ? 'positive' : item.status.startsWith('4') || item.status.startsWith('5') ? 'negative' : 'grey'" :label="item.status || '—'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">
                  <span :class="`http-${item.method}`" class="text-bold q-mr-sm">{{ item.method }}</span>
                  {{ item.path }}
                </q-item-label>
                <q-item-label caption>{{ formatTime(item.timestamp) }}</q-item-label>
                <div v-if="previewId === item.id" class="q-mt-sm" @click.stop>
                  <pre class="kibana-history-preview">{{ item.body || '(no body)' }}</pre>
                  <div class="q-mt-xs q-gutter-xs">
                    <q-btn dense flat size="sm" color="primary" icon="edit" label="写入 Shell" @click="useHistoryItem(item)" />
                    <q-btn dense flat size="sm" icon="content_copy" label="追加到 Shell" @click="copyToEditor(item)" />
                  </div>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-center text-grey q-pa-lg">
            {{ t('rest_kibana.history.empty') }}
          </div>
        </q-tab-panel>

        <q-tab-panel name="settings" class="q-pa-md">
          <div class="q-gutter-md" style="max-width: 400px">
            <q-input
              v-model.number="maxHistorySize"
              type="number"
              :label="t('rest_kibana.settings.max_history')"
              outlined
              dense
              :rules="[val => val >= 1 && val <= 9999 || '1 - 9999']"
              @update:model-value="updateMaxHistory"
            />
            <div class="text-caption text-grey">
              {{ t('rest_kibana.settings.max_history_hint') }}
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useTranslation } from '../../composables/i18n'
import { useRestKibana } from '../../composables/components/restkibana/RestKibana'
import { KibanaHistoryItem, useRestKibanaStore } from '../../store/restKibana'
import { useResizeStore } from '../../store/resize'
import KibanaCodeEditor from './KibanaCodeEditor.vue'
import ResizableContainer from '../shared/ResizableContainer.vue'

const CodeViewer = defineAsyncComponent(() => import('../shared/CodeViewer.vue'))
const t = useTranslation()
const restKibanaStore = useRestKibanaStore()
const resizeStore = useResizeStore()
const { responseBody, responseStatus, loading, responseDuration, executeRequest } = useRestKibana()

const maxHistorySize = ref(restKibanaStore.maxHistorySize)
const previewId = ref<number | null>(null)

const togglePreview = (id: number) => {
  previewId.value = previewId.value === id ? null : id
}

const statusClass = computed(() => {
  if (responseStatus.value.match(/^2/)) return 'bg-positive text-white'
  if (responseStatus.value.match(/^3|4/)) return 'bg-orange text-black'
  if (responseStatus.value.match(/^5/)) return 'bg-negative text-white'
  return 'bg-grey'
})

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const useHistoryItem = (item: KibanaHistoryItem) => {
  const content = item.body ? `${item.method} ${item.path}\n${item.body}` : `${item.method} ${item.path}`
  const current = restKibanaStore.editorContent.trimEnd()
  restKibanaStore.editorContent = current ? `${current}\n\n${content}` : content
  restKibanaStore.activeTab = 'shell'
}

const copyToEditor = (item: KibanaHistoryItem) => {
  const content = item.body ? `${item.method} ${item.path}\n${item.body}` : `${item.method} ${item.path}`
  restKibanaStore.editorContent += '\n\n' + content
  restKibanaStore.activeTab = 'shell'
}

const updateMaxHistory = (val: number | string | null) => {
  const num = typeof val === 'string' ? parseInt(val) : val
  if (num && num >= 1 && num <= 9999) {
    restKibanaStore.setMaxHistorySize(num)
  }
}
</script>

<style scoped>
.kibana-history-preview {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  font-family: 'Hack', monospace;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
