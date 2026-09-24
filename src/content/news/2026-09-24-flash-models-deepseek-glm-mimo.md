---
title: "四款 Flash 模型横评：DeepSeek V4/V4.1、GLM-5.3、MiMo-V2.6 的参数、架构与跑分对比"
description: "基于官方发布数据对比 DeepSeek V4 Flash、V4.1 Flash、GLM-5.3 Flash、MiMo-V2.6 Flash 的参数规模、架构路线、主流评测成绩与 API 价格。"
pubDate: 2026-09-24
author: "林晓"
category: "models"
tags: ["DeepSeek", "GLM", "MiMo", "开源模型", "Flash", "模型对比"]
image: "/covers/2026-09-24-flash-models-deepseek-glm-mimo.jpg"
imageAlt: "封面：深炭黑与琥珀黄斜切的杂志风版面，大字标题「四款 Flash 横评」，副标题列出 DeepSeek V4/V4.1、GLM-5.3、MiMo-V2.6，下方四根高低错落的琥珀黄柱状色块"
topStory: true
---

2026 年的「Flash 档位」已经不是廉价缩水版的代名词：4 月 24 日 DeepSeek 发布 V4 Flash（7 月 31 日 API 正式版），8 月 26 日智谱发布 GLM-5.3-Flash，9 月 10 日 DeepSeek 发布 V4.1 Flash，9 月 22 日小米发布 MiMo-V2.6-Flash。四款模型全部以 MIT 许可开源、支持 100 万 token 上下文，且官方口径都宣称「以 Flash 成本逼近旗舰能力」。本文只依据各家官方发布数据（官方博客、Hugging Face 模型卡、技术报告），从参数规模、技术特点、主流评测三个维度做横向对比。

## 参数规模：四款都是千亿级 MoE

| 模型 | 发布日期 | 总参数 | 激活参数 | 架构 | 上下文 | 输入模态 | 许可 |
|---|---|---|---|---|---|---|---|
| DeepSeek V4 Flash | 2026-04-24（0731 正式版） | 284B | 13B | MoE | 1M | 文本 | MIT |
| DeepSeek V4.1 Flash | 2026-09-10 | 552B | 8B（prefill）/ 16B（decode） | Causal Encoder-Decoder MoE | 1M | 文本 + 图像 | MIT |
| GLM-5.3-Flash | 2026-08-26 | 320B | 18B | MoE（45 层） | 1M | 文本 + 图像 | MIT |
| MiMo-V2.6-Flash | 2026-09-22 | 309B | 15B | MoE（256 专家激活 8） | 1M | 全模态（文本/图像/视频/音频） | MIT |

![四款 Flash 模型的总参数与激活参数对比](/images/2026-09-24-flash-models-deepseek-glm-mimo/params.svg)

有两点值得注意。第一，V4.1 Flash 的总参数（552B）是四者中最大的，但它的激活参数是不对称的——预填充阶段仅激活 8B、解码阶段激活 16B，这是四款模型中最低的实际推理开销。第二，MiMo-V2.6-Flash 是唯一支持视频与音频输入的全模态 Flash，视觉与音频编码器（681M ViT + 308M AudioTokenizer）也计入了总参数之外的额外组件。

## 技术特点：四条不同的效率路线

- **DeepSeek V4 Flash——把长上下文成本打下来**：采用 Compressed Sparse Attention（CSA）与 Heavily Compressed Attention（HCA）混合注意力，配合 Manifold-Constrained Hyper-Connections（mHC）与 Muon 优化器，32T token 预训练；后训练为两段式：先独立培养领域专家（SFT + GRPO），再通过在线蒸馏（on-policy distillation）合并为单一模型。提供 Non-think / Think High / Think Max 三档推理模式。

