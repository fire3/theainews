---
title: "Simon Willison 实测 Qwen3.8-27B：很强，但默认疯狂「过度思考」"
description: "Simon Willison 实测 Qwen3.8-27B：17GB 量化模型可在笔记本本地运行，但默认 xhigh 推理档位常耗尽 8K 上下文，生成一幅鹈鹕骑自行车 SVG 竟思考了 21 分钟。"
pubDate: 2026-08-17
author: "林晓"
category: "models"
tags: ["Qwen", "Qwen3.8", "本地模型", "量化", "llama.cpp", "MTP", "实测"]
topStory: true
image: "/images/qwen-38-27b-review/qwen-thinking-bicycle-27b.jpg"
imageAlt: "Qwen3.8-27B 在推理模式下画出的鹈鹕骑自行车 SVG 渲染图"
---

Simon Willison 于 8 月 16 日发布了对**阿里开源多模态模型 Qwen3.8-27B** 的深度实测（其「个人设备上的 LLM」系列第 22 篇）。他评价这款 Apache 2.0、约 27B 参数、支持视觉的模型「非常出色」，但有一个突出的毛病：**默认以 `xhigh` 推理档位运行，经常在思考上「疯狂过度」，甚至耗尽默认的 8,192 token 上下文上限**。测试基于 128GB M5 Max MacBook Pro 与 NVIDIA DGX Spark，通过 LM Studio 与 llama-server 完成。

我们此前已介绍过[该模型的规格与基准](../../2026-08-14-qwen3-8-27b/)，本篇聚焦它在真实硬件上的使用体验。

## 「令人发笑的」过度思考

「17GB 的文件就能在我家机器上完成所有这些事，这简直是个奇迹。」Willison 写道，而这个问题出在默认行为上：Qwen 官方推荐 `xhigh` 推理档位「用于需要深入分析的复杂任务」，于是模型把它作为默认值——而实际上这个默认值「**funnily / hilariously（令人发笑地）**」过度。

一个典型例子：让它画「一只骑自行车的鹈鹕」SVG，模型用了 **21 分钟、22,276 个推理 token** 才产出 3,223 个输出 token。同样的提示关闭推理后仅需 **137 秒、3,715 token**。

![带推理模式时，Qwen 花了 21 分钟思考如何画一只骑自行车的鹈鹕](/images/qwen-38-27b-review/qwen-thinking-bicycle-27b.jpg)

![关闭推理后，同一提示 137 秒完成，画面简洁直接](/images/qwen-38-27b-review/qwen-no-reasoning-pelican-2.png)

「画一个圆形的 SVG」这样简单的请求，也触发了模型精细的自我设计决定——动画分层圆环、包豪斯配色方案的选择——最终交出一个「完全漂亮、但完全不是我要的东西」的动画圆。**建议：初期先以 `low` 或关闭推理运行。**

## 边界框（bounding box）测试

模型在 0–1000 坐标系上对照片中的鹈鹕给出了**高精度的边界框**，「精确框出了两块岩石上的两只鹈鹕，是完美的匹配」。

开启推理时，Qwen 仅凭一句提示就构建出一个功能完整的 HTML 边界框标注工具；它还擅自加了功能，包括一个演示场景与按精确坐标摆放的鹈鹕剪影。关闭推理时工具几乎能工作，但框被放到了错误位置——Willison 评价「推理确实能带来差别」。

## 编码智能体实测

Willison 将 [Pi](https://pi.dev/) 配置为经由 LM Studio 调用 Spark 上的 Qwen3.8-27B（通过 Tailscale 共享），在 `~/.pi/agent/models.json` 中注册模型并开启 `"reasoning": true`。模型成功通过多步工具调用回答了 datasette 代码库中「auth 是怎么工作的」，随后写出了 Python 脚本将自身的 JSONL 会话转录转成 Markdown，并测试运行通过。

## 速度：15–30 token/秒

本地运行时序约 **15–30 token/秒**，Willison 表示「不算太糟，但慢到不足以把我从托管 API 模型那儿赢走」——对比 OpenAI 5.6 Sol 的 74 token/秒、5.6 Luna 的 184 token/秒。

一个值得一提的优化是 **多 token 预测（MTP）**：在 Spark 上用 `--spec-type draft-mtp`（草稿模型 Q4_0）运行 llama.cpp，比 LM Studio 默认 GGUF 在同基准上**快约 72%**。

## 核心总结

- **能力**：Qwen3.8-27B 在 17GB 量化包内提供视觉理解与智能体能力，「一年前这也能和最贵最好的专有模型竞争，今天它能在能装进口袋的笔记本上运行」
- **默认行为是最大槽点**：默认 `xhigh` 推理档位常导致海量无效思考，建议手动调低
- **本地速度**：15–30 token/秒可接受但偏慢；llama.cpp 的 MTP draft 能再提速约 72%
- **结论**：「我们不必花 50 万美元买数据中心级硬件，就能跑一个称职的模型」——这个尺寸的模型正以惊人的速度变得更好

原文：[Qwen 3.8 27B is excellent, but it defaults to wildly overthinking things](https://simonwillison.net/2026/Aug/16/qwen-38-27b/)（Simon Willison，2026-08-16）
