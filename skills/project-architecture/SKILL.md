---
name: project-architecture
description: Use when exploring elasticvue layout, routing, Pinia, bootstrap, cluster connection, or deciding where a change belongs. Also use for onboarding, "how does this app start", or "which folder should this go in".
---

# Project Architecture

elasticvue 是浏览器/桌面端 Elasticsearch GUI。HTTP 调用集中在 Adapter，UI 按功能域拆分。Git：https://github.com/liangguopeng1/elasticvue.git

## 分层

| 路径 | 职责 |
|------|------|
| `src/services/ElasticsearchAdapter.ts` | 全部 ES HTTP，方法名即 API |
| `src/composables/CallElasticsearch.ts` | `useElasticsearchAdapter()`：loading / 错误 / snackbar |
| `src/store/` | Pinia，多数 `persist: true` → localStorage |
| `src/components/<domain>/` | Quasar 页面与对话框 |
| `src/composables/components/<domain>/` | 与组件同名的 `use*` 逻辑 |
| `src/helpers/` | 无 Vue 依赖的纯函数 |
| `src/locales/` | 8 份 i18n JSON |
| `src/db/` | IndexedDB（`idb`），REST 历史/收藏/标签 |
| `src/buildConfig.ts` | 按 `VITE_APP_BUILD_MODE` 切换路由、CORS/SSL 提示、预置集群 |
| `src-tauri/` | 桌面端：Rust `fetch_reqwest`、文件读写、菜单 |

功能域：`indices`、`search`、`shards`、`nodes`、`rest`、`restkibana`、`snapshots`、`repositories`、`indextemplates`、`home`、`setup`、`clusterselection`、`settings`、`shardrecovery`。

## 启动

`src/main.ts`：剪贴板 shim → `migrate()` → `setUuid()` → Docker 时导入预置集群 → Quasar / Pinia / i18n / router → 挂载 `App.vue`。

## 路由

`src/router.ts`。扩展构建用 hash，其余用 history。业务路由挂在 `/cluster/:clusterIndex/`。

无集群 → `welcome`。根路径根据 `useConnectionStore` 跳 home 或 welcome。`rest` 重定向到 `rest_kibana`。

`document.title` 为 `elasticvue | <routeName>`。

## 连接

`useConnectionStore`（`src/store/connection.ts`）保存 `clusters[]` 与 `activeClusterIndex`。鉴权：`none` / `basicAuth` / `apiKey` / `awsIAM`。另有 `BuildFlavor.serverless`。

探测与入库走 `useClusterConnection`。Adapter 用 `cluster.uuid` 区分部分按集群分片的 store（如 rest-kibana）。

## 数据落盘

- Pinia persist：连接、主题、筛选、编辑器内容等
- IndexedDB：`restQueryHistory`、`restQuerySavedQueries`、`restQueryTabs`
- Docker 预置集群：`ELASTICVUE_CLUSTERS` 或 `/api/default_clusters.json`

## 请求链路

组件/composable → `callElasticsearch('methodName', args)` → `ElasticsearchAdapter.call` → `request()` → `fetchMethod`（Web 为 `window.fetch`，Tauri 为 `invoke('fetch_reqwest')`）。

JSON 必须用 `parseJson` / `stringifyJson`（bigint + 去注释）。

## 放代码的位置

- 新 ES API → Adapter 新方法，再从 composable 调用
- 新页面 → `components/<domain>/` + `composables/components/<domain>/` + `router.ts` + 八份 locale
- 可复用无 Vue 逻辑 → `helpers/`
- 跨页 UI 状态 → Pinia；仅 REST 草稿类 → `src/db/`
