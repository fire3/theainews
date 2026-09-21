---
title: "Google 开源 AX（Agent Executor）：用四个原语调度十亿级智能体任务"
description: "Google 开源的 AX 用四个原语声明式编排智能体：状态存 Redis 而非 etcd，配合 Agent Substrate 实现单集群十亿级任务与亚秒级恢复。"
pubDate: 2026-09-21
author: "林晓"
category: "tools"
tags: ["Agent Executor", "AX", "Google", "Agent Substrate", "Kubernetes", "智能体编排", "Redis", "沙箱隔离", "Antigravity"]
image: "/covers/2026-09-21-google-ax-agent-executor.jpg"
imageAlt: "封面：AX（Agent Executor）把智能体任务声明式编排到集群上的技术主视觉，突出 Task、Workspace、Gateway、Model 四个原语"
topStory: true
---

2026 年 5 月 20 日，Google Cloud 在官方博客发布《Introducing Agent Executor, Google's distributed Agent Runtime》，把内部运行智能体工作负载时踩过的坑做成了一套开源运行时。仓库落在 GitHub 的 [google/ax](https://github.com/google/ax)，官网就是 [agentexecutor.io](https://agentexecutor.io/)，采用 Apache 2.0 协议、Go 编写，目前约 4.5k star。文章的两位作者是软件工程师 Jaana Dogan 与工程总监 Ethan Bao，他们把项目定位得很清楚：这是「面向智能体执行、恢复与分布式部署的开放运行时标准」。

它要解决的具体问题是：<strong>当智能体从几十秒的问答变成跑上数小时的作业之后，传统编排器开始失效</strong>。AX 的做法是把智能体任务抽象成四个很小的声明式原语，把状态从 etcd 挪进 Redis，再把沙箱执行交给另一个开源项目 Agent Substrate。项目仍处于预览阶段，README 顶部挂着明确的警告——「核心概念、协议与规范还在积极调整，稳定版之前大概率会有破坏性变更」。

## 为什么智能体既不是微服务，也不是批处理作业

AX 的动机陈述几乎是整篇文档里最值得读的一段：智能体会累积状态，需要严格的隔离，要调用模型 API 与工具服务器，而且在没人看管的情况下能一直烧钱。它既不是无状态的微服务，也不是跑完就结束的批处理任务——它有很长时间什么都不干，只是在等模型回包、等工具返回、等人点确认。

这三点直接打在 Kubernetes 的软肋上。标准 Kubernetes 是为「几千个长期运行的服务」优化的，而智能体产生的是「数百万次亚秒级工具调用」的噪声；更要命的是，如果为了保住等待中的沙箱而一直占着算力，成本会失控，而原生 Kubernetes 又不支持亚秒级的挂起与恢复（suspend/resume）。

所以 AX 的目标写得很直白：单集群跑十亿级任务，每个任务是一个轻量 actor，空闲时被检查点、挂起，需要时在一秒内恢复，几十个任务共享同一批 worker 资源——<strong>只在智能体真正思考与执行代码时付费</strong>。

## 四个原语，一条命令

AX 对外的全部接口就是四个 `ax.io/v1alpha1` 资源，加上一个刻意做成 `kubectl` 形状的 CLI。所有资源都活在 atespace 里（默认叫 `default`），一个 atespace 可以理解为智能体任务的租户边界。

| 原语 | 解决什么 |
|---|---|
| `Task` | 隔离执行的最小单位：镜像、命令、CPU/内存的 requests 与 limits、env、gateway 引用 |
| `Workspace` | 把「准备环境」变成声明式：git 仓库、MCP server、skill 包，甚至可以只写一句自然语言的 goal |
| `Gateway` | 网络边界：任务对外暴露的 listener，以及出站主机的显式白名单 |
| `Model` | 集中配置：调哪家 provider、哪个 model、参数与 API key 放在哪个 Secret 里 |

`Model` 是四个里最容易被误解的一个：它不是一个模型，而是一份命名过的模型配置。把它做成资源的意义在于——轮换密钥、切换模型版本、收紧一个参数，都变成一次 `ax apply`，而不必去每个任务定义里翻找。AX 自己的组件也会读它，比如把 workspace 的 goal 交给智能体去规划环境时。

官网首页给出的最小例子只有两份文档：

```yaml
apiVersion: ax.io/v1alpha1
kind: Workspace
metadata:
  name: golang
spec:
  git:
    - repo: https://github.com/golang/go.git
      branch: "my-fix"
---
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: test
spec:
  workspaces:
    - name: golang
      goal: "Ensure that Go tool chain is available and is built from source"
  debug: true   # 打开后才能 ax ssh 进去
```

