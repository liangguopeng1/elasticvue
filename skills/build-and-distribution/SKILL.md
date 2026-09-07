---
name: build-and-distribution
description: Use when changing Vite/Tauri/Docker/browser-extension builds, VITE_APP_BUILD_MODE, CORS or SSL hints, predefined Docker clusters, nginx, or desktop fetch_reqwest behavior.
---

# Build and Distribution

四种产物共享同一套 Vue 源码，靠环境变量分叉。Git：https://github.com/liangguopeng1/elasticvue.git

## BUILD_MODE

`src/buildConfig.ts` 读 `VITE_APP_BUILD_MODE`（缺省 `other`）：

| 模式 | 路由 | SSL 提示 | CORS 提示 | Tauri | 预置集群 |
|------|------|----------|-----------|-------|----------|
| `other` | history | 是 | 是 | 否 | 否 |
| `docker` | history | 是 | 是 | 否 | 是 |
| `browser_extension` | hash | 是 | 否 | 否 | 否 |
| `tauri` | history | 否 | 否 | 是 | 否 |

还有 `VITE_APP_PUBLIC_PATH`、`VITE_APP_VARIANT`。

## 命令

```bash
npm run dev                 # Vite，host 0.0.0.0，端口 5173
npm run build
npx cross-env VITE_APP_BUILD_MODE=tauri npm run build
npm run tauri:dev           # 前端 5174
npm run tauri:build
docker compose up           # docker/Dockerfile_dev，映射 5173
```

Compose 热重载挂项目目录，Node 镜像参数 `24.15.0`。

## Docker 预置集群

仅 `docker` 模式：`importPredefinedClusters()`。内容为集群 JSON 数组（`name`、`uri`，可选 username/password、apiKey、AWS IAM 字段）。

- 环境变量 `ELASTICVUE_CLUSTERS`
- 或文件挂到镜像内 `/usr/share/nginx/html/api/default_clusters.json`
- 启动脚本：`docker/nginx/99_default_clusters.sh`

## Tauri

- 配置：`src-tauri/tauri.conf.json`（identifier `com.elasticvue.app`）
- Rust：`fetch_reqwest`、`load_file`、`save_file`（`src-tauri/src/lib.rs`）
- 前端 `src/helpers/fetch.ts` 在 `buildConfig.tauri` 时走 `invoke('fetch_reqwest')`，以绕过浏览器 CORS
- 更新端点仍指向 `update.elasticvue.com`（上游桌面更新通道）

## 浏览器扩展

`browser_extension/{chrome,firefox,edge}/manifest.json`。必须用 hash 路由。

## Web CORS

非桌面/扩展时，集群 `elasticsearch.yml` 需要 `http.cors.enabled` 与 `allow-origin`。改 setup 提示时看 `buildConfig.hints` 与 `src/components/setup/`。
