---
title: "CUDA Graph 入门：把一串内核调用打包成一次提交"
description: "一份面向深度学习开发者的 CUDA Graph 中文介绍：启动开销从哪来、图如何定义与执行，以及 PyTorch 里怎么用。"
pubDate: 2026-08-02
author: "林晓"
category: "tutorial"
tags: ["CUDA", "GPU", "性能优化", "深度学习", "教程"]
image: "/covers/cuda-graph-intro.jpg"
imageAlt: "GPU 显卡上方展示内核依赖关系树形图、下方一条时间轴示意一次性提交的扁平插画封面"
---

训练大模型时，GPU 经常"空转"——不是算不过来，而是等 CPU 喂活。深度学习框架每执行一个算子，背后都要经过 Python 到 C++、到 CUDA runtime、再到驱动的层层调度，单次启动开销可能高达几十到上百微秒。当内核本身只跑几微秒时，GPU 大部分时间都在等 CPU。CUDA Graph 就是为了解决这个问题而生的：把一串 GPU 操作连同它们的依赖关系打包成一张图，一次性提交、反复执行。

## 启动开销从哪里来

GPU 计算能力近十年指数级增长，而 CPU 受功耗墙和 Dennard 缩放终结的制约，性能提升明显放缓。在典型的深度学习应用里，CPU 是"编排者"、GPU 是"执行者"：CPU 不断把 CUDA 操作排队提交给 GPU。当 GPU 几微秒就能跑完一个内核时，CPU 准备和提交下一个操作的时间反而成了瓶颈。

一次内核启动的开销来自四个层次：

| 开销来源 | 典型耗时 | 说明 |
|---|---|---|
| 语言层转换 | 10–100 μs | PyTorch/TensorFlow 中 Python↔C++ 边界跨越、对象序列化、引用计数、GIL 获取/释放 |
| 运行时处理 | 5–20 μs | 算子分发（根据形状/类型选 GEMM 逻辑）、内存管理、跨库调用（cuDNN/cuBLAS）、参数校验、最优内核选择 |
| 驱动操作 | 5–15 μs | 参数与配置校验、命令缓冲管理、把工作打包提交到驱动命令队列 |
| 硬件提交 | 1–5 μs | PCIe 通信、GPU 命令处理器接收、硬件调度决策 |

即使重复启动同一个内核、用同样的配置，这四层开销也一次都不会少。深度学习应用里单次操作的总开销通常在 20–200 μs 之间。下面这些场景最容易暴露问题：

- **GPU 远快于 CPU 准备**：例如五年前的 CPU 配最新的 B200
- **软件栈复杂、分发开销大**：框架为决定下一个内核、算法选择、内存管理做大量逻辑
- **大量小内核**：单个内核执行时间只有几微秒，启动开销占比极高

## CUDA Graph 是什么

CUDA Graph 的核心思路是：把内核、内存拷贝等操作连同依赖关系定义成一张有向无环图（DAG），然后整张图一次性提交执行。它分三个阶段：

1. **定义（Definition）**：描述要执行哪些操作、它们之间的依赖关系——像写菜谱："先做 A，B 和 C 可以并行，都完成后做 D"
2. **实例化（Instantiation）**：把菜谱变成可执行的形态——校验图结构、预分配资源、构建优化过的启动描述。这一步耗时但只做一次
3. **执行（Execution）**：启动整张图。因为准备工作都在实例化阶段完成了，这一步极快

### 图的结构：节点与边

**节点（Nodes）**是实际要执行的操作：内核启动、内存拷贝、显存分配/释放、需要与 GPU 同步的主机函数，以及不干活只做同步点的空节点。图一旦实例化，节点承载的操作就不可更改（部分参数如内存地址仍可在有限范围内更新）。

**边（Edges）**定义依赖关系：从节点 A 到节点 B 的边意味着"B 必须等 A 完成才能开始"。依赖关系既保证正确性，又保留并行空间——独立的操作可以同时执行，并行分支在汇合点同步。CUDA runtime 会分析这些边，决定哪些操作可以并发，并调度到各流式多处理器上。

一个典型的小图：

```text
Kernel A: 预处理
  ├── Kernel B: 处理左半
  └── Kernel C: 处理右半   (B 与 C 互不依赖，可并行)
        ↓
Kernel D: 合并结果          (等 B 和 C 都完成)
```

## 两种创建方式

### 方式一：显式构建（Explicit Construction）

手工创建图对象、逐个添加节点、定义边，再实例化执行。适合需要程序化构造复杂执行模式、根据运行时条件动态建图的场景，但代码冗长、需要较深的底层知识，改造现有代码的成本也高。

