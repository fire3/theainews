---
title: "OpenSandbox 加入 AAIF：阿里开源的智能体沙箱运行时走向中立治理"
description: "阿里巴巴把开源沙箱平台 OpenSandbox 捐给 Linux 基金会 AAIF；统一 API 覆盖 Docker 与 Kubernetes，Firecracker 沙箱创建 P50 64 毫秒。"
pubDate: 2026-10-26
author: "林晓"
category: "tools"
tags: ["OpenSandbox", "AAIF", "沙箱", "智能体基础设施", "Firecracker", "Kubernetes", "开源", "Linux 基金会"]
image: "/covers/2026-10-26-opensandbox.jpg"
imageAlt: "封面：米白网格底的工程蓝图风，左栏为嵌套隔离方块的正交投影工程图，右栏大标题「OpenSandbox 加入 AAIF」，副标题「阿里开源智能体沙箱 · Apache 2.0 · 16.2k star」，下方三行要点：统一沙箱 API、Firecracker 创建 P50 64 ms、捐入 Linux 基金会中立治理"
topStory: true
---

10 月 22 日，圣何塞 AGNTCon + MCPCon 大会上，Agentic AI Foundation（AAIF）一次宣布接纳四个新项目：<strong>Agent Skills</strong>（Anthropic 捐赠）、<strong>Open Responses</strong>（OpenAI）、<strong>OpenEnv</strong>（Hugging Face）与 <strong>OpenSandbox</strong>（阿里巴巴）。至此 AAIF 成立不满一年，托管项目从 2025 年 12 月的 3 个（MCP、goose、AGENTS.md）增至 10 个。

OpenSandbox 是阿里巴巴 2026 年 3 月开源的通用 AI 应用沙箱平台，Apache 2.0 许可，为智能体提供隔离的代码执行、命令运行、文件管理与浏览器/桌面环境。截至发稿，仓库已有 <strong>16.2k star、1.5k fork、3,967 次提交</strong>，并已列入 CNCF Landscape、通过 OpenSSF Best Practices 评级。阿里巴巴开发基础设施负责人徐晓斌表示：<strong>「OpenSandbox 虽然诞生于阿里巴巴，但我们不希望它的未来由单一公司定义。把它带到 AAIF，是为更多开发者和组织参与塑造智能体生态的沙箱环境留出路径。」</strong>

## 从 alibaba/OpenSandbox 到 opensandbox-group

项目最初以 `alibaba/OpenSandbox` 仓库发布，随后转移到独立的 `opensandbox-group` 组织，仓库 ID 未变，是同一次迁移；部分包坐标仍保留 Alibaba 命名（如 npm 的 `@alibaba-group/opensandbox`、Maven 的 `com.alibaba.opensandbox`）。官网页脚显示项目现属 LF Projects, LLC 管理的系列，镜像同时发布到 Docker Hub、GHCR 与阿里云容器镜像服务三个注册表，发布镜像用 Cosign 无密钥签名并附带来源证明。最新版本为 <strong>1.2.0-rc.2</strong>（10 月 21 日发布，预发布状态）。

## 核心设计：沙箱是一个协议，不是一家厂商的 API

OpenSandbox 的主张是把沙箱当成智能体的<strong>通用原语（primitive）</strong>：智能体向沙箱请求执行环境，至于底下是容器还是微虚拟机，不该影响智能体代码。项目以 `specs/` 下的 OpenAPI 契约为唯一事实来源，分两部分：

- <strong>生命周期 API</strong>：创建、查询、暂停、恢复、续期、快照、删除沙箱，以及模板管理；
- <strong>执行 API</strong>：由运行在沙箱内部的 Go 守护进程 <strong>execd</strong> 提供——执行命令、读写文件、保持 bash 会话、PTY 交互、Jupyter 代码执行与资源指标采集，输出走 SSE/WebSocket 流式返回。

