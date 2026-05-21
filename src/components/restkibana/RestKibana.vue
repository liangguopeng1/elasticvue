<template>
  <div>
    <q-card class="q-mb-md">
      <q-card-section class="flex items-center">
        <h1 class="text-h5 q-my-none">{{ t('rest_kibana.heading') }}</h1>
      </q-card-section>

      <q-separator />

      <q-card-section>
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
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useTranslation } from '../../composables/i18n'
import { useRestKibana } from '../../composables/components/restkibana/RestKibana'
import { useRestKibanaStore } from '../../store/restKibana'
import { useResizeStore } from '../../store/resize'
import KibanaCodeEditor from './KibanaCodeEditor.vue'
import ResizableContainer from '../shared/ResizableContainer.vue'

const CodeViewer = defineAsyncComponent(() => import('../shared/CodeViewer.vue'))
const t = useTranslation()
const restKibanaStore = useRestKibanaStore()
const resizeStore = useResizeStore()
const { responseBody, responseStatus, loading, executeRequest } = useRestKibana()

const statusClass = computed(() => {
  if (responseStatus.value.match(/^2/)) return 'bg-positive text-white'
  if (responseStatus.value.match(/^3|4/)) return 'bg-orange text-black'
  if (responseStatus.value.match(/^5/)) return 'bg-negative text-white'
  return 'bg-grey'
})
</script>
