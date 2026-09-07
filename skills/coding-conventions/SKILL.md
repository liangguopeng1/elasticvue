---
name: coding-conventions
description: Use when writing or editing Vue, TypeScript, Pinia, composables, or helpers in elasticvue. Also use before lint, when matching existing style, or when adding a component next to a use* composable.
---

# Coding Conventions

跟现有文件写，不要引入另一套风格。Git：https://github.com/liangguopeng1/elasticvue.git

## 格式

- 无分号、单引号
- 未使用参数/变量/catch：前缀 `_`（如 `_e`、`_unused`）
- `@typescript-eslint/no-explicit-any` 已关闭；能写清类型就写清
- Adapter 动态分发才用 `@ts-expect-error`，不要扩散
- 不要无意义空行；不要删已有注释

## Vue 组件

`<script setup lang="ts">`。模板用 Quasar（`q-btn`、`q-dialog`、`q-table` 等）。

逻辑抽到 `src/composables/`，组件只接线：

```vue
<script setup lang="ts">
import { useTranslation } from '../../composables/i18n'
import { IndexSettingsProps, useIndexSettings } from '../../composables/components/indices/IndexSettings'
const t = useTranslation()
const props = defineProps<IndexSettingsProps>()
const emit = defineEmits(['reload'])
const { dialog, requestState, settings, updateSettings } = useIndexSettings(props, emit)
</script>
```

- 文案：`t('domain.snake_case_key')`，禁止用户可见硬编码（eslint `@intlify/vue-i18n/no-dynamic-keys`）
- 重型编辑器：`defineAsyncComponent(() => import('../shared/CodeEditor.vue'))`
- 成功/失败：`useSnackbar()` 的 `showSnackbar(requestState, { body: t('...') })`
- 危险操作：`askConfirm`（`src/helpers/dialogs.ts`）
- E2E 锚点：`data-testid` 或稳定 `id`（如 `update_index_settings`）

## Composable

- 文件：`src/composables/components/<domain>/<Name>.ts`
- 导出：`useXxx`，props 类型与组件 `defineProps` 共用
- ES：`useElasticsearchAdapter()`，不要自己 new Adapter（连接探测除外）
- 列表页在 composable 里管 filter / pagination / reload

## Pinia

- 文件 `src/store/<name>.ts`，导出 `useXxxStore`
- 需要刷新仍在的状态：`persist: true`
- 连接相关用 `useConnectionStore().activeCluster`，不要另存一份 URI
- 按集群隔离时用 `defineStore(\`name-${clusterUuid}\`)`（见 `restKibana.ts`）

## Helpers

纯函数放 `src/helpers/`。JSON 用 `src/helpers/json/parse.ts` 与 `stringify.ts`。索引名进 URL 前走 `cleanIndexName`。

## 导入

仓库混用带 `.ts` 后缀与无后缀的相对导入。改旧文件时跟该文件现有写法。