- **DeepSeek V4.1 Flash——非对称结构与 KV Cache 极限压缩**：全新 Causal Encoder-Decoder 结构，40 层中 20 层因果编码器 + 20 层解码器，解码器的全局 KV Cache 直接由编码器末层隐状态投影得到，因此 prefill 只激活 8B。压缩稀疏注意力 CSA2 为每层分配 Full / Reindex / Reuse 三档静态模式，叠加 FP4 主 KV 缓存后，全局 KV Cache 降到 890 字节/token——约为 V4 Flash 的 1/4、初代 DeepSeek 模型的 1/437。此外引入 196B 的 Engram 条件记忆与 DSpark 投机解码，45T token 多模态预训练，推理力度可在 1–100 之间连续调节。

- **GLM-5.3-Flash——重训基座而非蒸馏**：官方明确它不是旗舰 GLM-5.3 的蒸馏版，而是重新训练的基础模型，30T token 多模态语料。GLM 系列首次结合线性注意力与稀疏注意力（IndexPool 将四个 indexer key 压缩为一个），相比 GLM-5.3 注意力计算量降低约 3.01 倍、KV Cache 降低约 4.44 倍——这是它能以 Flash 定价支撑 1M 上下文的技术前提。发布前曾以匿名模型 ox-alpha 在 OpenCode 与 OpenRouter 上实测。思考档位为 low / high / max 三档，不可关闭思考。

- **MiMo-V2.6-Flash——把强化学习算力规模化**：走 RSI（递归自我改进）路线，核心是「You Only RL Once」——编码、通用 Agent、视觉、网络安全任务在同一个混合批次里做全异步 GRPO，单步 1,568 个样本 × 16 次采样、支持 1M 上下文训练，单步消耗 3.5–3.7B token。配套 Groupwise Reward Synthesis 与 Groupwise Advantage Redistribution 让评分器在组内对通过的解法继续排序，形成自改进闭环；训练中冻结 MoE Router 抑制专家负载漂移，并用 MOPD2 多前缀蒸馏收尾。Flash 版 RL 训练约 6 天、30 步、约 75 万条轨迹，成本约 85 万美元，DeepSWE v1.1 从 48.8 提升到 65.7。

## 主流评测集对比

下表前三列分数取自 DeepSeek 2026 年 9 月 10 日官方对比表（同一评测框架，横向可比性最强），MiMo 列取自小米官方模型卡；各家 harness 不同，GLM 与 MiMo 的自家口径成绩与 DeepSeek 框架下的数字存在出入（例如 GLM-5.3-Flash 的 Terminal-Bench 2.1 在 z.ai 官方跑分图中为 84.3、DeepSWE 为 63.4），表中已按来源分别标注。

| 评测集 | DeepSeek V4 Flash | DeepSeek V4.1 Flash | GLM-5.3-Flash | MiMo-V2.6-Flash |
|---|---|---|---|---|
| Terminal-Bench 2.1 | 82.7 | **90.6** | 88.2 | 87.6 |
| DeepSWE v1.1 | 54.4 | **74.2** | 66.9 | 67.9 |
| Terminal-Bench 4.0 | 7.0 | 31.2 | **37.9** | 28.8 |
| AutomationBench | 37.7 | **54.8** | 48.8 | 52.3 |
| Agents' Last Exam | 25.2 | **31.8** | 28.5 | 27.6 |
| CyberGym | 76.7 | 88.1 | 84.5 | **95.1** |
| GPQA Diamond | 89.9 | **90.9** | 88.1 | 未公布 |
| HLE（纯文本子集） | 37.8 | 36.8 | **42.0** | 未公布 |
| ProgramBench | 未公布 | 20.3 | 19.0 | **26.0** |
| Toolathlon-Verified | 70.3 | 未公布 | **78.4**（自家口径，1/14） | 73.6 |

注：GLM-5.3-Flash 与 DeepSeek 三行取自 DeepSeek 官方对比表；Toolathlon 一行取各家官方口径；星号项按各模型官方最大推理力度（max effort）测试。

![四款 Flash 模型在六个主流评测集上的得分对比](/images/2026-09-24-flash-models-deepseek-glm-mimo/benchmarks.svg)

