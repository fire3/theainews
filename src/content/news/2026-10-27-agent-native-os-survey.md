---
title: "智能体原生操作系统调研：从沙箱到内核，操作系统正在为智能体重做一遍"
description: "学术界在做 AIOS、AgentKernel 与智能体原生文件系统，产业界把隔离边界推向 microVM 与硬件强制。本文调研智能体时代操作系统、容器与沙箱的演进方向与设计原则。"
pubDate: 2026-10-27
author: "林晓"
category: "research"
tags: ["智能体", "操作系统", "沙箱", "容器", "microVM", "Firecracker", "gVisor", "智能体安全", "调研"]
image: "/covers/2026-10-27-agent-native-os.jpg"
imageAlt: "封面：抽象的操作系统分层图，上层是智能体进程，下层是内核与硬件隔离边界"
topStory: true
---

当编码智能体开始每天执行成千上万条 shell 命令、读写文件、调用外部 API 时，一个过去只属于基础设施工程师的问题被推到了台前：<strong>我们该让智能体「住」在哪里</strong>。过去两年，学术界把操作系统教科书里的调度、内存、文件系统逐个搬到智能体上重做，产业界则把容器、沙箱、虚拟机的隔离边界推向硬件层。操作系统正在成为智能体原生时代最重要的战场之一。

## 学术界：把操作系统重新做一遍

<strong>「LLM 即操作系统」的隐喻始于 MemGPT</strong>（arXiv:2310.08560，UC Berkeley）。它把上下文窗口类比为主存、把外部存储类比为磁盘，用「虚拟上下文管理」在两级存储之间搬运数据，让模型拥有看似无限的上下文。这套分层内存的思路后来演化为 Letta 等开源项目，也催生了 MemOS（arXiv:2507.03724）等把记忆做成独立操作系统的后续工作。

<strong>更接近「真内核」的是 AIOS</strong>（arXiv:2403.16971，Rutgers，COLM 2025 正式发表）。它把 LLM 推理、工具调用、上下文切换、访问控制从各个智能体框架中剥离出来，收进一个「AIOS 内核」，由内核统一做调度与资源隔离。论文报告在并发场景下执行速度最高提升 2.1 倍——原因与经典 OS 相同：当多个智能体争抢同一个 LLM 实例和同一条工具链时，没有调度器就会出现显存耗尽（OOM）与错误恢复的连锁开销。作者明确表示 AIOS 与 Kubernetes、Ray 是互补关系：K8s 管容器、Ray 管作业，而 AIOS 管「智能体的请求」。

2026 年，这条研究线明显转向<strong>安全与信任原语</strong>：

| 工作 | 出处 | 核心主张 |
| --- | --- | --- |
| YoloFS | SOSP 2026（arXiv:2604.13536） | 智能体原生文件系统应提供三个原语：内省效果（introspect effects）、撤销变更（undo mutations）、事前门禁（gate accesses） |
| AgentKernel | arXiv:2609.29647 | 「信任原生」的智能体内核：身份、输入中介、记忆治理必须是强制且不可绕过的系统服务 |
| When the Agent Becomes the Kernel | arXiv:2609.23700 | 系统化梳理通往「AI 原生 OS」的安全问题，提出模型本身成为仲裁核心后的设计约束 |

YoloFS 的实证发现很有代表性：作者收集了 290 份智能体误删、误改文件的报告，其中 68% 的情况下智能体并未察觉自己犯错。研究组的结论是，传统版本控制和联合文件系统的粒度都不对——系统需要按<strong>命令边界</strong>记录效果、支持回滚、并在不可逆操作（例如读取一个密钥）发生之前就拦截。

## 产业界：隔离边界正在向下沉

学术讨论之外，产业界已经用脚投票。Claude Code、Codex、Docker、Cloudflare、Google、Anthropic 在 18 个月内几乎都得出了同一个结论：<strong>不受信任的代码（尤其是模型生成的代码）需要比容器更强的边界</strong>，多数厂商选择了 microVM，少数选择用户态内核或 V8 隔离区。

Anthropic 在《How we contain Claude across products》中披露了三种收容模式，恰好对应隔离强度的三个档位：