`ax apply -f task.yaml` 之后，`ax watch task test` 会把相位与条件的变化实时推给你，`ax ssh test -- ls /workspace` 能直接钻进沙箱看智能体在干什么，`ax suspend` / `ax resume` 则负责把它检查点、暂停、再捡回来。

![AX 的四个原语与任务生命周期：Task 负责隔离执行、Workspace 负责预热工作区、Gateway 负责网络边界、Model 负责集中配置；任务在 Pending、Running、Suspended、Terminating 之间流转，由三个条件驱动](/images/ax/primitives.svg)

### 生命周期：相位只是概括，细节全在条件里

`status.phase` 是一句话总结（`Pending`、`Running`、`Suspended`、`Terminating`……），要等的东西是条件：

- `WorkspaceReady`：每个 workspace 都准备完毕（克隆、技能路径、MCP 配置，以及 goal 引导），此后一直为 True；
- `GatewayReady`：网关声明的网络策略已经落到沙箱上；
- `Ready`：任务在跑且 `WorkspaceReady` 为 True——这才是真正该等的那个。

挂起会把 `Ready` 置为 False（原因是 `TaskSuspended`），恢复时再置回来；删除会让任务进入 `Terminating`，控制器拆完沙箱才真正移除记录，`ax delete` 会一直阻塞到那一刻。这套相位与条件的建模方式，熟悉 Kubernetes 的人几乎不需要重新学。

## 控制面：为什么状态不放 etcd

整份设计文档里最硬核的一段，是 AX 解释「为什么不用 CRD」。把数百万个短生命周期任务塞进 Kubernetes 自定义资源，会把 etcd 逼出舒适区：单库存储只有个位数 GB，写入速率很快成为瓶颈，整个控制面随之退化。

AX 的替代方案是把对象状态放进 Redis，并用 Redis Streams 充当 API server 与控制器之间的工作队列：

![AX 控制面架构：ax CLI 提交 YAML，无状态的 ax-server 校验后写入 Redis 并发布事件，ax-controller 通过 Redis Streams 消费任务，再用 gRPC 控制 Agent Substrate 供给 atespace、创建与激活 actor、分配 worker 并下发 egress 策略](/images/ax/architecture.svg)

四个二进制各司其职：

- `ax`：开发者 CLI，负责应用 manifest、观察资源、为集群建隧道（隧道状态存在 `~/.ax/tunnels`，并跟随 `kubectx` 上下文）；
- `ax-server`：无状态的 gRPC API，监听 8080，校验 manifest、落库到 Redis、发布事件；
- `ax-controller`：调和 worker，从 Stream 里 `XREADGROUP` 取任务，向 Agent Substrate 申请 atespace 与 actor，下发 egress 策略——加副本即扩容；
- `ax-task-runner`：每个任务容器里的 PID 1 入口。

协议层有一处值得注意的细节：manifest 是由**客户端**解析的，`ax apply` 把它转成类型化的 gRPC 请求，服务器端从不接收原始 YAML。控制面暴露 `ax.v1alpha1.AX` 服务，健康检查则是同端口上的普通 HTTP `GET /healthz`。

## 沙箱里到底发生了什么

这才是 AX 与「直接跑个容器」最本质的区别。控制器从不拿 `spec.command` 当容器入口，而是固定启动 `/usr/local/bin/ax-task-runner`，把 `Task` 与所有绑定的 `Workspace` 通过两个环境变量交给它。

![沙箱启动时序：runner 作为 PID 1 分五步启动，读取 Task 与 Workspace、在 80 端口起元数据守护进程、首次准备每个 workspace、启动并监督 spec.command，并在命令结束后继续存活](/images/ax/sandbox-boot.svg)

默认 runner 的行为可以精确地列出来：

1. 读取 `AX_TASK_YAML` 与 `AX_WORKSPACES_YAML`（后者是多文档流，每份文档一个 Workspace）；
2. 在 80 端口起一个元数据与 guest 管理守护进程，同一端口同时说 HTTP/1.1 与 h2c；
3. **首次启动时**按绑定顺序准备每个 workspace：克隆 git、建好技能目录；带 `goal` 的绑定会把目标交给 Antigravity 智能体补齐工具链与依赖，默认给 10 分钟（`AX_BOOTSTRAP_TIMEOUT` 可调）。准备只做一次，靠持久卷上的标记文件跳过重复克隆——否则 resume 会把智能体的状态重新克隆掉；
4. 以第一个 workspace 为工作目录启动 `spec.command`，环境里注入 `AX_METADATA_URL` 与 `spec.env`，并放进独立进程组；
5. 命令退出后 runner 继续存活。因为它是 PID 1，它活着容器才活着，元数据服务才不会消失、`ax ssh` 才仍然可用；命令的退出码只会被写进日志，控制面目前并不回读。

