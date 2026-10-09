---
title: "Microsoft 开源 MXC：给不可信代码与智能体输出用的跨平台沙箱，发布 1.0"
description: "Microsoft 开源 MXC：跨 Windows、Linux、macOS 的沙箱 SDK，用统一策略模型把隔离从进程沙箱做到微 VM，已发布 1.0。"
pubDate: 2026-10-09
author: "林晓"
category: "tools"
tags: ["Microsoft", "MXC", "沙箱", "代码执行", "AI Agent", "安全隔离", "Rust", "SDK", "开源项目"]
image: "/covers/2026-10-09-microsoft-mxc.jpg"
imageAlt: "封面：浅色杂志编辑风信息图，左栏标题「Microsoft MXC」与「跨平台沙箱 SDK 发布 1.0」及两行要点，右栏为白底面板上由外向内逐层嵌套的隔离层示意，最内层是代表工作负载的小方块，珊瑚色线条标示层级"
topStory: true
---

<strong>MXC（Microsoft eXecution Container）</strong>是微软开源的一套沙箱化代码执行系统，用来运行不可信代码——官方点名的三类场景是模型输出、插件与工具。它要在 Windows、Linux 和 macOS 上提供多种隔离后端，从操作系统原生的进程沙箱一直到完整的虚拟机，全部收在统一的隔离模型和带类型的 SDK 之下。2026 年 10 月 7 日，项目发布 <strong>v1.0.0</strong>，这是 Rust、.NET、Node.js 三套 SDK 表面的第一个稳定版本。