一次典型调用链是 `Agent → SDK → Lifecycle API → Runtime`：FastAPI 生命周期服务校验请求后交给运行时后端，异步创建容器或工作负载，沙箱进入 Running 后智能体即可在内工作。运行时后端目前有两个：

| 后端 | 定位 | 关键点 |
| --- | --- | --- |
| Docker | 本地与单机 | 直连 Docker 守护进程，支持 host/bridge/pasta/slirp4netns 网络、快照与 egress sidecar |
| Kubernetes | 集群生产 | 默认走自研 BatchSandbox CRD，也支持 `kubernetes-sigs/agent-sandbox`；带 Pool 预热池与批量创建 |

客户端一侧提供 <strong>Python、Java/Kotlin、TypeScript/JavaScript、C#/.NET、Go</strong> 五种 SDK，外加 `osb` 命令行工具与 MCP 服务器（可直接接入 Claude Code、Cursor）。本地起步只需 Docker 与 Python 3.10+：`uvx opensandbox-server` 起服务，`pip install opensandbox` 装 SDK，从 alpine 镜像创建沙箱即可跑命令、写文件、销毁。

## Fast Sandbox：把创建热路径移出 Kubernetes 调度器

性能上最值得关注的是 <strong>Fast Sandbox</strong> 运行时（独立的 fast-sandbox 仓库）：它把 OCI 镜像预先构建为含 execd 的金镜像模板，在预热的 Fastlet Pod 里以 <strong>Firecracker microVM</strong> 恢复沙箱，创建不再经过 Kubernetes 调度器、watch 传播与 kubelet 路径；持久意图存放在 `sandbox.fast.io` CRD 中，控制面通过 gRPC FastPath 完成热路径变更，节点间用 DART 做 P2P 制品分发。

官方 10 月 8 日在两节点 ACK 集群（AMD EPYC 9T95、单节点约 742 GiB 内存、5 个 Fastlet × 4 槽位、Firecracker 1.16.1）上的工程测量：

| 场景 | 结果 |
| --- | --- |
| 串行创建（100 次，warm） | 成功 100/100，<strong>P50 64.0 ms</strong>、P99 108.3 ms |
| 10 并发创建 | 成功 100/100，P50 102.7 ms、<strong>P99 125.4 ms</strong> |
| 20 并发创建 | 仅 51/100 成功，48 次被限流（HTTP 429）拒绝——尚未建立可靠的 20 路接入能力 |
| 沙箱内 `/ping`（warm，经网关） | P50 0.92 ms |
| `commands.run('echo ...')` 端到端 | P50 202.8 ms（其中含 execd 默认 200 ms 流关闭宽限期） |
| 暂停（请求接受 → 持久 Paused） | 中位 61.14 s，VM 冻结 11.15 s，发布约 4 GiB 检查点 |
| 同节点恢复 | 运行时恢复仅 35.49 ms，但 <strong>SDK 可用恢复中位 62.66 s</strong> |

文档对这批数字相当克制：明确标注是「工程测量而非生产延迟承诺」，并主动写明两处未解决的问题——<strong>20 并发下的准入/投影失败需要单独修复</strong>，以及<strong>恢复耗时主要卡在网关/端点解析与客户端等待，而非运行时本身</strong>。这种把短板写进基准页的做法在基础设施项目里并不多见。

## 安全边界：出网可控，凭据不进沙箱

隔离与网络控制是这个项目的另一半卖点：

- <strong>入站</strong>：统一 ingress 网关（HTTP/WebSocket 反向代理），支持 header、URI、通配域名三种路由模式，可配置签名路由令牌的 secureAccess。
- <strong>出站</strong>：每个沙箱一个 egress sidecar（FastSandbox 则为每个 Fastlet 共享一个出网进程），支持 FQDN/通配域名放行拒绝、`dns` 过滤与 `dns+nft`（DNS + nftables 强制），策略为 fail-closed——策略送达可以晚，绝不提前放开。
- <strong>Credential Vault</strong>：在 `dns+nft` 模式下通过透明 TLS 代理按主机侧密钥绑定注入凭据，让智能体调用外部服务时<strong>原始密钥不进入沙箱工作负载</strong>。
- <strong>运行时隔离</strong>：容器能力收紧、seccomp/AppArmor、可选 gVisor 与 Kata 等安全运行时（OSEP-0004），FastSandbox 路径则由 Firecracker 提供 VM 级隔离。

