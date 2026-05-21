<template>
  <div class="kibana-code-editor border-2 full-height">
    <div ref="editorEl" class="full-width full-height" />
  </div>
</template>

<script setup lang="ts">
import { ref, Ref } from 'vue'
import { useKibanaEditor } from '../../composables/components/restkibana/KibanaEditor'
import { KibanaRequest } from '../../composables/components/restkibana/kibanaParser'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'execute': [request: KibanaRequest]
}>()

const editorEl: Ref<HTMLElement | null> = ref(null)
useKibanaEditor(editorEl, { initialValue: props.modelValue, emit })
</script>

<style scoped>
.kibana-code-editor {
  position: relative;
  overflow: hidden;
}

.kibana-code-editor :deep(.cm-line) {
  position: relative;
  padding-right: 80px;
}
</style>