仓库位于 [github.com/microsoft/mxc](https://github.com/microsoft/mxc)，Rust 编写，MIT 许可，创建于 2026 年 2 月 6 日。截至 10 月 9 日约有 2,096 个 star、113 个 fork、490 次提交、30 位贡献者。

## 它解决什么问题

只要应用开始执行「不是自己写的代码」，就会撞上同一个问题：怎么让它只做该做的事。这类代码过去主要来自插件，现在越来越多来自模型——智能体生成的一段脚本、一个工具调用、一份从网上下载的扩展，都必须在拿到之前假设它是恶意的。

MXC 的定位很清楚：<strong>它不是一个服务或守护进程，而是一个编译进你应用里的 SDK</strong>。应用告诉它三件事——要哪种容器、隔离规则是什么、要跑什么命令——MXC 校验请求、选出后端，然后在容器里把工作负载跑起来。这个进程内的形态让它可以被嵌进任何宿主程序，而不要求用户先装一套容器运行时。

## 三平台、九种后端：隔离强度由你选

MXC 在不同平台上走平台原生的隔离机制，每种平台有一个默认后端，另有若干可选后端，部分标注为实验性。

| 运行平台 | 默认后端 | 其他后端 |
| --- | --- | --- |
| Windows 11 x64 / ARM64 | `processcontainer` | `windows_sandbox`、`wslc`、`microvm`、`hyperlight`、`isolation_session` |
| Linux x64 / ARM64 | `bubblewrap` | `lxc`、`microvm`、`hyperlight` |
| macOS ARM64 / x64 | `seatbelt` | — |

其中几个后端的取向值得单独说：

- <strong>ProcessContainer</strong>（Windows 默认）：基于 AppContainer 的进程沙箱，隔离最轻但启动最快。它需要一次性执行 `wxc-host-prep.exe` 做宿主准备，这个二进制带 `requireAdministrator` 清单；沙箱启动器 `wxc-exec.exe` 自己从不提权，所有需要特权的设置工作都放在前者里。
- <strong>Bubblewrap</strong>（Linux 默认）：用 Linux 用户命名空间做非特权沙箱，不需要 root，也不需要容器运行时。
- <strong>Seatbelt</strong>（macOS 默认）：跑在 Apple 内核强制的沙箱里——就是 Mac App Store 应用所用的那套框架。MXC 会把 JSON 策略翻译成 Seatbelt profile 再应用。它要求 macOS 15 及以上，<strong>不需要 root、不需要守护进程、不需要安装</strong>，隔离范围是进程树，没有具名容器也没有生命周期，因此也没有东西需要清理。
- <strong>WSLC</strong>：在 Windows 上跑 Linux 容器，v0.9 起是稳定后端；要求 Windows 10 1903（build 18362.1049）以上的 x64 或 2004（build 19041）以上的 ARM64、WSL 2.9.9 以上，以及单独的 `wslcsdk.dll`。
- <strong>MicroVM（Nanvix）</strong>：实验性后端，通过 Windows Hypervisor Platform 或 Linux 的 KVM 提供硬件强制的隔离。官方给出的数字是冷启动约 100 毫秒、常驻内存约 100 MB——这是它相对完整虚拟机的卖点所在。
- <strong>Hyperlight</strong>：实验性后端，在 Hyperlight 微虚拟机里启动一个 Unikraft unikernel，由 `hyperlight-unikraft` crate 在进程内驱动；Linux（KVM）与 Windows（WHP）共用一条代码路径，目前仅支持 x86_64。
- <strong>Windows Sandbox</strong>：实验性后端，提供虚拟机级隔离，支持一次性（每次调用起一台全新 VM、跑一条命令再拆掉）与状态感知（多次 `exec` 共享同一台 VM）两种用法。文档也如实说明：一次性模式的清理是尽力而为而非内核保证，启动器被强杀可能留下卡住的孤儿 VM。

## 策略模型：文件、网络与界面

三种隔离维度共用一套 JSON 配置，策略写在请求里，由后端决定能实际执行到哪一步。

<strong>文件系统</strong>用只读、读写与拒绝三份路径清单来授权：

```json
{
  "version": "1.0.0",
  "containment": "processcontainer",
  "process": {
    "commandLine": "python -c \"open('C:\\\\temp\\\\output.txt', 'w').write('test')\""
  },
  "filesystem": {
    "readwritePaths": ["C:\\temp"],
    "deniedPaths": ["C:\\Windows\\System32"]
  }
}
```

<strong>网络</strong>采用显式的出站与入站策略，而且默认是<strong>关闭而非放行</strong>：`network`、`network.egress` 或 `network.egress.default` 任一被省略时，`egress.default` 都会解析为 `deny`；两项入站控制同样默认 `deny`；`hostLoopback` 独立于 `ingress.default` 解析，因而访问宿主回环必须显式申请。

```json
{
  "network": {
    "egress": {
      "default": "deny",
      "allow": [{
        "to": [{ "cidr": "140.82.112.0/20" }],
        "ports": [{ "protocol": "tcp", "port": 443 }]
      }]
    },
    "ingress": { "default": "deny", "hostLoopback": "deny" }
  }
}
```

这里有一个需要留意的取舍：<strong>直接出站规则与运行时代理是两种互斥的连通模型，不能同时使用</strong>。直接模式按数值 CIDR、协议与端口下发规则，需要后端支持；代理模式则由调用方自己维护一个本地 HTTP/S 端点，目的地过滤由代理负责。规则只接受 IP 与 CIDR，不接受主机名。

<strong>界面策略</strong>覆盖剪贴板、显示与图形界面访问，目前主要落在 ProcessContainer 上。

## 生命周期与 SDK

创建与持久化是两件事。一次性执行走 `ContainerRequest`；需要反复执行的场景则走完整生命周期：<strong>provision → start → exec → stop → deprovision</strong>。provision 返回一个不透明的 `ContainerId`，后续必须原样传回，文档明确要求不要解析它、也不要用创建请求里那个可选的标签去重建它。此外还有一套显式校验 API，只做原生 dry-run 而不真正执行。

三套 SDK 的公共表面都收敛在版本化的 V1 命名空间下：Rust 是 `mxc_sdk::v1`、.NET 是 `Microsoft.Mxc.Sdk.V1`、Node 是 `@microsoft/mxc-sdk/v1`（Node 包的根路径不导出任何 API）。Rust 侧是同步 API，.NET 与 Node 另外提供异步版本。安装走各自的包管理器即可，不必克隆仓库：

| SDK | 包 |
| --- | --- |
| Rust | `mxc-sdk`（crates.io） |
| .NET | `Microsoft.Mxc.Sdk`（NuGet） |
| Node | `@microsoft/mxc-sdk`（npm） |

Node 侧的一个最小例子：

```typescript
import { spawn, type ContainerRequest } from '@microsoft/mxc-sdk/v1';

const request: ContainerRequest = {
  command: 'node -e "console.log(\'hello from container\')"',
  network: { egress: { default: 'deny' } },
  timeoutMs: 30_000,
};

const child = await spawn(request);
```

仓库的 `samples/` 目录按场景组织，每个场景都给出 Rust、.NET、Node 三份等价实现：一次性容器、持久化容器、文件系统隔离、网络隔离、捕获式输出、流式标准 IO、交互式 PTY、遥测、以及不启动容器就检查隔离支持情况。

## 非 SDK 用法与排障

不嵌入 SDK 时，可以直接调用平台相关的执行器二进制——Windows 的 `wxc-exec.exe`、Linux 的 `lxc-exec`、macOS 的 `mxc-exec-mac`——它们接受由稳定 JSON schema 定义的容器创建请求，适合测试或在无法嵌入 SDK 的场景下使用。

排障是这个项目里比较有特点的一环。因为标准输入输出在正常情况下被工作负载占用，MXC 把自己的诊断信息挪到了 `--debug` 开关后面。更特别的是 <strong>audit 模式</strong>：`wxc-exec.exe --audit policy.json` 会记录被拒绝的访问，帮助策略作者反推出一个可信工具真正需要的文件与能力，产出可直接用于写策略的工件。官方对这一点的警告也很直白——<strong>audit 模式会关闭该工作负载的全部沙箱安全，绝不能用它来跑不可信代码</strong>。

## 现状与注意点

- <strong>刚刚 1.0</strong>：v1.0.0 发布于 2026 年 10 月 7 日，是 Rust / .NET / Node 三套 SDK 表面的首个稳定版本；此前 v0.9.0 在 9 月 29 日加入 IsolationSession 与 WSL Container 支持，节奏大致每月一个版本。
- <strong>稳定与实验分明</strong>：Nanvix 微 VM、Hyperlight、Windows Sandbox 都标为实验性，其中 Hyperlight 还要用 `--experimental` 加 1.1.0-alpha 的 schema 才启用。
- <strong>schema 分稳定与开发两条线</strong>：生产配置用 1.0.0 的稳定 schema，实验特性对应 dev schema，后者可能随时变化。
- <strong>网络策略有过一次破坏性迁移</strong>：0.9 之前的旧字段（`defaultPolicy`、`enforcementMode`、主机列表、`allowLocalNetwork`、`network.proxy`）已被显式契约拒绝，只改版本号不会迁移旧策略。
- <strong>遥测默认关闭</strong>：需要运行、Windows 用户同意、管理策略允许、应用在请求里开启四重条件同时满足才会发送；管理员可以阻止但不能代用户同意；本地开源构建不会把遥测发往微软，非 Windows 平台上是空操作。
- 自行构建需要 Rust 1.93（由 `rust-toolchain.toml` 钉住）、Node.js 24 及以上，以及所选后端对应的平台工具链。

## 核心总结

- <strong>是什么</strong>：微软开源的沙箱化代码执行系统 MXC，用于运行模型输出、插件与工具这类不可信代码，形态是可编译进应用的 SDK 而非服务
- <strong>版本</strong>：2026 年 10 月 7 日发布 v1.0.0，Rust / .NET / Node 三套 SDK 的首个稳定版；Rust 编写、MIT 许可
- <strong>跨平台</strong>：Windows 默认 ProcessContainer、Linux 默认 Bubblewrap、macOS 默认 Seatbelt，另有 LXC、WSLC、Nanvix 微 VM、Hyperlight、Windows Sandbox、IsolationSession 等可选后端
- <strong>策略</strong>：文件系统（只读 / 读写 / 拒绝）、网络（出站与入站默认拒绝，CIDR + 协议 + 端口，或改用调用方自管的本地代理，两者互斥）、界面（剪贴板、显示、GUI）
- <strong>生命周期</strong>：一次性执行走 ContainerRequest，持久化走 provision → start → exec → stop → deprovision，用不透明的 ContainerId 贯穿
- <strong>排障</strong>：`--debug` 输出诊断，`--audit` 记录被拒访问以反推策略——但 audit 会关闭全部沙箱安全，不能用于不可信代码

参考：

- [microsoft/mxc 仓库](https://github.com/microsoft/mxc)（Microsoft，MIT）
- [README：容器类型与后端对照](https://github.com/microsoft/mxc/blob/main/README.md)
- [配置 schema 说明](https://github.com/microsoft/mxc/blob/main/docs/schema.md)
- [容器生命周期](https://github.com/microsoft/mxc/blob/main/docs/container-lifecycle.md)
- [SDK API 参考](https://github.com/microsoft/mxc/tree/main/docs/api-reference)
- [SDK 示例目录](https://github.com/microsoft/mxc/tree/main/samples)
