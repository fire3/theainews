---
title: "Docker 开源 docker-agent：用一份 YAML 声明多智能体，并把它推到 OCI 仓库共享"
description: "Docker 开源的 docker-agent 用 YAML 声明模型、工具与子智能体来跑多智能体协作，还能把智能体打包推到 OCI 仓库共享。"
pubDate: 2026-10-08
author: "林晓"
category: "tools"
tags: ["Docker", "docker-agent", "AI Agent", "MCP", "多智能体", "RAG", "YAML", "OCI", "开源项目"]
image: "/covers/2026-10-08-docker-agent.jpg"
imageAlt: "封面：蓝图米白网格底与左侧深藏蓝硬切分栏，左栏白色标题「docker-agent」与「用 YAML 声明多智能体」及两行要点，右栏为方框与折线箭头连成的多智能体编排工程线稿，关键节点以琥珀色标记"
topStory: true
---

<strong>docker-agent</strong> 是 Docker 工程团队开源的一个 AI 智能体构建器与运行时，官方一句话概括为「用声明式 YAML 配置、丰富的工具生态与多智能体编排，构建、运行并共享 AI 智能体」。它本身是一个 Docker CLI 插件，装好之后直接用 `docker agent` 调用，把过去要靠代码串起来的模型、工具和多智能体协作，变成一份可以版本化、可以分享的配置文件。

