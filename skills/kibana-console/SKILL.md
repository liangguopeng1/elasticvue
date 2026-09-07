---
name: kibana-console
description: Use when changing the Kibana-style REST console, CodeMirror editor, request parser, autocomplete, decorations, run widget, history, curl export, or rest_kibana route.
---

# Kibana Console

多请求编辑器（Kibana Dev Tools 风格），路由 `rest_kibana`（`/cluster/:id/rest_kibana`）。旧 `rest` 重定向到这里。Git：https://github.com/liangguopeng1/elasticvue.git

## 文件

| 路径 | 职责 |
|------|------|
| `src/components/restkibana/RestKibana.vue` | 页面壳：编辑器 / 响应 / 历史 |
| `src/components/restkibana/KibanaCodeEditor.vue` | CodeMirror 6 |
| `src/composables/components/restkibana/kibanaParser.ts` | 把文本切成请求块 |
| `src/composables/components/restkibana/KibanaEditor.ts` | 编辑器状态与执行 |
| `src/composables/components/restkibana/kibanaAutocomplete.ts` | 方法/路径/DSL 补全 |
| `src/composables/components/restkibana/kibanaDecorations.ts` | 当前请求块高亮 |
| `src/composables/components/restkibana/kibanaRunWidget.ts` | 行内 Run |
| `src/composables/components/restkibana/kibanaRequestActions.ts` | curl、文档链接 |
| `src/store/restKibana.ts` | 按集群 uuid 持久化内容和历史 |
| `src/helpers/parseKibana.ts` | 旧解析入口（改 parser 时两边都看） |

示例查询：`src/components/rest/RestQueryExamples.vue`、`REST_QUERY_EXAMPLES`（`src/consts.ts`）。

## 解析

`parseKibanaRequests`：

- 请求行：`^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)`
- `#` 为注释
- 随后非空行并入 body，直到下一请求行
- `getRequestAtLine` / `getActiveRequestAtLine` 决定当前块

改语法必须同步 `tests/unit/helpers/kibanaParser.spec.ts` 与 `kibanaEditorActions.spec.ts`。

## 执行

经当前集群发 HTTP（与 Adapter 同一套鉴权/fetch）。历史：`useRestKibanaStore().addHistory`，上限 `maxHistorySize`（默认 1000）。store id 为 `rest-kibana-${clusterUuid}`。

`buildCurlCommand` 用当前集群 URI 拼 curl。

## 编辑器约定

- CodeMirror 6 + JSON 语言；Vim 扩展在全局编辑器 composable
- 补全：HTTP 方法、ES 路径、query DSL；字段名只在 `match`/`term`/`range` 等字段上下文出现
- 当前块左侧竖线/背景由 decorations 绘制
- 模态里打开搜索时不要让 ESC 关掉对话框（见 `quasarSearchPanelEscapeExtension`）

## 改动时

1. 先改 parser/actions 的单测
2. 补全与高亮跟 parser 的 `startLine/endLine` 对齐
3. 历史是追加还是覆盖以现有 UX 为准（写入 shell 需显式按钮）
4. 相关 locale：`base.app_header.navigation.rest_kibana` 等
