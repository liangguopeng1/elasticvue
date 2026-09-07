---
name: i18n-locales
description: Use when adding or changing UI copy, vue-i18n keys, language switcher, or any of en/cn/fr/it/ru/jp/tw/ko locale JSON files. Also use when lint fails on missing keys, snake_case, unused keys, or dynamic t() keys.
---

# i18n Locales

八份 locale 必须同构。Git：https://github.com/liangguopeng1/elasticvue.git

文件：`src/locales/{en,cn,fr,it,ru,jp,tw,ko}.json`，在 `src/plugins/vue-i18n.ts` 一次性导入。运行时语言：`useI18nStore().language`，回退 `en`。

国家码映射见 `src/consts.ts` 的 `SUPPORTED_COUNTRY_LOCALES`（`zh`→`cn`，`zh-TW`→`tw`，`kr`→`ko`）。

## 规则（ESLint 强制）

- key：`snake_case`
- 禁止动态 key：`t(variable)` 非法，必须静态 `t('indices.index_settings.heading')`
- 一份 locale 新增 key，其余七份都要有
- 禁止未使用 key（`no-unused-keys`，可 autofix）
- 禁止同 locale 重复 key

组件里：

```ts
import { useTranslation } from '../../composables/i18n'
const t = useTranslation()
t('indices.index_settings.growl', { index: props.index })
```

`useTranslation()` 只是 `useI18n().t`。

## 组织

按功能域嵌套，与目录对应：`indices.*`、`search.*`、`base.app_header.navigation.*`、`defaults.*`。

公共按钮用 `defaults`：`cancel` / `close` / `create` / `update` / `delete` / `success`。

插值用单引号包占位：`Connected to '{activeInstanceName}'`。

## 改文案清单

1. 先改 `en.json` 定 key
2. 同步 cn/tw/fr/it/ru/jp/ko
3. `npm run lint`（会查 missing / unused / snake_case）
4. 不要在模板里留用户可见英文硬编码（`no-raw-text` 目前是 off，仍应走 i18n）