项目位于 [github.com/docker/docker-agent](https://github.com/docker/docker-agent)，Apache-2.0 许可，用 Go 编写。截至 2026 年 10 月 8 日，仓库有约 4,032 个 star、490 个 fork，提交数超过 1 万，贡献者 109 人，最新版本是 10 月 7 日发布的 <strong>v1.149.0</strong>——而仓库创建于 2025 年 9 月 1 日，也就是说一年出头已经发布了 262 个版本。

## 它解决什么问题

用 LLM 搭智能体的常见做法是写一坨胶水代码：接模型 SDK、注册工具、拼提示词、处理多轮循环。docker-agent 的思路是把这些全部外化成配置——<strong>声明智能体长什么样、能用哪些工具、遇到什么任务该交给谁</strong>，剩下的运行时交给它。

最小的一份配置就能跑起来：

```yaml
agents:
  root:
    model: openai/gpt-5-mini
    description: A helpful AI assistant
    instruction: |
      You are a knowledgeable assistant that helps users with various tasks.
      Be helpful, accurate, and concise in your responses.
    toolsets:
      - type: mcp
        ref: docker:duckduckgo
```

```sh
docker agent run agent.yaml
```

配置默认读取当前目录下的 `docker-agent.yaml`、`.yml` 或 `.hcl`；都没有时会启用一个内置的默认智能体，方便快速试手。除了 YAML，项目也支持 HCL——`examples/` 目录里同一份配置常常给出两种写法。

## 安装：三条路

| 方式 | 做法 |
| --- | --- |
| Docker Desktop | 4.63 及以上版本已预装该插件，直接运行 `docker agent` |
| Homebrew | `brew install docker-agent`，再把二进制符号链接到 `~/.docker/cli-plugins/docker-agent` 即可用 `docker agent` 形式调用 |
| 二进制 | 从 GitHub Releases 下载，同样用符号链接接入插件目录，或直接运行 `docker-agent` |

模型方面，<strong>至少需要配置一个服务商的 API Key</strong>（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`GOOGLE_API_KEY` 等），也可以改用 Docker Model Runner 跑本地模型。官方支持的服务商包括 OpenAI、Anthropic、Gemini、AWS Bedrock、Mistral、xAI、Nebius、Groq、GitHub Models 等。

## 命令不止 run

`docker agent` 的子命令覆盖面相当广，除了最常用的运行，还包括交互式生成配置的 `new`、列出可用模型的 `models`、列出内置工具集的 `toolsets`、诊断凭证来源的 `doctor`，以及五种把智能体暴露出去的方式。

| 命令 | 作用 |
| --- | --- |
| `run` | 启动交互式 TUI；加 `--exec` 变成无界面的一次性执行 |
| `new` | 交互式生成一份新的智能体配置 |
| `share push` / `share pull` | 通过 OCI 仓库共享智能体 |
| `serve api` / `mcp` / `a2a` / `acp` / `chat` | 分别以 HTTP API、MCP、Agent-to-Agent、Agent Client Protocol、OpenAI 兼容 Chat Completions 的形式对外提供服务 |
| `board` | 全屏看板式 TUI，在 tmux 会话与隔离的 git worktree 里并行调度多个智能体 |
| `eval` / `sessions diff` | 对录制的会话跑评测；比较两个会话并定位第一处行为分叉 |
| `sandbox` | 管理共享沙箱设置，目前是持久化的网络白名单 |

TUI 里还有命令面板（Ctrl+K）、可切换的侧栏（Ctrl+B）、跟随终端明暗的主题，以及一个能预览 YAML 的全屏智能体选择器。

## 工具：内置工具集 + MCP

工具通过 `toolsets` 列表声明。内置工具集按用途分成几组：文件与 Shell（filesystem、shell、git、fetch、script 等）、记忆与知识（memory、rag、mcp）、规划与推理（think、todo、plan、calculator 等）、智能体协同（transfer_task、background_agents、background_jobs）、交互（user_prompt、model_picker、openapi、api 等）。用 `docker agent toolsets` 可以列出当前版本支持的全部类型。

<strong>MCP 有三条接入路线</strong>：推荐方式是通过 MCP Gateway 在容器里跑服务（`ref: docker:duckduckgo`，可在 Docker MCP Catalog 里浏览）、本地进程走 stdio、远端服务走 Streamable HTTP 或 SSE。

安全性上，默认情况下有副作用的工具——执行 shell 命令、写文件——需要用户确认；`--yolo` 会全部自动放行，更细的控制交给 `--safety`，它有 strict、balanced、restricted、autonomous 四档，并且可以在配置里用全局的 `runtime.safety` 加每个智能体各自的 `safety` 覆盖来定默认值。

## 多智能体：委派与交接

docker-agent 提供两种编排模式，并且可以在同一份配置里混用：

- <strong>委派（sub_agents）</strong>：父子层级。父智能体把任务交给子智能体，子智能体在一个子会话里拿到一份干净的任务描述，父智能体<strong>阻塞等待它完成</strong>后再继续。适合把任务分派给不同专长的角色。
- <strong>交接（handoffs）</strong>：平级转移，对话留在同一个会话里，下一个智能体能看到完整历史。适合流水线式流程与会话路由。

配了 `sub_agents` 的智能体会自动获得内置的 `transfer_task` 工具，而且这个调用<strong>始终自动放行、不需要用户确认</strong>：

```yaml
agents:
  root:
    model: anthropic/claude-sonnet-4-5
    description: Technical lead coordinating development
    instruction: |
      You are a technical lead managing a development team.
      Analyze requests and delegate to the right specialist.
    sub_agents: [developer, reviewer, tester]
    toolsets:
      - type: think

  developer:
    model: anthropic/claude-sonnet-4-5
    description: Expert software developer
    toolsets:
      - type: filesystem
      - type: shell
```

协调者靠各子智能体的 `description` 决定该派给谁。因为委派是顺序的，需要并行时得另加 `background_agents` 工具集，通过 `run_background_agent` 下发、再用 `list_background_agents` / `wait_background_agents` 轮询与汇合。

两个细节值得注意。第一，`sub_agents` 里可以直接写 OCI 仓库引用（`myorg/agent:tag`），也就是<strong>把别人发布在仓库里的智能体当成自己的子智能体</strong>；用标签引用时每次 `docker agent run` 都会重新解析，钉到 `@sha256:…` 可以省掉这次网络往返。第二，子智能体可以不用 `model`，而是用 `harness:` 块指定 claude-code、codex、opencode 或 pi 这些现成的编码外壳，编排层照旧通过 `transfer_task` 派活。

## RAG：可插拔的知识库

知识库在配置顶层用 `rag:` 声明一次，再由智能体通过 `type: rag` 的工具集引用。检索策略有四种：基于向量相似度的 `chunked-embeddings`、先用 LLM 为每个分块写一段语义摘要再嵌入的 `semantic-embeddings`、经典关键词匹配的 `bm25`，以及把多条策略并行跑再融合结果的混合模式。融合方式默认是 RRF（Reciprocal Rank Fusion，k 取 60），也支持加权与取最大值；融合之后还能去重、截断，以及用模型做一轮重排（rerank 支持 DMR、OpenAI、Anthropic、Gemini）。

```yaml
rag:
  hybrid:
    description: "Technical documentation"
    docs: [./docs, ./some-doc.md]
    strategies:
      - type: chunked-embeddings
        embedding_model: openai/text-embedding-3-small
        database: ./vector.db
        vector_dimensions: 1536
      - type: bm25
        database: ./bm25.db

agents:
  root:
    model: openai/gpt-4o
    toolsets:
      - type: rag
        ref: hybrid
```

存储方面，文档只描述了<strong>本地 SQLite 文件</strong>，每条策略一个 `database:` 路径，没有提到外部向量库集成。索引在后台进行、文件变动会触发重建；`respect_vcs` 默认开启，索引时遵守 `.gitignore`。另外有两处工程细节：工具集启动有 30 秒的等待预算，但索引刻意与它解耦——超时的话这一轮先不给 RAG 工具、索引继续在后台跑，等索引完成后再由后续轮次接管；失败重试采用带上限的指数退避，遇到 429 会立刻停下。

分块默认大小 1500、重叠 75；打开 `code_aware: true` 会用 tree-sitter 保证函数完整，此时分块默认放大到 4000，不过<strong>目前只支持 Go 文件</strong>，其他类型回落到纯文本分块。

## 把智能体当 OCI 制品共享

这是 docker-agent 最有 Docker 味道的一点：智能体配置被打包成 OCI 制品推拉。

```sh
docker agent share push ./agent.yaml docker.io/username/my-agent:latest
docker agent share pull docker.io/username/my-agent:latest
```

`push` 时可以用 `--key` 签名，签名的做法是把 DSSE 信封套在 in-toto Statement v1 上、写进 `io.docker.agent.attestation` 注解，因此能和 cosign 与 in-toto 的工具链互操作；`--encrypt` 还会在清单注解里嵌入一份加密副本。相应地，拉取时会<strong>核对签名所绑定的引用与请求的引用是否一致</strong>，把一个已签名的制品复制到别的仓库或换个标签再用会被拒绝。

## 现状与注意点

- <strong>迭代极快</strong>：仓库 2025 年 9 月创建，一年出头就发布了 262 个版本、超过 1 万次提交，最新 v1.149.0 发布于 2026 年 10 月 7 日。快速迭代的另一面是配置格式与行为仍可能变动。
- <strong>自己吃自己的狗粮</strong>：官方称这个项目就是用 `docker agent run ./golang_developer.yaml` 开发的。
- <strong>默认会收集匿名遥测</strong>，官方文档给出了说明与关闭方式。
- 想用 `docker agent` 这种插件形式，需要 Docker Desktop 4.63 及以上，或手动把二进制符号链接到 CLI 插件目录。
- 需要至少一个模型服务商的凭证；纯本地则可走 Docker Model Runner。

## 核心总结

- <strong>是什么</strong>：Docker 工程团队开源的 AI 智能体构建器与运行时，Go 编写、Apache-2.0，以 `docker agent` 插件形式提供
- <strong>怎么做</strong>：用 YAML（也支持 HCL）声明模型、instruction 与 toolsets，`docker agent run` 即可启动；默认读取当前目录的 `docker-agent.yaml`
- <strong>编排</strong>：`sub_agents` 做父子委派（父阻塞等待，自动获得免确认的 `transfer_task`），`handoffs` 做同会话平级交接，两者可混用；并行需另加 `background_agents`
- <strong>工具</strong>：内置文件、Shell、记忆、规划等工具集，并可通过 MCP Gateway、本地 stdio 或远端 HTTP 接入任意 MCP 服务
- <strong>RAG</strong>：向量、语义、BM25 与混合检索四种策略，支持 RRF 融合与模型重排，存储在本地 SQLite，索引在后台进行
- <strong>共享</strong>：`share push` / `share pull` 把智能体作为 OCI 制品推拉，支持签名（兼容 cosign、in-toto）与加密
- <strong>对外</strong>：除了 TUI，还能以 HTTP API、MCP、A2A、ACP 与 OpenAI 兼容接口暴露，并有看板式并行调度与基于录制会话的评测

参考：

- [docker-agent 仓库](https://github.com/docker/docker-agent)（Docker，Apache-2.0）
- [官方文档](https://docker.github.io/docker-agent/)
- [多智能体：委派与交接](https://docker.github.io/docker-agent/concepts/multi-agent)
- [RAG 配置](https://docker.github.io/docker-agent/tools/rag)
- [CLI 参考](https://docker.github.io/docker-agent/features/cli)
- [示例配置目录](https://github.com/docker/docker-agent/tree/main/examples)
