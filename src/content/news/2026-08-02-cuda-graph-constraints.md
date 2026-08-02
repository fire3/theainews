---
title: "CUDA Graph 使用边界：九类必须知道的限制"
description: "CUDA Graph 强大但限制不少：捕获期间不能同步、图拓扑与参数静态冻结、流捕获必须自包含、内存生命周期等九类约束详解。"
pubDate: 2026-08-02
author: "林晓"
category: "tutorial"
tags: ["CUDA", "GPU", "性能优化", "深度学习", "教程"]
---

CUDA Graph 能大幅削减内核启动开销，但它不是万能药——CUDA runtime 给图施加了九类根本性限制。搞清楚这些边界，才能判断你的工作负载适不适合图捕获，以及怎么在限制之内把图用好。本文是 CUDA Graph 入门篇的姊妹篇，逐一拆解这些约束。

## 1. 异步限制：捕获期间不能同步、不能查状态

CUDA Graph 依赖异步执行模型：CPU 提交工作后不等待完成就继续。因此流捕获期间，任何让 CPU 与 GPU 同步的操作都被禁止：

| 禁止的操作 | 说明 |
|---|---|
| `cudaDeviceSynchronize()` | 阻塞 CPU 直到所有设备工作完成 |
| `cudaStreamSynchronize()` | 阻塞 CPU 直到指定流完成（对正在捕获的流禁止） |
| `cudaEventSynchronize()` | 阻塞 CPU 直到事件被触发 |
| 同步内存操作 | 如不带 `Async` 后缀的 `cudaMemcpy` |
| `cudaStreamQuery()` / `cudaEventQuery()` | 捕获期间不能查询流/事件状态 |

原因很简单：驱动程序无法录制需要即时 CPU-GPU 协调的操作。所有同步必须放在捕获边界之外。

另外，图捕获必须在**非默认流**上进行。默认流（stream 0）带有隐式同步语义，与图捕获的要求冲突，所以要显式创建专用流。

## 2. 静态图拓扑：结构一旦实例化就冻结

图记录的是固定的一组操作和依赖关系，runtime 不能根据中间结果改变结构。数据相关的分支（`if (value > threshold) launch_a(); else launch_b();`）、由计算结果决定的循环次数、按运行时条件动态扩展图——这些在图中都不支持。

唯一的例外是 **条件节点（CUDA 12.3+）**：它允许 GPU 侧的有限分支，但图拓扑依然是静态的——条件节点本身和所有可能的执行路径（子图）都必须在捕获/创建时定义好，动态的只是 GPU 运行时根据设备端条件选择哪条分支。条件必须在 GPU 上求值，且要用专门的 `cudaGraphConditionalHandle` API 表达，主要面向 CUDA C++ 开发者。

## 3. 静态图参数：指针与内核参数默认全部冻结

默认情况下，图会记录捕获时用到的精确指针、内核参数（标量参数、grid/block 维度、共享内存大小）和内存配置，每次启动都原样使用。想改？只能用 **图更新 API（CUDA 11.0+，`cudaGraphExecNodeSetParams()`）** 对已存在节点做有限的原位修改——图拓扑依然不能变。

这里有一个特别容易踩的坑：**静默失效（Silent Failures with Stale Parameters）**。如果捕获后你修改了作为内核参数的底层变量，但不走图更新 API，图不会自动采用新值——它会一直用捕获时的旧值，而且通常不报错，只产生错误的结果。要传递每次启动都会变的值，两个办法：用图更新 API 修改节点参数，或者把数据放在设备内存地址里（更新地址上的值），而不是用冻结在捕获时的标量参数。

### 静态形状要求

数据形状必须在所有图启动间保持不变，这是影响最大的约束之一，因为形状一变，内核配置（grid/block）、内存访问模式（步长与索引）、控制流（动态循环/条件）都可能跟着变，甚至需要新的内存分配。常见对策：

- **填充（Padding）**：把形状补齐到固定尺寸
- **分桶（Bucketing）**：为不同形状区间建多张图，按形状选择
- **回退**：罕见的形状走 eager 执行，不进图

## 4. 自包含的流捕获：fork-join 模型

流捕获得到的图必须是一个边界清晰、自包含的执行单元：所有工作从同一条捕获流出发，最终都要同步回这条流。

- **Fork**：捕获期间可以把工作分发到子流
- **Join**：`cudaStreamEndCapture()` 之前，所有分出去的流必须同步回捕获流
- **默认禁止外部依赖**：不能等待捕获上下文之外的事件
- **断连的流不会被捕获**：捕获区域内、但既不从捕获流 fork、也不 join 回捕获流的操作，不会出现在图里

跨图同步可以通过**外部事件节点**实现：`cudaEventRecordWithFlags(event, stream, cudaEventRecordExternal)` 把事件录制节点插入图，`cudaStreamWaitEvent(stream, event, cudaEventWaitExternal)` 插入事件等待节点。这两个 flag 只在流捕获期间有效，且事件句柄必须活到图生命周期结束。它们可以实现图间同步、图间流水线、图与图之间的完成信号。

自包含保证了图启动的高效与可靠：驱动知道图里所有要执行的东西和顺序，无需与外部异步工作协调。

## 5. CPU 代码不会被捕获

