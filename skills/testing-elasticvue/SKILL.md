---
name: testing-elasticvue
description: Use when writing Vitest unit tests, Playwright e2e, data-testid selectors, Elasticsearch mocks, or running npm test:unit / test:e2e / ci for elasticvue.
---

# Testing Elasticvue

单测不启集群；E2E 假定本机有 ES（常见 `localhost:9200`）且 Playwright 自己起 Vite `:5175`。Git：https://github.com/liangguopeng1/elasticvue.git

## 命令

```bash
npm run test:unit
npx vitest run tests/unit/helpers/flatten.spec.ts
npm run test:unit:watch
npm run test:e2e          # Chromium
npm run test:e2e:all      # Chromium + Firefox + WebKit
npx playwright test tests/e2e/tests/pages/home.spec.ts
npm run tsc
npm run ci
```

CI：`.github/workflows/test.yml` 在 `develop` 上跑 `make CI=1 ci`。

## 单元测试

目录：`tests/unit/`。测 helpers、parser、adapter 编码、composable 纯逻辑。

- 风格与生产代码相同（无分号、单引号）
- JSON/Kibana 解析改动必须补 spec（现有：`kibanaParser.spec.ts`、`kibanaEditorActions.spec.ts`）
- Adapter 测 path 编码、chunk、query，不要对真实集群发网

## E2E

- 用例：`tests/e2e/tests/`（按页面）
- 连接注入：`tests/e2e/helpers.ts` 的 `setupClusterConnection`（写 localStorage）
- 多版本 mock：`tests/e2e/mocks/elastic_*/`、`opensearch_2/`
- 选择器：`data-testid` 或稳定 `id`
- `data-testid` 仅开发/测试存在；生产 Vite 会从模板剥掉（`vite.config.mjs` 的 `removeDataTestid`）

新交互：给可点击元素加 `data-testid`，在对应 `tests/e2e/tests/pages/*.spec.ts` 覆盖主路径。

## 验证顺序

1. 相关 `vitest run`
2. `npm run tsc`
3. 改 UI 时按用户规则用浏览器走通，不要只看截图
4. 全量 `npm run ci` 很重；改 parser/helper 至少单测 + tsc
