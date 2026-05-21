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
              <div class="col-6 q-pl-sm full-height">
                <div class="q-mb-sm">
                  <q-chip v-if="responseStatus" :label="responseStatus" :class="statusClass" />
                  <q-spinner v-if="loading" class="q-ml-sm" />
                </div>
                <code-viewer :value="responseBody" />
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
            <q-item v-for="item in restKibanaStore.history" :key="item.id" clickable @click="useHistoryItem(item)">
              <q-item-section side>
                <q-badge :color="item.status.startsWith('2') ? 'positive' : item.status.startsWith('4') || item.status.startsWith('5') ? 'negative' : 'grey'" :label="item.status || '—'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">
                  <span :class="`http-${item.method}`" class="text-bold q-mr-sm">{{ item.method }}</span>
                  {{ item.path }}
                </q-item-label>
                <q-item-label caption>{{ formatTime(item.timestamp) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat round dense icon="content_copy" size="sm" @click.stop="copyToEditor(item)" />
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
const { responseBody, responseStatus, loading, executeRequest } = useRestKibana()

const maxHistorySize = ref(restKibanaStore.maxHistorySize)

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
  restKibanaStore.editorContent = content
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