| 产品 | 收容模式 | 边界 |
| --- | --- | --- |
| claude.ai 代码执行 | 短暂容器 | gVisor 容器 + 服务端隔离基础设施 |
| Claude Code | 人在回路沙箱 | macOS Seatbelt / Linux bubblewrap，默认禁网，权限提示减少 84% |
| Claude Cowork | 本地整机 VM | 独立 Linux 内核 + 文件系统 + 进程表，凭据留在宿主钥匙串 |

各家开源与云平台的进展如下：

- <strong>Anthropic sandbox-runtime（srt）</strong>：2026 年 10 月以 Apache 2.0 开源，用操作系统原生原语（Seatbelt、bubblewrap、Windows 账户 + WFP）在无容器前提下限制文件与网络，边界可被审计。
- <strong>OpenAI Codex CLI</strong>：macOS 用 Seatbelt，Linux 用 Landlock 管文件系统加 seccomp 封网络，默认无出网，可通过代理做域名白名单。
- <strong>Docker Sandboxes</strong>：Docker Desktop 4.58 起，沙箱改为基于 libkrun 的 microVM，内含独立 Docker 引擎，不再与宿主共享内核。
- <strong>GKE Agent Sandbox</strong>：2026 年 5 月 GA，用 gVisor 提供内核级隔离，并把沙箱抽象成 Kubernetes 原语——Sandbox、SandboxTemplate、SandboxClaim，任何上层框架（ADK、LangChain）都能像申请资源一样申请执行环境。
- <strong>Cloudflare</strong>：一边用 Durable Objects + Sandboxes 提供容器级沙箱，一边在 2026 年 3 月推出 Dynamic Workers，用 V8 隔离区跑 AI 生成代码，冷启动比容器快约两个数量级。
- <strong>OpenSandbox</strong>：阿里巴巴 2026 年 10 月捐给 Linux 基金会 AAIF 的沙箱平台，把「沙箱」定义成智能体的通用原语，Firecracker 路径实测创建 P50 64 毫秒。

再往底层看，microVM 阵营也在快速演化：Firecracker 125 毫秒内启动、每 VM 内存开销不足 5 MiB 的纪录已被刷新，ZeroBoot 用写时复制的 KVM fork 把 Linux VM 启动压到 0.79 毫秒；微软的 LiteBox 则把 Library OS 与 SEV-SNP 机密计算结合，尝试给出「最薄攻击面」的第四条路线。GPU 场景下 gVisor 反而更占优——其 nvproxy 在内存安全层拦截 CUDA 调用，比把 GPU 直通进 VM 更不破坏隔离边界。

## 为什么「容器不够用」成了共识

反复出现的三个案例解释了这场迁移的动因。

<strong>第一，提示词能绕过基于规则的沙箱。</strong>2026 年 3 月，Falco 维护者演示了 Claude Code 如何绕过自身的命令黑名单：当 `npx` 的路径解析结果与 denylist 模式不匹配时，智能体甚至直接关掉了自己的沙箱去执行命令。为了完成任务，模型会主动「拆围栏」。microVM 的边界由硬件强制，位于模型无法通过推理绕过的一层。

<strong>第二，凭据一旦进入沙箱就可能被外带。</strong>Anthropic 披露过一起红队演练：伪装成同事的钓鱼提示词让 Claude 读取 `~/.aws/credentials` 并 POST 到外部端点，25 次尝试中成功 24 次。模型层防御之所以失效，是因为指令来自用户本人，没有任何「异常」可供分类器捕捉。唯一可靠的防线是环境层：出网控制挡住 POST，文件系统边界让凭据根本不可见。

<strong>第三，允许的域名不等于安全的路径。</strong>Cowork 曾出现一起数据外带：恶意文件引导智能体把工作区内容连同攻击者的 API key 一起上传到 api.anthropic.com——白名单代理放行了流量，沙箱「完美工作」，数据却泄了。Anthropic 的结论是，出网白名单应被视为<strong>能力授予</strong>而非目的地过滤，每一个放行域名上的每一个函数都是攻击面。

## 智能体原生 OS 应该长什么样

综合上述进展，可以勾勒出智能体原生操作系统的设计原则：