任务可以通过四个端点内省自己，完全不需要 SDK：`/healthz` 永远 200，`/readyz` 在工作区就绪前返回 503（控制器正是轮询它来置 `WorkspaceReady`），`/metadata/v1alpha1/ax/task` 回吐当前任务的完整 spec 与 status，`/metadata/v1alpha1/ax/workspaces` 回吐全部绑定。容器里一句 `curl -s "$AX_METADATA_URL/metadata/v1alpha1/ax/task"` 就能拿到自己的定义。

安全上有一道明确的闸门：允许任意进程执行与文件读写的能力（进程服务、文件系统服务）只有在 `spec.debug: true` 时才通过 gRPC 开放，默认关闭，而且 `ax ssh` 会直接拒绝连接没开启的任务。停机路径也很干净——`SIGTERM` 转发给命令的进程组，等 10 秒，再把剩下的 `SIGKILL`。

`/workspace` 这个持久卷是整个模型里唯一跨 suspend/resume 存活的东西：恢复后你拿到同一批文件，但换了一棵全新的进程树。

## 网络：没有 Service，也没有 Ingress

任务不会拿到自己的 Kubernetes Service 或 Ingress。所有到达任务的请求都要穿过 Agent Substrate 的 atenet 路由器，它只读一个 header：`ate-target-actor`，取值是 `<atespace>/<task>`。路由器把 actor 解析到它所在的 worker，如果它当时是挂起的，就**先恢复再代理**；`Host` 与 `:authority` 原样留给应用自己。

从集群内访问就是加一个 header 打 Service DNS；从本机访问则先 `kubectl port-forward svc/atenet-router`，再照同样的方式发请求。gRPC 场景下这个 header 走 outgoing metadata，这也正是 `ax ssh` 抵达沙箱内 guest services 的方式。

出站方向由 `Gateway` 的 egress allowlist 管。仓库里默认示例放行的是 `*:443`（注释里写着「生产环境请收紧」），真实用法应该是收敛到「你的模型服务商 + 你的代码托管」这类显式主机。Agent Substrate 侧还支持通过 MITM 拦截往出站请求里注入凭据，这样密钥不必进沙箱。

## 底座是 Agent Substrate：把 actor 复用起来

