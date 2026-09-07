---
name: vue-feature-modules
description: Use when adding a page, dialog, table row action, index/search/snapshot feature, or a new cluster-scoped screen in elasticvue. Also use when wiring routes, menus, reload events, or Quasar tables.
---

# Vue Feature Modules

一个功能 = 组件 + 同名 composable +（可选）store + i18n + 路由/菜单。对照 `IndexSettings`。Git：https://github.com/liangguopeng1/elasticvue.git

## 目录配对

| UI | 逻辑 |
|----|------|
| `src/components/indices/IndexSettings.vue` | `src/composables/components/indices/IndexSettings.ts` |
| `src/components/search/SearchDocuments.vue` | `src/composables/components/search/SearchDocuments.ts` |
| `src/components/restkibana/RestKibana.vue` | `src/composables/components/restkibana/*` |

共享控件在 `src/components/shared/`（`CodeEditor`、`CodeViewer`、`ReloadButton`、`TableBottom`、`IndexFilter`、`ResizableContainer`）。

## 对话框行操作

索引行菜单一类：`q-item` 打开 `q-dialog`，提交走 composable，成功 `emit('reload')`。

模式：

1. composable 里 `dialog` ref，`watch(dialog)` 为 true 时加载
2. `callElasticsearch` + `showSnackbar(requestState)`
3. 非法 JSON：`showErrorSnackbar({ title: t('...') })`
4. 代码框外包 `ResizableContainer`，尺寸用 `useResizeStore`

## 新页面

1. `src/components/<domain>/<Page>.vue`
2. `src/composables/components/<domain>/<Page>.ts`
3. `src/router.ts` 加在 `/cluster/:clusterIndex` children
4. `src/components/base/AppHeader.vue` 导航（若需要）
5. 八份 `src/locales/*.json`
6. 需要记住筛选/分页时加 Pinia store 且 `persist: true`

路由 `name` 用 `snake_case`（`index_templates`、`rest_kibana`）。

## 表格

Quasar `q-table`。列定义参考 `src/helpers/tableColumns.ts`。底部分页用 `TableBottom`。默认隐藏系统索引：`DEFAULT_HIDE_INDICES_REGEX`（`^\..*`）。

## 搜索文档

默认查询在 `src/consts.ts` 的 `DEFAULT_SEARCH_QUERY_OBJ`。`from+size` 受 `MAX_SEARCH_RESULT_WINDOW`（10000）限制。结果列与 `_source` flatten 见 `src/helpers/flatten.ts`、`src/helpers/search.ts`。

## 版本

`SUPPORTED_MAJOR_VERSIONS`：`7` / `8` / `9`。OpenSearch 用 `DISTRIBUTIONS.opensearch`。功能随版本变化时先看 `minClusterVersion` / `slmSupport` helpers。
