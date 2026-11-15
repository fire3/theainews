---
title: "2026 年 RAG 技术综述：从检索引擎到智能体上下文基础设施"
description: "聚焦 2026 年 1-11 月 RAG 领域进展：KV 缓存与记忆融合、嵌入层多模态军备赛、图 RAG 实证校准、平台全面 agentic 化与检索基础设施效率冲刺。"
pubDate: 2026-11-14
author: "林晓"
category: "research"
tags: ["RAG", "检索增强生成", "Agentic RAG", "上下文工程", "嵌入模型", "向量数据库", "2026 综述"]
image: "/covers/2026-11-14-sota-rag-survey.jpg"
imageAlt: "封面：深色科技风，标题「RAG 2026 年度综述」，三张数据卡片展示智能体进生产比例、RTEB 榜首分数与 RAGFlow 1.0 并发提升"
topStory: true
---

> 编者注：本文为 11 月 14 日版本的全面修订。应读者反馈，本版聚焦 2026 年 1-11 月的新进展；2024-2025 年的奠基性工作（HyDE、Self-RAG、ColPali、Contextual Retrieval、原始 GraphRAG 等）仅在必要处一句带过，老项目重点介绍其 2026 年的新特性。

2025 年及更早的 RAG 叙事是「把知识库接进大模型」：混合检索、重排、分块策略构成了那一代的最佳实践。到 2026 年，这个领域的自我定位发生了根本变化——检索不再是「给应用补知识」的插件，而是「给智能体供上下文」的基础设施。RAGFlow 在 11 月 6 日发布 1.0 时把官方标题直接改成了「Beyond RAG, Toward an Agent Native Database」，这个改名是全年趋势的缩影。综合今年 1-11 月的论文、模型发布与开源项目更新，2026 年的 RAG 领域呈现六条主线。

## 主线一：检索与推理侧融合，KV 缓存与记忆重划边界

2026 年最有技术含量的变化发生在检索与推理的交界处。1 月提交的 <strong>FusionRAG</strong>（arXiv:2601.12904）把 2024 年提出的缓存增强生成（CAG）路线推进一步：离线阶段在每个分块的 KV 缓存中预先嵌入其他相关块的上下文，在线阶段只对模型真正关注的 token 重算缓存——重算比例低于 15%，相同重算预算下归一化 F1 较基线最高提升 70%，首 token 延迟较全量注意力降低 2.66 到 9.39 倍。「缓存而非每次检索」从概念变成了有量化收益的工程选项。

与之平行的是<strong>记忆系统对部分检索场景的替代</strong>。OpenAI 在 6 月把 ChatGPT 的记忆升级为后台「做梦（Dreaming）」式整理与巩固，明确口径是不再需要检索层来决定什么进入上下文；11 月的 DISCERN（arXiv:2611.15729）与一项把两级对话记忆和 RAG 直接做配对评估的研究（arXiv:2611.09807），则把「memory 还是 retrieval」从口号变成了可比较的对象。Anthropic 在 4 月的 Managed Agents 指南中把上下文压缩（compaction）与文件式记忆工具并列为长任务的标准机制——压缩、缓存、记忆、检索在 2026 年被统摄进「上下文工程」这个伞形概念，长上下文本身也在扩张：OpenAI 在 9 月底 DevDay 上公布的 GPT-6 Astra 已把上下文推到 105 万 token。

## 主线二：嵌入层军备赛，多模态与共享嵌入空间成为标配

2026 年嵌入模型的发布密度罕见地高，且呈现出两个共同关键词：<strong>多模态</strong>与<strong>共享嵌入空间</strong>。

