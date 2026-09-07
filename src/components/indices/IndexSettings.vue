<template>
  <q-item clickable @click="dialog = true">
    <q-item-section side>
      <q-icon name="tune" size="xs" />
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ t('indices.index_settings.text') }}</q-item-label>
    </q-item-section>
  </q-item>

  <q-dialog v-model="dialog" transition-duration="100" @show="triggerResize">
    <q-card style="width: 800px; max-width: 80vw">
      <q-card-section class="flex justify-between">
        <div class="flex">
          <h2 class="text-h6 q-my-none flex">
            {{ t('indices.index_settings.heading') }}
          </h2>
        </div>
        <q-btn v-close-popup icon="close" flat round dense />
      </q-card-section>

      <q-separator />

      <q-form @submit="updateSettings">
        <q-card-section>
          <p>{{ t('indices.index_settings.index', { index }) }}</p>
          <p class="text-muted">
            {{ t('indices.index_settings.help') }}
          </p>
          <resizable-container v-model="resizeStore.modalLoaderCodeViewer">
            <code-editor v-model="settings" />
          </resizable-container>
        </q-card-section>

        <q-card-section>
          <q-btn
            id="update_index_settings"
            :disable="requestState.loading || settings.length === 0"
            color="positive"
            :loading="requestState.loading"
            :label="t('defaults.update')"
            type="submit"
            class="q-mr-md"
          />
          <q-btn v-close-popup flat :label="t('defaults.close')" />
        </q-card-section>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useTranslation } from '../../composables/i18n'
import { IndexSettingsProps, useIndexSettings } from '../../composables/components/indices/IndexSettings'
import ResizableContainer from '../shared/ResizableContainer.vue'
import { useResizeStore } from '../../store/resize'

const CodeEditor = defineAsyncComponent(() => import('../shared/CodeEditor.vue'))

const t = useTranslation()
const props = defineProps<IndexSettingsProps>()
const emit = defineEmits(['reload'])
const resizeStore = useResizeStore()

const triggerResize = () => window.dispatchEvent(new Event('resize'))

const { dialog, requestState, settings, updateSettings } = useIndexSettings(props, emit)
</script>
