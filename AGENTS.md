# elasticvue Agent

Elasticsearch / OpenSearch 的免费开源 GUI。本仓库为 fork：<https://github.com/liangguopeng1/elasticvue.git>

上游原项目：cars10/elasticvue。本 fork 的文档、技能与默认 git 地址一律使用上述仓库，不要再写 `github.com/cars10/elasticvue`。

开始任何改动前先读本文件，再按任务加载 `skills/<name>/SKILL.md`。不要凭通用 Vue/ES 经验绕过项目约定。

## 技术栈

Vue 3.5 + TypeScript + Vite 7 + Pinia 3 + Vue Router 5 + Quasar 2 + vue-i18n 11。桌面端为 Tauri v2（Rust）。Node `>=24.15.0`。

发行形态由 `VITE_APP_BUILD_MODE` 决定：`other`（Web）、`docker`、`browser_extension`、`tauri`。详见 `src/buildConfig.ts`。

## 仓库

- Git：https://github.com/liangguopeng1/elasticvue.git
- 默认开发分支：`develop`（PR 打向 develop，不要打向 main/master）
- 当前工作区也可能在 `master`；提交新功能前确认目标分支

## 技能索引

按任务加载对应 skill，不要一次塞进全部正文。

| 任务 | Skill |
|------|--------|
| 弄清目录分层、路由、启动链路 | `skills/project-architecture/SKILL.md` |
| 写/改 Vue、TS、composable、store | `skills/coding-conventions/SKILL.md` |
| 新增或修改 Elasticsearch API 调用 | `skills/elasticsearch-adapter/SKILL.md` |
| 新增页面/对话框/表格功能模块 | `skills/vue-feature-modules/SKILL.md` |
| 改文案、加 i18n key | `skills/i18n-locales/SKILL.md` |
| 写单测、E2E、改测试选择器 | `skills/testing-elasticvue/SKILL.md` |
| Docker / 扩展 / Tauri / CORS / 构建 | `skills/build-and-distribution/SKILL.md` |
| Kibana Console（REST 编辑器） | `skills/kibana-console/SKILL.md` |

## 硬约束

- 无分号、单引号（ESLint：`semi: never`，`quotes: single`）
- i18n key 必须 `snake_case`；`en/cn/fr/it/ru/jp/tw/ko` 八份 locale 必须同步
- 用户可见字符串走 `useTranslation()` / `t('...')`，禁止漏翻
- 组件逻辑放 `src/composables/`，导出 `use*`；Pinia 导出 `use*Store`
- ES 请求只走 `ElasticsearchAdapter` + `useElasticsearchAdapter()`，不要在组件里直接 `fetch` 集群
- JSON 用 `src/helpers/json/parse.ts` 与 `stringify.ts`（bigint + 注释），不要用裸 `JSON.parse/stringify`
- E2E 用 `data-testid`；生产构建会剥掉该属性
- 未使用变量前缀 `_`
- 不要删已有注释；不要加无意义空行

## 常用命令

```bash
npm run dev
npm run tsc
npm run lint
npm run test:unit
npx vitest run tests/unit/<file>.spec.ts
npm run test:e2e
npm run ci
```

开发服务默认 `5173`。Playwright 会再起 `5175`。

## 改动后验证

1. 触及 TS/Vue：`npm run tsc`
2. 触及文案：确认 8 个 locale，再 `npm run lint`
3. 触及 helper / parser：补或跑对应 `tests/unit`
4. 触及 UI：按 `skills/testing-elasticvue` 与用户规则做浏览器验证