AX 自己不做沙箱，它跑在 [Agent Substrate](https://github.com/agent-substrate/substrate) 之上。后者的设计前提很朴素：智能体这类应用绝大部分时间是空闲的，所以可以把一大批 actor 映射到一小撮「就绪」的 worker 上做高密度复用。

它给出的数字很具体：比标准容器运行时高 10 倍的沙箱密度，**低于 500 毫秒的恢复**，每秒 500 次以上的挂起/恢复激活，以及零信任的内核与网络隔离（支持 gVisor 与 microVM 两类沙箱）。官方那段演示把约 250 个状态化 actor 压到 8 个物理 pod 上跑，展示了 30 倍以上的超售。底座本身建立在 Kubernetes 之上，用 Pod 做 worker 生命周期管理，但自己接管了面向智能体的调度与控制，以换取更低延迟。

需要留意的是，Agent Substrate 的 README 明确写着「这不是 Google 官方支持的产品」，且处于早期开发阶段、API 几乎必然会变；AX 也继承了同样的预览性质。两者是配套发布的关系，Agent Substrate 的文档里把 AX 列为「在底座上构建安全、超大规模智能体 harness」的示例项目。

在生态兼容性上，AX 与底座都刻意保持 harness 无关：官方提到可以混搭 Antigravity、Google 自研的前沿智能体、你自己在 Gemini API 上托管的智能体，以及用 LangChain/LangGraph、ADK 或 A2A 协议构建的自定义智能体。语言层面的收尾在 `Agent Substrate` 的支持列表里也能看到：ADK、LangChain、Claude Code、Codex、Antigravity、MCP server 都在列。CNCF 沙箱项目 kagent 也已接入底座。

## 现状、取舍与局限

从代码与文档里能读出的克制之处，比营销话术更值得记录：

- **接口仍在剧烈变动。** `ax.proto` 里留着三处 `reserved`：`TaskSpec` 的字段 1（曾经叫 `goal`）、字段 9（曾经叫 `policies`，预算与审批配置，「暂时移除」），以及 `ModelSpec` 的字段 3–5（原本是强类型的 `temperature`、`max_tokens`、`system_instruction`，现在改成自由格式的 `parameters` map）。字段被 reserve 而不是复用编号，说明作者在为未来的兼容留后路。
- **schema 里已经预留了但暂未启用的能力。** `TaskStatus` 里有 `pending_approval`（人工审批）与 `usage`（prompt/completion token 统计）两个消息，对应「人在环」与成本核算这两件生产环境迟早要做的事。
- **换掉 etcd 不等于不要 Kubernetes。** 部署仍然需要一个 Kubernetes 集群、`ko`、一个集群能拉的镜像仓库，以及可达的 Agent Substrate 控制 API（集群内默认 `api.ate-system.svc.cluster.local:443`），全部落在 `ax-system` 命名空间。
- **runner 是可替换的，但契约必须守住。** 你可以基于默认镜像加工具，也可以 import `github.com/google/ax/runner` 自己调 `runner.Run`，甚至可以换语言重写——代价是得自己实现 `/readyz` 语义、幂等准备、进程组信号转发这些细节；镜像里必须有 `/usr/local/bin/ax-task-runner`，哪怕它只是个包装脚本。
- **控制面读不到命令的退出码。** 这是一个当前明确的缺口：任务的成败要靠智能体自己上报，或者从日志里看。

## 核心总结

- **一句话**：AX 把「智能体是一种新工作负载」这个判断，落成四个声明式原语加一个不跑在 etcd 上的控制面
- **四个原语**：`Task` 隔离执行、`Workspace` 预热环境、`Gateway` 收口网络、`Model` 集中配置；全部是 `ax.io/v1alpha1` manifest，一次 `ax apply` 生效
- **控制面**：无状态 `ax-server` 收请求写 Redis，`ax-controller` 用 Redis Streams 消费并调和，`ax-task-runner` 在容器里当 PID 1——换掉 etcd 是为了不被数百万短生命周期对象拖垮
- **沙箱契约**：固定入口 + `AX_TASK_YAML` 传参 + `/readyz` 就绪探针 + 命令退出后 runner 继续存活 + `/workspace` 持久卷跨挂起恢复——这五条共同支撑了 `ax ssh` 与亚秒级恢复
- **隔离边界**：`spec.debug` 才开放进程/文件服务；`Gateway` 用 egress 白名单收口出站；任务没有自己的 Service 或 Ingress，全靠 `ate-target-actor` header 路由
- **底座数字**：Agent Substrate 宣称 10 倍沙箱密度、低于 500 毫秒恢复、每秒 500 次以上挂起/恢复，演示里把约 250 个 actor 压到 8 个 pod 上
- **当下的状态**：预览版，协议会变；需要一个 Kubernetes 集群加 Agent Substrate；命令退出码不回传；`policies`（预算/审批）与 `goal` 字段刚被 reserve 掉

最值得记住的一点，可能是它把「智能体的成本模型」当成了架构的第一性问题：不是先有编排再想省钱，而是从 actor 复用、亚秒级挂起恢复、只在思考时计费这些约束出发，反推出不能用 etcd、必须自建控制面。至于它能否成为事实标准，取决于这份预览版的协议能在破坏性变更里收敛多快。

原文：[Introducing Agent Executor, Google's distributed Agent Runtime](https://cloud.google.com/blog/products/ai-machine-learning/agent-executor-googles-distributed-agent-runtime)（Google Cloud Blog，Jaana Dogan 与 Ethan Bao，2026 年 5 月 20 日）

参考：
- [google/ax 代码仓库](https://github.com/google/ax)（Apache 2.0）
- [AX 官方网站 agentexecutor.io](https://agentexecutor.io/)
- [AX 核心概念：Task / Workspace / Gateway / Model](https://github.com/google/ax/blob/main/docs/concepts.md)
- [AX 设计文档与 API 参考](https://github.com/google/ax/blob/main/DESIGN.md)
- [沙箱内部：runner 启动流程与元数据服务](https://github.com/google/ax/blob/main/docs/sandbox.md)
- [Runner 契约：如何替换默认 runner](https://github.com/google/ax/blob/main/docs/runner.md)
- [Agent Substrate 代码仓库](https://github.com/agent-substrate/substrate)