## 典型场景与路线图

官方示例覆盖四类负载：<strong>编码智能体</strong>（Claude Code、Codex CLI、Gemini CLI、Qwen Code、Kimi CLI、DeerFlow）、<strong>代码执行与数据分析</strong>（Code Interpreter SDK，内置 Python/Java/Node/Go 与多语言 Jupyter 内核）、<strong>浏览器与桌面自动化</strong>（Playwright、Chrome、VNC 桌面、VS Code Web），以及<strong>智能体评测与强化学习</strong>（Harbor 评测、BatchSandbox 批量创建与资源池，每个 trial 一个沙箱）。

路线图（2026-10-08 更新）显示未来 12 个月的重点是：空闲自动暂停、首次访问唤醒的自动化生命周期；Fast Sandbox 的超高密度部署与内存超额订阅；跨 CPU 型号的模板与调度；eBPF 沙箱内观测与 agent 操作审计轨迹；OpenTelemetry 全链路指标；以及控制面多副本高可用。项目同时明确<strong>暂不发布稳定的 v1 API</strong>——生命周期语义与 SDK 兼容性成熟之前不做承诺，重大变更一律走 OSEP 提案流程。

## 核心总结

- <strong>事件</strong>：10 月 22 日，阿里巴巴将 OpenSandbox 捐给 Linux 基金会 AAIF，与 Agent Skills、Open Responses、OpenEnv 同批加入，AAIF 托管项目增至 10 个
- <strong>项目定位</strong>：Apache 2.0 的通用智能体沙箱平台，2026 年 3 月发布，16.2k star，列入 CNCF Landscape；协议优先——生命周期 API 与执行 API 以 OpenAPI 契约为准
- <strong>架构</strong>：FastAPI 生命周期服务 + 沙箱内 execd 守护进程；Docker 与 Kubernetes 双后端，K8s 默认 BatchSandbox，另可走 Firecracker 模板化的 Fast Sandbox
- <strong>性能</strong>：ACK 实测 Firecracker 暖创建 P50 64 ms、10 并发 P99 125.4 ms；20 并发仅 51% 成功，SDK 恢复约 62 秒——官方在文档中主动披露这些短板
- <strong>安全</strong>：入站统一网关，出站 egress 策略 fail-closed，Credential Vault 让原始密钥不进沙箱；支持 gVisor/Kata/Firecracker 等隔离
- <strong>接入方式</strong>：五种语言 SDK、`osb` CLI、MCP 服务器与 Code Interpreter SDK；本地 Docker 起步，同一套 API 上 Kubernetes
- <strong>待解问题</strong>：v1 API 尚未稳定，高并发准入与恢复链路延迟仍是公开的工程债

原文：[OpenSandbox](https://github.com/opensandbox-group/OpenSandbox)（opensandbox-group，GitHub）

参考：

- [Agentic AI Foundation Announces Four New Projects](https://aaif.io/news/agentic-ai-foundation-announces-four-new-projects)（AAIF，2026-10-22）
- [The Sandbox as an Agent Primitive](https://aaif.io/blog/the-sandbox-as-an-agent-primitive)（AAIF，2026-10-22）
- [Fast Sandbox Performance](https://github.com/opensandbox-group/OpenSandbox/blob/main/docs/architecture/fast-sandbox/performance.md)（OpenSandbox，2026-10-08 测量）
- [Architecture](https://github.com/opensandbox-group/OpenSandbox/blob/main/docs/architecture/index.md) 与 [Roadmap](https://github.com/opensandbox-group/OpenSandbox/blob/main/ROADMAP.md)（OpenSandbox）
- [OpenSandbox 官网](https://open-sandbox.ai)
