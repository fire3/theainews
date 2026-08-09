---
title: "New API 教程：聚合多模型的开源 API 网关与安装配置"
description: "New API 是聚合多厂商大模型的开源 API 网关，支持 OpenAI、Claude、Gemini 格式互转与计费管理，本文介绍其特性与 Docker 部署配置。"
pubDate: 2026-08-07
author: "林晓"
category: "tutorial"
tags: ["New API", "API 网关", "模型聚合", "Docker", "自部署"]
image: "/covers/new-api-gateway-setup.jpg"
imageAlt: "多模型经 New API 网关聚合为统一 API 出口的抽象插画"
---

买了多家模型服务的 API Key，却发现每家的接口格式都不一样：OpenAI 一套、Claude 一套、Gemini 又一套，客户端和代码要分别适配；想给团队统一发额度、看用量、做成本核算，更是无从下手。New API 解决的正是这个问题：它是一个开源的大模型网关，把多家服务商聚合到同一个入口，对外只暴露 OpenAI、Claude、Gemini 兼容的统一接口，同时内置渠道管理、令牌权限、用量统计和计费功能。

## New API 是什么

New API 由 QuantumNous 团队维护，定位是"新一代大模型网关与 AI 资产管理系统"，可以把它理解成一个可以自托管的"AI 中转站"：你在后台添加各家服务商的渠道（OpenAI、Anthropic、Google Gemini、DeepSeek、Azure、Midjourney、Suno 等 30 余家），系统会统一管理这些上游 Key，并按你配置的路由策略把请求分发到对应渠道，最后以统一的接口格式返回给客户端。