图里只包含 GPU 操作（内核启动、内存拷贝等）。定义图期间运行的 CPU 代码（无论是流捕获还是显式构建）不属于图的一部分，图启动时不会执行——除非你用 `cudaLaunchHostFunc()` 显式加一个主机函数节点。

常见坑：在图定义区域里修改主机状态。如果某个变量在定义时被 CPU 代码更新、而图启动后要读它，那么它只在定义时更新一次，之后每次启动读到的都是旧值。要让 CPU 代码每次启动都执行，三种选择：把代码移出图定义区域、把逻辑挪到 GPU 上、或者包成主机函数节点（注意回调里不能再调用 CUDA API）。

## 6. 多线程与捕获模式

捕获期间，`cudaMalloc()` 这类"潜在不安全"操作会立即执行而不是入队，可能导致图无效。`cudaStreamCaptureMode` 控制 CUDA 如何在线程间限制这些操作：

| 模式 | 行为 | 适用 |
|---|---|---|
| `Global`（默认） | 进程级保护，最严格最安全：本线程或任何其他线程有并发捕获时，都禁止潜在不安全 API | 推荐日常使用 |
| `ThreadLocal` | 只约束本线程，允许各线程独立并发捕获 | 多线程各自捕获 |
| `Relaxed` | 不禁止潜在不安全 API（冲突操作仍禁止），操作以副作用执行但不进图 | 明确需要且理解风险时 |

没有特殊多线程需求就保持默认的 `Global`，它可以防止意外干扰导致图失效。

## 7. 内存约束

### 捕获期间可用的内存 API

| API | 捕获期间 | 说明 |
|---|---|---|
| `cudaMalloc()` / `cudaFree()` | ❌ 禁止 | Global/ThreadLocal 下返回 `cudaErrorStreamCaptureUnsupported` |
| `cudaMallocHost()` / `cudaFreeHost()` | ❌ 禁止 | 所有模式下都禁止 |
| `cudaMallocAsync()` | ✅ 被捕获 | 成为图中的分配节点 |
| `cudaFreeAsync()` | ✅ 被捕获 | 只能释放同一次捕获内用 `cudaMallocAsync()` 分配的内存 |

Relaxed 模式下同步分配可以作为副作用执行（但不进图），固定内存（pinned）在所有模式下仍然禁止。

### 内存生命周期要求

图引用的**外部内存**必须在整个图生命周期内保持有效：设备内存在图可执行对象存在期间必须保持分配状态，提前释放再重放会产生未定义行为；可分页主机内存捕获的是地址而不是内容，重放间的数据变化会反映到后续拷贝；固定主机内存需注意同步时序。**一定要先销毁图可执行对象，再释放其引用的外部内存。**

捕获期间用 `cudaMallocAsync()` 分配的**内部内存**则归图所有：每次重放都会重新分配（每次重放都是新内存），由流有序分配器管理；如果在同一次捕获内配了 `cudaFreeAsync()`，每次重放都会释放。关键区别是：Relaxed 模式下的 `cudaMalloc()` 只在捕获时分配一次（副作用），而 `cudaMallocAsync()` 每次启动图都会分配（作为图节点）。流有序分配还会在图内做内存复用与池化优化。

## 8. 多设备：P2P 与 NCCL

单张图可以包含跨设备操作：P2P 拷贝（`cudaMemcpyPeer`）、NCCL 集合通信（如 AllReduce，可以把包含梯度同步的完整多卡训练迭代图化）、跨设备内存操作。典型模式是每张 GPU 各自捕获一张包含本地操作和 NCCL 集合的图，所有卡同时启动各自的图。

两个注意点：

- **NCCL 2.9.6+ 才支持**捕获 NCCL 集合通信，更早的版本不支持
- 如果用户缓冲区跨多个不连续物理段（内存分配器按需扩展段时常见），旧版 NCCL 只支持注册单个物理段，可能导致图捕获/启动时的非法内存访问；遇到问题可以设 `NCCL_GRAPH_REGISTER=0` 关闭缓冲区注册

另外，条件节点的子图有更严格的要求：其内部所有节点必须位于同一设备上。

## 9. 其他限制

捕获期间还有其他被禁止的操作，尝试使用会返回 `cudaErrorStreamCaptureUnsupported` 或 `cudaErrorStreamCaptureInvalidated` 之类的错误。完整清单见 CUDA Programming Guide 的 Stream Capture 章节。

## 核心总结

- **异步纪律**：捕获期间不同步、不查询，只用非默认流
- **静态世界**：拓扑、内核参数、指针、形状默认全部冻结；要动参数走图更新 API，要动形状靠填充/分桶/回退
- **自包含**：图内无外部依赖，跨图同步用外部事件节点；CPU 逻辑要进图必须用主机函数节点
- **内存红线**：外部内存必须活过图的一生，先销毁图再释放内存；图内分配用 `cudaMallocAsync`
- **多卡可行**：P2P 与 NCCL 集合可图化（NCCL 2.9.6+），多段缓冲问题可关掉注册兜底

参考：

- [Constraints | CUDA Graph Basics](https://docs.nvidia.com/dl-cuda-graph/latest/cuda-graph-basics/constraints.html)（NVIDIA）
- [CUDA Graphs | CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html)（NVIDIA）