```cpp
cudaGraph_t graph;
cudaGraphCreate(&graph, 0);

// 添加内核节点与 memcpy 节点（此处省略参数细节）
cudaGraphAddKernelNode(&kernel_a, graph, NULL, 0, &params_a);
cudaGraphAddKernelNode(&kernel_b, graph, NULL, 0, &params_b);
cudaGraphAddMemcpyNode(&memcpy_node, graph, NULL, 0, &memcpy_params);

// 定义依赖：B 与 memcpy 都依赖 A
cudaGraphNode_t deps[] = { kernel_a };
cudaGraphAddDependencies(graph, deps, &kernel_b, 1);
cudaGraphAddDependencies(graph, deps, &memcpy_node, 1);

// 实例化（一次性开销），之后反复执行
cudaGraphExec_t graph_exec;
cudaGraphInstantiate(&graph_exec, graph, NULL, NULL, 0);
for (int i = 0; i < 1000; i++) cudaGraphLaunch(graph_exec, stream);
```

### 方式二：流捕获（Stream Capture）

更实用的方式：像平常一样在 CUDA 流上执行操作，CUDA 会把这些操作"录制"成图，而不是真的执行。流捕获对现有代码改动极小，依赖关系自动从流的顺序推断，cuDNN/cuBLAS 等复杂调用也能自动捕获；代价是对图结构控制力较弱——单条流上的顺序操作会被串行化，要表达并行必须用多条流。

```cpp
cudaStreamBeginCapture(stream, cudaStreamCaptureModeGlobal);
// 正常写操作，它们会被录制而不是执行
kernel_a<<<grid, block, 0, stream>>>(...);
kernel_b<<<grid, block, 0, stream>>>(...);
cudaMemcpyAsync(..., stream);
cudaStreamEndCapture(stream, &graph);

cudaGraphInstantiate(&graph_exec, graph, NULL, NULL, 0);
for (int i = 0; i < 1000; i++) cudaGraphLaunch(graph_exec, stream);
```

## 可复用性：为什么越用越赚

图的价值在于"一次性准备，反复执行"：

- **图捕获/构建**：约 100 ms（一次性），记录或构建图结构
- **实例化**：一次性，完成校验、优化与执行准备
- **首次执行**：约 10 μs，一条命令启动整张图
- **后续每次执行**：约 10 μs——参数校验、内核选择、内存与缓冲准备等昂贵的活都已在实例化时做完

对比单次 20–200 μs 的逐内核启动开销，CUDA Graph 把"每次都要付"变成了"只付一次"。它尤其适合：训练循环（前后向操作每轮重复上千次）、推理服务（同一模型图处理海量请求）、仿真时间步、以及直到收敛为止的迭代算法。

## 框架视角：PyTorch、TensorFlow/JAX 与 CUDA C++

| 场景 | 推荐方式 |
|---|---|
| PyTorch | 底层就是流捕获：`torch.cuda.graph()` 自动完成开始捕获、录制模型、结束捕获与实例化，把要图化的代码包进上下文即可 |
| TensorFlow / JAX | 走"命令缓冲"路线，基于显式构建：`tf.function` + XLA、JAX 的 JIT 编译会隐藏这些细节 |
| CUDA C++ | 大多数场景用流捕获；只有需要程序化生成复杂图、跨图复用/组合组件、按运行时逻辑条件建图、做自定义图优化时才用显式构建 |

## 高级特性

- **图更新（Graph Updates）**：只改动少量参数（如内核参数或内存地址）时，可以直接原地更新已实例化的图，比重捕获整张图快得多
- **设备端图启动（Device-Side Graph Launch）**：GPU 上的内核可以直接启动另一张图，无需 CPU 参与，实现分层执行模式，减少 CPU-GPU 往返
- **条件节点（Conditional Nodes）**：图里可以包含在 GPU 上运行时求值的分支逻辑，让静态图具备一定动态性

这些高级特性主要面向 CUDA C++ 开发者，大多数 PyTorch 用户用不到，但知道它们存在总没坏处。

## 核心总结

- **问题**：CPU 启动开销（20–200 μs/次）让 GPU 在"小内核、高频启动"场景下大量空转
- **方案**：把操作与依赖打包成 DAG，定义 → 实例化（一次）→ 反复执行（约 10 μs/次）
- **上手**：PyTorch 用 `torch.cuda.graph()`；已有 CUDA 代码用流捕获包一层即可；复杂场景才需要显式构建
- **进阶**：图更新、设备端启动与条件节点可以在更深的场景里进一步省掉往返

参考：

- [Introduction | CUDA Graph Basics](https://docs.nvidia.com/dl-cuda-graph/latest/cuda-graph-basics/introduction.html)（NVIDIA）
- [CUDA Graph | CUDA Graph Basics](https://docs.nvidia.com/dl-cuda-graph/latest/cuda-graph-basics/cuda-graph.html)（NVIDIA）
- [CUDA Graphs | CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html)（NVIDIA）
