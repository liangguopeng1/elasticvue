---
name: elasticsearch-adapter
description: Use when adding or changing Elasticsearch/OpenSearch HTTP APIs, auth, CORS, fetch, JSON bigint, index name encoding, chunked bulk index operations, or serverless-only vs full-cluster routes.
---

# Elasticsearch Adapter

集群请求只经过 `src/services/ElasticsearchAdapter.ts`。Git：https://github.com/liangguopeng1/elasticvue.git

## 调用方式

UI 侧：

```ts
const { requestState, callElasticsearch } = useElasticsearchAdapter()
await callElasticsearch('indexGetSettings', { index })
```

方法名必须是 Adapter 上的真实方法，`ElasticsearchMethod` 由此推出。不要在组件里 `fetch(cluster.uri)`。

连接探测可以直接 `new ElasticsearchAdapter(cluster)`（见 `ClusterConnection.ts`）。

## 加新 API

1. 在 Adapter 上新增方法，路径、HTTP 动词、body 与官方 API 对齐
2. 索引名：`cleanIndexName(...)` 后再拼 path；文档 id：`encodeURIComponent(id)`
3. 批量改多个索引：超过 `MAX_INDICES_PER_REQUEST`（16）走 `callInChunks`
4. GET 的 query 放 `params` 对象，由 `request()` 写入 `URLSearchParams`
5. PUT/POST body 为对象时由 `stringifyJson` 序列化；bulk 等 NDJSON 传字符串
6. `tests/unit/helpers/elasticsearchAdapter.spec.ts` 补覆盖（编码、chunk、query）

Serverless 没有的能力（cluster health、shards、close/open、nodes、snapshot、SLM）放在文件里「default elasticsearch」那一段，UI 用 `connectionStore.serverless` 隐藏。

## request()

`src/helpers/fetch.ts`：`fetchMethod` 在 Tauri 下是 `invoke('fetch_reqwest')`，Web 下是 `window.fetch`。

鉴权：

- `basicAuth` / `apiKey` → `Authorization`（`clusterAuthHeader`）
- `awsIAM` → `aws4fetch` 签名后再发

默认头：`REQUEST_DEFAULT_HEADERS`（`src/consts.ts`），另有 `X-Elasticvue-Uuid`。

HEAD 返回 `response.ok`。非 2xx `reject(response)`。`CallElasticsearch` 再拆 `networkError` / `apiError`。

## JSON

```ts
import { parseJson } from '../helpers/json/parse.ts'
import { stringifyJson } from '../helpers/json/stringify.ts'
```

`parseJson` 会去掉 `//` 注释并用 json-bigint。大整数文档不能走裸 `JSON.parse`。

## 认证与 CORS

Web/Docker 需要集群开启 CORS。桌面端与扩展不依赖浏览器 CORS。SSL 自签：桌面最完整，Web/扩展受限。提示文案由 `buildConfig.hints` 控制。