- <strong>Voyage 4</strong>（1 月 15 日）：行业首个家族内「共享嵌入空间」系列——14 个模型的向量可以互相比较；Voyage 已并入 MongoDB。
- <strong>Qwen3-VL-Embedding / Reranker</strong>（1 月 7 日）：把阿里 2025 年的文本嵌入能力扩展到文本+图像+视频混模输入，2B/8B 双档。
- <strong>jina-embeddings-v5</strong>（2 月）与多模态版 v5-omni（5 月）：最小 239M、上下文 32K、Matryoshka 维度可裁到 32。
- <strong>Gemini Embedding 2</strong>（3 月发布、4 月 GA）：Google 首个原生多模态嵌入，文本、图像、视频、音频、PDF 共享一个空间，3072 维。
- <strong>Microsoft Harrier OSS v1</strong>（4 月）：Bing/MSR 团队出品，MIT 许可、decoder-only 架构、270M 到 27B 多档，0.6B 版在多语言 MTEB v2 得 69.0；第三方评测称 27B 版为开源多语言检索最高分。
- <strong>NVIDIA Nemotron-3-Embed</strong>（7 月）：发布即登顶 RTEB 检索榜（78.5 分），NVFP4 量化版保留 99.5% 精度；10 月 21 日追加的 Nemotron-3.5 Embed / Rerank / Parse 三件套转向多模态与智能体检索，官方口径是加重排后智能体每查询 token 成本降约 13-14%。
- <strong>Cohere Embed 5</strong>（9 月 30 日）：Pro/Fast 双版本共享空间、128K 上下文、多模态，并提出「Pro 建索引、Fast 查询」的分工部署模式（交叉损失仅 1.6-2.7%）；在 ViDoRe V3 Pro 子榜以 85.8 超过 Voyage 4 Large 与 Gemini Embedding 2。

基准层面也在换血：企业场景多模态检索基准 ViDoRe V3（1 月发布论文）年内榜首至少三度易主，10 月已迭代到 v3.1；MTEB 排行榜 6 月大改版，RTEB 检索专项榜成为嵌入模型发布的标准秀场。值得一提的是，BAAI 的 BGE 系列今年没有发布 M3 的后继文本嵌入模型，而是在 4 月转向了「推理型检索」，开源的 BGE-Reasoner-preview 在需要推理的检索基准 BRIGHT 上拿到新 SOTA——嵌入层竞争的下一个焦点可能从「表征」转向「推理」。

## 主线三：实证校准之年，流行技巧被重新检验

如果说 2024-2025 年是 RAG 技巧的爆发期，2026 年则是对这些技巧的集中审计：

- <strong>图 RAG 的「算子词汇表」批判</strong>（arXiv:2606.06003，6 月）：对 8 种检索架构的系统分析提出，限制 LLM 图推理的不是模型智能，而是可用的计算算子——向量检索对 5 类查询「结构性不可达」，而带 9 个类型化遍历原语的 LLM 查询规划器 F1 达 0.632，专用定制处理器反而只有 0.472。结论不是「图 RAG 没用」，而是要用可组合的检索原语替代端到端图管线。
- <strong>语义分块的翻案</strong>（FloTorch 基准，2 月）：端到端测试中语义分块表现反而最差——平均块长仅约 43 token、准确率约 54%，挑战了「语义分块默认最优」的行业假设。
- <strong>融合检索增益被抵消</strong>（3 月）：有研究指出 multi-query fusion 与 RRF 的召回增益，可以被后续的重排加截断基本抵消——多招未必比一招好。
- <strong>工程收敛</strong>：Microsoft GraphRAG 全年只有维护性发布（v3.0.5 到 v3.3.0），LazyGraphRAG 无新消息；LightRAG 下半年转向存储后端工程（8 月起支持 PostgreSQL 原生图存储，去掉 Apache AGE 依赖）；RAGAnything 的创新重心移到音频/视频模态接入（9 月）。图 RAG 的概念爆发期结束了，剩下的是 11 月仍陆续出现的垂直化后续——隐私保护（DP-GraphRAG）、精确文档删除（Lightfoot）、RL 蒸馏图模式（PatternBloom）。

## 主线四：平台全面 agentic 化，「RAG 引擎」改名「上下文基础设施」

平台层是 2026 年姿态变化最剧烈的一层：

| 项目 | 2026 年关键动作 |
| --- | --- |
| RAGFlow | 11/6 发布 1.0：Go 重写（镜像缩小约 10 倍、启动快 10 倍、官方称并发约 100 倍），Agentic Chat 多步推理，「Jev 决策模型」判断检索证据是否充分，FRAMES 多跳基准 91%；定位改为「智能体原生数据库/上下文基础设施」 |
| Dify | 下半年连续 agentic 化：1.17（8 月）工作区级 Skills 管理与统一 tracing；1.18（10 月）Agent「Output Routes」让智能体决定工作流分支、Agent 知识库 beta；1.19（11 月）difyctl CLI |
| 腾讯 WeKnora | 8-10 月高速迭代：跨会话长期记忆、E2E 沙箱、插件体系（Go/Python SDK）、内置助手多智能体协作、定时执行智能体、独立图搜索 API |
| Open WebUI | 11 月 v0.13 系列：把 Claude Code、Codex 等编码智能体作为可选「模型」接入，桌面伴侣应用 Tether，工具调用 prompt caching |
| AnythingLLM | 10 月 v1.19 在容器内置本地 LLM 运行时 |
| FastGPT | 8-11 月 v4.15-v4.17，以系统模型配置校验、应用市场改版等工程化为主 |

