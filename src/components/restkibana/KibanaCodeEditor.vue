<template>
  <div class="kibana-code-editor border-2 full-height">
    <div ref="editorEl" class="full-width full-height" />
  </div>
</template>

<script setup lang="ts">
import { ref, Ref, toRef } from 'vue'
import { useKibanaEditor } from '../../composables/components/restkibana/KibanaEditor'
import { KibanaRequest } from '../../composables/components/restkibana/kibanaParser'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'execute': [request: KibanaRequest]
}>()

const editorEl: Ref<HTMLElement | null> = ref(null)
useKibanaEditor(editorEl, { modelValue: toRef(props, 'modelValue'), emit })
</script>

<style scoped>
.kibana-code-editor {
  position: relative;
  overflow: hidden;
}

.kibana-code-editor :deep(.cm-editor),
.kibana-code-editor :deep(.cm-content),
.kibana-code-editor :deep(.cm-gutters) {
  font-family: Consolas, Monaco, monospace;
  font-size: 14px;
}

.kibana-code-editor :deep(.cm-editor .cm-content) {
  font-weight: 400;
}

.kibana-code-editor :deep(.cm-line) {
  position: relative;
  padding-right: 80px;
}

.kibana-code-editor :deep(.cm-tooltip.cm-tooltip-autocomplete) {
  border: 1px solid #d3dae6 !important;
  border-radius: 4px;
  background-color: #fff !important;
  color: #343741 !important;
  box-shadow: 0 2px 8px rgba(15, 25, 45, 0.14);
}

.kibana-code-editor :deep(.cm-tooltip-autocomplete > ul > li[aria-selected]) {
  background-color: #e6edf3 !important;
  color: #343741 !important;
}

.kibana-code-editor :deep(.cm-completionMatchedText) {
  text-decoration: none;
  color: #0077cc;
  font-weight: 700;
}
</style>