从同源数据看，**V4.1 Flash 在长程软件工程与终端任务上领先**：Terminal-Bench 2.1 拿到 90.6，是官方对比表中唯一突破 90 的模型，DeepSWE v1.1 的 74.2 甚至略高于 Claude Opus 5（74.0）。GLM-5.3-Flash 的强项在更新的 Terminal-Bench 4.0（37.9，四者最高）与 Toolathlon；MiMo-V2.6-Flash 则在 CyberGym 上以 95.1 排名第一，也是小米官方表中唯一超过自家 Pro（94.0）的项目。发布最早的 V4 Flash 各项垫底属于代际差，但其 0731 版本的 Terminal-Bench 2.1（82.7）仍高于两个月前的多数旗舰。

第三方综合指数方面，智谱官方披露 GLM-5.3-Flash 的 Artificial Analysis 智能指数为 57 分、每任务成本约 0.045 美元（折扣价）；小米官方披露 MiMo-V2.6-Pro 为 46 分（Flash 版未公布）；DeepSeek 官方未公布该项分数。

## 价格与开源

| 模型 | 输入（/百万 tokens） | 输出（/百万 tokens） | 缓存命中 | 备注 |
|---|---|---|---|---|
| DeepSeek V4.1 Flash | 高峰 2 元 / 闲时 1 元 | 高峰 8 元 / 闲时 4 元 | 0.04 / 0.02 元 | 9 月 10 日起降价，最高降 60%，峰谷定价 |
| DeepSeek V4 Flash（历史价） | $0.14 | $0.28 | $0.0028 | 旧模型名已路由至 V4.1 Flash |
| GLM-5.3-Flash | $0.15 | $0.50 | $0.03 | 发布期 5 折已于 9 月 9 日结束 |
| MiMo-V2.6-Flash | 1 元 / $0.14 | 2 元 / $0.28 | 0.02 元 / $0.0028 | 与 V2.5 系列价格持平 |

四款模型权重全部托管在 Hugging Face、MIT 许可、可免费商用。工程侧支持也很接近：SGLang 与 vLLM 均有官方 cookbook/recipe，GLM-5.3-Flash 匿名测试期的推理流量由中国产 AI 芯片集群承载，DeepSeek 则面向 2K 卡 GPU 的大规模部署需求开放合作。

## 核心总结

- **参数规模不再是能力的瓶颈**：284B–552B 的 MoE 配合 8B–18B 激活，四款 Flash 全部达到一年前旗舰的水平，1M 上下文成为标配。
- **架构创新比堆参数更有效**：V4.1 Flash 用非对称 CED 结构把 prefill 成本压到 8B 激活、KV Cache 压到 890 字节/token，是目前官方口径中效率最激进的设计。
- **评测冠军各有所长**：V4.1 Flash 赢在终端与长程软件工程（TB2.1 90.6、DeepSWE 74.2），GLM-5.3-Flash 赢在更新的 TB4.0 与工具编排，MiMo-V2.6-Flash 赢在网络安全（CyberGym 95.1）。
- **价格战已经打到谷底**：四者输出价格都在每百万 tokens 0.28–0.5 美元（或 2–8 元）区间，DeepSeek 还引入了闲时半价的峰谷定价。

官方来源：

- [DeepSeek V4.1 Flash 官方发布](https://www.deepseek.com/news/deepseek-v4-1-flash/) · [技术报告（PDF）](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf) · [模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash)
- [DeepSeek-V4 技术报告（arXiv:2606.19348）](https://arxiv.org/abs/2606.19348) · [DeepSeek-V4-Flash 模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)
- [GLM-5.3-Flash 官方博客](https://z.ai/blog/glm-5.3-flash) · [GLM-5 技术报告（arXiv:2602.15763）](https://arxiv.org/abs/2602.15763) · [模型卡](https://huggingface.co/zai-org/GLM-5.3-Flash)
- [MiMo-V2.6 官方发布](https://mimo.mi.com/docs/zh-CN/news/latest/v2-6) · [MiMo-V2.6-Flash-RL 模型卡](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL)