编排框架同样在向智能体倾斜：<strong>Haystack</strong> 7 月 20 日发布 3.0——Agent 钩子系统、SkillToolset 渐进披露、同步异步管线合并，8 月 3.1 加上下文压缩钩子，11 月 10 日 3.5 又接入结构化输出钩子与面向 late-interaction 的多向量字段；<strong>LangChain</strong> 11 月 11 日的 v1.5 加入模型路由与 auto mode 中间件，langchain-core 1.8 引入「决策模型」抽象；<strong>LlamaIndex</strong> 全年维持 0.14.x，两波「多模态合成」是最大特性，官方博客明确表态「more than a RAG framework」；<strong>txtai</strong> 以近乎月更的节奏加入智能体记忆、编码智能体工具包与 LEMUR 学习型多向量检索。

## 主线五：检索基础设施为智能体冲刺效率

向量数据库今年的更新高度一致地指向「低延迟、低成本的智能体检索」，三条战线并行：

- <strong>量化军备赛</strong>：Qdrant v1.18（5 月）TurboQuant 官方称 8 倍压缩并移除 RocksDB；Weaviate 1.39（8 月）4-bit 旋转量化；Chroma 1.5.6（4 月）1-bit RaBitQ；Elasticsearch 9.2/9.3 把向量内存再降 95%（BBQ）并推出 DiskBBQ 磁盘向量检索（亚 20ms）。
- <strong>词法融合进入引擎内核</strong>：Qdrant v1.20（10 月）支持在全文索引上直接 BM25 打分；Chroma 1.5.9 推出 maxscore 稀疏检索引擎；Milvus 7 月 29 日的 3.0 GA 带 SINDI 稀疏索引、External Collection 数据湖联查与在线 schema 变更；OpenSearch 3.9（9 月）上原生神经稀疏引擎。
- <strong>多向量/late-interaction 进入主流引擎</strong>：Haystack 3.5 的 multivector 字段与 MaxSimRanker、Weaviate 1.40 的 HFresh 多向量磁盘索引、txtai 的 LEMUR、ColPali 生态的 ColQwen3.5 与可选 PLAID 加速——单向量嵌入的理论局限也在今年被形式化：8 月的研究（arXiv:2608.21494）证明单向量在 ANDOR 类查询上存在指数级表达能力差距。

## 主线六：评估左移进运行时，供应链安全成为主题

评估层最明显的变化不是指标，而是位置：<strong>评估逻辑正在被内联进检索与执行链路</strong>。以「决策模型」为代表的轻量判断模型今年几乎同月接入各家框架——langchain-core 1.8、Haystack 3.5 的路由/分类组件、Arize phoenix-evals 3.10 都对接了 OpenAI 的 Decisions API，RAGFlow 则用自研决策模型在检索后判断证据充分性。「检索质量好不好」不再只是 RAGAS 里的离线指标，而成了运行时的路由信号。RAGAS 本身迭代明显放缓（1 月与 11 月各一版，后者是安全修复），生态重心转向 Langfuse（11 月已到 v4.80，定时 trace 评估、AI 网关）与 Phoenix 一类全链路可观测工具。行业侧，LangChain 2 月发布的《State of Agent Engineering》（1300+ 从业者调研）显示 57% 的组织已有智能体进入生产（上年 51%），89% 具备智能体可观测性。

另一条容易被忽视的线是<strong>供应链安全</strong>：3 月 litellm 投毒事件迫使 GraphRAG 紧急钉版本，RAGAnything 与 RAGAS 年内先后修补 SSRF 漏洞，安全 RAG 已有系统综述（arXiv:2604.08304）。检索层作为「不可信外部内容的入口」，安全工程在 2026 年从论文话题变成了发布日志里的常客。

## 退场与洗牌