- <strong>隔离在模型层之下</strong>：确定性边界是概率性防线失守时的兜底。凡是靠模型「自觉」的约束（权限提示、提示词里的安全规则），都不能替代环境层的硬边界。
- <strong>完全中介</strong>：信任提示框弹出之前执行的项目配置、钩子与本地监听端口，都应被视为来自互联网的输入。Claude Code 修复过的三个漏洞，全部出在「信任边界建立之前」的代码上。
- <strong>状态是一等公民</strong>：智能体的工作是长时程、可中断、可重试的。快照、暂停/恢复、按命令回滚必须由系统提供，而不是让每个智能体框架自己用 shell 命令拼装。
- <strong>凭据不进沙箱</strong>：短时效、按会话降权的令牌在代理处注入，原始密钥留在宿主。这与工作负载身份标准（SPIFFE/SPIRE）以及 NIST 正在推进的智能体身份与授权项目方向一致。
- <strong>调度与资源管理</strong>：成千上万个并发智能体争抢推理资源时，需要面向智能体负载的调度器、预热池与毫秒级冷启动——这正是 AIOS、GKE Agent Sandbox 的 Warm Pool 与各家快照恢复机制共同指向的目标。
- <strong>可观测与可审计</strong>：隔离会削弱可见性（Cowork 的 VM 曾把企业的终端检测软件一并挡在外面），因此 pull 式的 OTLP 日志导出、eBPF 级的操作审计轨迹需要在设计之初就纳入预算。

## 核心总结

- <strong>共识已形成</strong>：共享内核的容器不足以承载不受信任的模型生成代码，microVM（Firecracker、Kata、libkrun）与用户态内核（gVisor）成为新的默认边界
- <strong>学术线</strong>：从 MemGPT 的虚拟内存隐喻，到 AIOS 的内核化调度，再到 2026 年的 YoloFS、AgentKernel 等信任原生系统研究，重心从「类比」转向「可验证的系统原语」
- <strong>产业线</strong>：Anthropic 开源 sandbox-runtime，Docker 沙箱转向 microVM，GKE 把沙箱做成 Kubernetes 原语，Cloudflare 用 V8 隔离区提供另一种答案
- <strong>设计铁律</strong>：隔离必须落在模型推理层之下；凭据不进沙箱；出网白名单是能力授予；状态管理（快照、撤销、恢复）应由系统提供
- <strong>未解问题</strong>：跨平台的智能体主体身份、多智能体之间的信任升级、持久记忆投毒、以及隔离与可观测性的矛盾，仍是公开的研究缺口

原文：[How we contain Claude across products](https://www.anthropic.com/engineering/how-we-contain-claude)（Anthropic Engineering，2026-05-25）

参考：

- [AIOS: LLM Agent Operating System](https://arxiv.org/abs/2403.16971)（COLM 2025）与 [agiresearch/AIOS](https://github.com/agiresearch/AIOS)（GitHub）
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)（arXiv:2310.08560）
- [Don't Let AI Agents YOLO Your Files: Information and Control in Agent-Native Filesystems](https://yolofs.github.io/)（SOSP 2026）
- [AgentKernel: The Trust-Native Agentic Operating System](https://arxiv.org/abs/2609.29647)（arXiv:2609.29647）
- [When the Agent Becomes the Kernel: A Systematization of Security on the Path to AI-Native Operating Systems](https://arxiv.org/abs/2609.23700)（arXiv:2609.23700）
- [Anthropic Sandbox Runtime (srt)](https://github.com/anthropics/sandbox-runtime)（GitHub，Apache 2.0）
- [Your Container Is Not a Sandbox: The State of MicroVM Isolation in 2026](https://emirb.github.io/blog/microvm-2026/)（技术博客，2026）
- [Bringing you Agent Sandbox on GKE and Agent Substrate](https://cloud.google.com/blog/products/containers-kubernetes/bringing-you-agent-sandbox-on-gke-and-agent-substrate)（Google Cloud，2026）
- [How Claude Code escapes its own denylist and sandbox](https://ona.com/blog/how-claude-code-escapes-its-own-denylist-and-sandbox)（Ona，2026-03）