项目基于知名开源项目 [One API](https://github.com/songquanpeng/one-api)（MIT 协议）二次开发，采用 AGPLv3 协议开源，主语言是 Go，前端为 React。截至 2026 年 8 月初，[GitHub 仓库](https://github.com/QuantumNous/new-api)已获得超过 4.4 万 Star，最新版本为 v1.0.0-rc.23。官方文档位于 [docs.newapi.pro](https://docs.newapi.pro/zh/docs)，Docker 镜像名为 `calciumion/new-api`。

## 核心能力

**统一接口与格式转换**：平台对外提供标准的 OpenAI 兼容接口（`/v1/chat/completions`、`/v1/embeddings`、`/v1/images/generations`、`/v1/audio/*` 等），也支持 OpenAI Responses、Claude Messages、Google Gemini 原生格式以及 Realtime 实时对话接口。请求还会在格式间自动转换，例如 OpenAI 兼容格式 ⇄ Claude Messages、OpenAI → Gemini、Gemini → OpenAI 兼容格式，让不同生态的客户端都能指向同一个地址。

**智能路由与高可用**：渠道支持加权随机分发、优先级、失败自动重试、连续失败自动禁用；一个渠道可以配置多个 API Key，按轮询或加权随机方式自动切换，单个 Key 失效后自动跳过。用户级别还支持模型限流，防止单个调用方打爆上游额度。

**配额与计费**：支持内部充值与额度分配（易支付、Stripe）、按次/按量/缓存命中成本核算、模型倍率定价、用户分组差异化计费，还能对接兑换码、订阅套餐与邀请返利。OpenAI、Azure、DeepSeek、Claude、Qwen 等渠道支持缓存计费统计，缓存命中可按比例（0–1）打折收费。

**权限与安全**：令牌可以独立设置过期时间、剩余配额、模型限制、IP 白名单和渠道分组；支持账号密码、GitHub、Discord、Telegram、LinuxDO、自定义 OIDC 等多种登录方式，以及 2FA 双因素认证和 Passkey 无密码登录。角色分为普通用户、管理员（Admin）和超级管理员（Root），满足从自用到企业私有化部署的多租户场景。

**数据看板**：内置可视化控制台，可以查看全站调用日志、Token 消耗、渠道响应时间、配额扣减等统计信息，并支持分页与筛选。

## 部署前准备

New API 通过 Docker 发布，官方部署要求如下：

| 组件 | 要求 |
|---|---|
| 本地数据库 | SQLite（默认，Docker 需挂载 `/data` 目录持久化） |
| 远程数据库 | PostgreSQL（生产推荐）或 MySQL ≥ 5.7.8 |
| 容器引擎 | Docker / Docker Compose |
| 系统架构 | 仅支持 64 位系统（amd64 / arm64） |

SQLite 开箱即用、适合体验和测试；个人长期使用或生产环境建议用 PostgreSQL（官方推荐）或 MySQL，并搭配 Redis 做缓存和限流。

## 方式一：Docker Compose 部署（推荐）

仓库自带完整的 `docker-compose.yml`，默认编排了 New API、PostgreSQL 15 和 Redis 三个服务，一条命令即可启动：

```bash
git clone https://github.com/QuantumNous/new-api.git
cd new-api
# 按需修改端口、数据库与 Redis 密码等参数（默认密码仅用于演示，生产必须修改）
nano docker-compose.yml
docker compose up -d
```

启动后访问 `http://服务器IP:3000`，首次打开会自动进入初始化页面，按指引设置管理员账号和密码即可登录。日常运维常用命令：

```bash
docker compose ps          # 查看服务状态
docker compose logs -f     # 实时查看日志
docker compose down        # 停止服务
```

## 方式二：单容器 Docker 部署

不想用 Compose 时，可以直接用 `docker run` 拉起单个容器：

```bash
# SQLite（仅推荐测试）
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# PostgreSQL（生产推荐）
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="postgresql://用户名:密码@数据库地址:5432/数据库名" \
  -e TZ=Asia/Shanghai \
  -v /your/data/path:/data \
  calciumion/new-api:latest

# MySQL（兼容）
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="用户名:密码@tcp(数据库地址:3306)/数据库名" \
  -e TZ=Asia/Shanghai \
  -v /your/data/path:/data \
  calciumion/new-api:latest
```

`-v ./data:/data` 把数据目录挂载到宿主机，避免容器重建后数据丢失。除了 Docker，官方还提供了 1Panel 面板部署、宝塔面板一键安装（应用商店搜索 New-API，面板版本 ≥ 9.2.0）和本地源码开发等方案。

## 关键环境变量

New API 支持从 `.env` 文件读取配置（参考仓库里的 `.env.example`，重命名为 `.env` 即可），也可以在 Docker 启动参数或 Compose 文件中设置。生产环境最常改动的几个变量：

| 变量 | 作用 | 示例 |
|---|---|---|
| `SQL_DSN` | 数据库连接串，不设置则使用 SQLite | `postgresql://root:123456@postgres:5432/new-api` |
| `REDIS_CONN_STRING` | Redis 连接串，用于缓存与限流 | `redis://:密码@redis:6379` |
| `SESSION_SECRET` | 会话签名密钥；多机部署时所有节点必须一致，不能设置为字面量 `random_string` | 随机长字符串 |
| `CRYPTO_SECRET` | 缓存键 HMAC 密钥；共享 Redis 的节点必须相同，默认跟随 `SESSION_SECRET` | 随机长字符串 |
| `TZ` | 时区 | `Asia/Shanghai` |
| `PORT` | 服务监听端口，默认 3000 | `8080` |
| `STREAMING_TIMEOUT` | 流式回复超时（秒），出现空补全时可调大 | `300` |
| `MEMORY_CACHE_ENABLED` | 启用内存缓存（配 Redis 后自动启用） | `true` |
| `GENERATE_DEFAULT_TOKEN` | 新注册用户是否自动生成初始令牌 | `true` |
| `ERROR_LOG_ENABLED` | 是否记录错误日志并在前端展示 | `true` |

其他变量还覆盖全局 API/Web 限流、请求体大小限制、上游模型列表定时同步、Pyroscope 性能分析等，完整清单见官方[环境变量配置指南](https://docs.newapi.pro/zh/docs/installation/config-maintenance/environment-variables)。

## 多机部署要点

需要高可用或横向扩容时，New API 支持一主多从的集群模式。核心要求是：**所有节点共享同一个数据库，并设置相同的 `SESSION_SECRET`**；共享 Redis 的节点还需配置相同的 `CRYPTO_SECRET`。从节点在环境变量中设置 `NODE_TYPE=slave`，并可配置 `FRONTEND_BASE_URL` 将未匹配路由重定向到主节点。Redis 可以所有节点共享、每节点独立、或完全不配置——三种拓扑在会话同步时效和限流语义上略有差异，官方文档有详细对照。

## 接入渠道与开始使用

部署完成后，用管理员账号登录后台，按三步完成配置：

**第一步：添加渠道**。进入「渠道」页面（`/console/channel`），点击「添加渠道」，选择服务商类型（OpenAI、Claude、Gemini、DeepSeek 等），填写渠道名称和 API Key，勾选该渠道支持的模型（或点击「填入默认模型」）。高级配置里可以设置自定义 Base URL、优先级、权重、模型映射（JSON 格式）、参数覆盖，以及连续失败自动禁用。添加后点击「测试」按钮验证渠道可用性。

**第二步：创建令牌**。进入「令牌」页面（`/console/token`），点击「创建令牌」，设置名称、过期时间、剩余配额、模型限制、IP 白名单和分组。令牌 Key 只在创建时完整显示一次，需要立即复制保存。

**第三步：调用 API**。把平台地址作为 `base_url`、令牌作为 `api_key` 填入客户端即可。Python 示例：

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-你的平台令牌",          # 平台颁发的令牌
    base_url="https://你的域名.com/v1", # 平台 API 地址
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

后台还内置了「操练场」（`/console/playground`），不用写代码就能直接选择模型对话，适合快速验证令牌和渠道是否配置成功。

## 合规与许可证提醒

项目官方反复强调：New API 仅面向合法授权的 API 网关、组织内部鉴权、用量统计与私有化部署场景，使用者必须合法取得上游 API Key 并遵守上游服务条款；面向公众提供生成式 AI 服务时，还需自行完成所在司法辖区要求的备案、内容安全、实名、日志留存、税务等合规义务。另外，项目采用 AGPLv3 协议，修改后以网络服务（SaaS）形式对外提供时需按协议开放源代码，如果组织政策不允许，可联系官方咨询商业授权。

## 核心总结

- **聚合与统一**：一个入口接入 30 余家模型服务，对外提供 OpenAI / Claude / Gemini 兼容接口，并支持格式自动互转
- **运维友好**：Docker Compose 一条命令部署，SQLite 开箱即用，生产推荐 PostgreSQL + Redis，支持面板部署与多机集群
- **管理完善**：渠道智能路由、令牌权限、模型限流、用量看板、配额计费一应俱全，适合自用、团队与企业私有化
- **注意合规**：仅用于合法授权场景，遵守上游条款与当地法规；AGPLv3 协议，公开提供服务需注意开源义务

原文与更多资料：[New API GitHub 仓库](https://github.com/QuantumNous/new-api) · [官方文档](https://docs.newapi.pro/zh/docs) · [安装部署指南](https://docs.newapi.pro/zh/docs/installation)