- 2024 年红极一时的演示级 RAG 套件批量退场：Weaviate 的 Verba（6 月 8 日归档）、TrueFoundry 的 Cognita（3 月 13 日归档）、nano-graphrag（1 月 27 日后无提交）。
- API 代际更替：Weaviate 10 月宣布弃用 GraphQL API，Milvus 3.0.3 移除 v1 REST 路由。
- 存量玩家的分化：要么找到 agentic 新定位（RAGFlow、Dify、WeKnora、Haystack），要么滑向维护态（GraphRAG、LlamaIndex 的核心 RAG 部分）。

## 核心总结

- 2026 年 RAG 领域的自我定位从「给应用补知识」转为「给智能体供上下文」，RAGFlow 1.0 的「agent-native database」改名是标志事件
- 检索与推理侧加速融合：FusionRAG 让 KV 缓存成为检索的替代/补充（重算低于 15%、首 token 延迟降 2.66-9.39 倍），memory 与检索的边界被正面评估
- 嵌入层军备赛的关键词是多模态与共享嵌入空间：Voyage 4、Gemini Embedding 2、Cohere Embed 5、Nemotron-3.5、Qwen3-VL 全线多模态；RTEB/ViDoRe V3 取代旧榜单成为发布标准秀场；BGE 转向推理型检索
- 2026 是实证校准之年：图 RAG 被重新表述为「检索算子」问题，语义分块与 multi-query fusion 的默认假设被实测翻案
- 平台层全面 agentic 化（Skills、多智能体协作、定时任务、决策模型），框架层（Haystack 3.x、LangChain 1.5）把 agent 钩子与上下文压缩变成一等公民
- 检索基础设施三线冲刺：量化（TurboQuant/BBQ/1-bit RaBitQ）、词法融合进内核（引擎内 BM25/稀疏引擎）、多向量进入主流引擎
- 评估左移进运行时（决策模型做路由信号），供应链安全从话题变成发布日志常客；演示级套件批量退场，行业向 agentic 定位收敛

参考：

- [FusionRAG: From Prefix Cache to Fusion RAG Cache](https://arxiv.org/abs/2601.12904)（arXiv，2026 年 1 月）
- [Beyond Vector Similarity: A Structural Analysis of Graph-Augmented Retrieval](https://arxiv.org/abs/2606.06003)（arXiv，2026 年 6 月）
- [RAG Chunking Strategies: The 2026 Benchmark Guide](https://www.premai.io/blog/rag-chunking-strategies-the-2026-benchmark-guide)（PremAI FloTorch，2026 年 2 月）
- [Voyage 4](https://blog.voyageai.com/2026/01/15/voyage-4)（Voyage AI，2026 年 1 月）
- [Gemini Embedding 2 GA](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2-generally-available)（Google，2026 年 4 月）
- [Cohere Embed 5](https://cohere.com/blog/embed-5)（Cohere，2026 年 9 月）
- [Nemotron-3-Embed Wins RTEB](https://huggingface.co/blog/nvidia/nemotron-3-embed-wins-rteb)（NVIDIA，2026 年 7 月）与 [Nemotron Retriever](https://huggingface.co/blog/nvidia/nemotron-retriever-world-class-agentic-retrieval)（2026 年 10 月）
- [What's new in Foundry Labs – April 2026](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/whats-new-in-foundry-labs---april-2026/4509714)（Microsoft，2026 年 4 月）
- [ViDoRe Leaderboard](https://huggingface.co/spaces/vidore/vidore-leaderboard)（HF，2026 年迭代至 v3.1）
- [RAGFlow v1.0.0 Releases](https://github.com/infiniflow/ragflow/releases)（2026 年 11 月）
- [Milvus 3.0 Releases](https://github.com/milvus-io/milvus/releases)、[Qdrant Releases](https://github.com/qdrant/qdrant/releases)、[Weaviate Blog](https://weaviate.io/blog)、[Haystack Releases](https://github.com/deepset-ai/haystack/releases)（2026 年）
- [State of Agent Engineering](https://www.langchain.com/resources/state-of-agent-engineering)（LangChain，2026 年 2 月）
- [DevDay 2026 Recap](https://openai.com/index/devday-2026-recap)（OpenAI，2026 年 10 月）
- [Retrieval Needs Multivectors: An Exponential Separation](https://arxiv.org/abs/2608.21494)（arXiv，2026 年 8 月）
- [A Survey of Secure RAG](https://arxiv.org/abs/2604.08304)（arXiv，2026 年 4 月）
