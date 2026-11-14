---
title: "2026 年 RAG 技术综述：从混合检索到 Agentic RAG 的演进与开源生态全景"
description: "梳理 RAG 从朴素管线到智能体化的四代范式演进，覆盖混合检索、上下文工程、图结构、多模态等关键技术及代表数据，并对比主流开源系统的选型要点。"
pubDate: 2026-11-14
author: "林晓"
category: "research"
tags: ["RAG", "检索增强生成", "Agentic RAG", "GraphRAG", "上下文工程", "向量数据库", "开源"]
image: "/covers/2026-11-14-sota-rag-survey.jpg"
imageAlt: "封面：白底极简风，左侧标题「RAG 技术综述 2026」与三条要点（Contextual Retrieval 失败率最高降 67%、LightRAG 双层图检索、Deep Research 智能体化检索），右侧亮青节点连线图"
topStory: true
---

检索增强生成（Retrieval-Augmented Generation，RAG）在 2023 年作为缓解大模型幻觉、注入私有知识的技术手段出现，此后三年间经历了从固定管线到智能体系统的完整演进。到 2026 年，RAG 已经不再是「向量库 + 提示词」的简单组合：检索质量工程、图结构组织、多模态理解与智能体化的检索决策共同构成了当前的技术版图，「检索」本身也被重新定位为上下文工程（Context Engineering）的一部分。本文综合近年论文、官方博客与开源社区的一手资料，梳理当前 SOTA 的 RAG 技术路线与开源系统生态。

## 四代范式：从朴素管线到 Agentic RAG

学术界通常将 RAG 的发展划分为三个阶段：朴素 RAG（Naive RAG，索引-检索-生成的直线管线）、高级 RAG（Advanced RAG，加入查询前后的优化与混合检索）和模块化 RAG（Modular RAG，管线可自由重组），这一三分法出自高阳等人 2023 年的综述《Retrieval-Augmented Generation for Large Language Models: A Survey》。2025 年以来，第四代范式 Agentic RAG 成为新的主线：由大模型智能体自主决定「何时检索、检索什么、如何使用」，检索降级为智能体工具箱中的一件工具。Singh 等人的《Agentic RAG Survey》按智能体数量、控制结构与自治程度给出了系统分类学。

值得注意的是，Agentic RAG 并不只是论文概念——OpenAI Deep Research、Gemini Deep Research、Perplexity 等产品本质上都是「规划-检索-阅读-再检索」的智能体循环，取代了单次检索的固定流程。

## 检索质量：混合检索加重排已成为事实标准

当前生产环境中效果最稳定的配置，是<strong>混合检索（BM25 + 向量）叠加交叉编码器重排</strong>。Wang 等人在 EMNLP 2024 的《Searching for Best Practices in Retrieval-Augmented Generation》中系统实测了检索、增强、生成各环节的配置组合，确认混合检索加重排优于单一向量检索。关键词检索在精确术语、产品型号、代码标识符等场景仍然不可替代——这也是 Anthropic Contextual Retrieval 方案同时保留 Contextual BM25 的原因。

嵌入模型方面，开源生态的头部持续迭代：<strong>BGE-M3</strong>（智源）至今仍是生产环境采用最广的多语言模型，单个模型同时输出稠密、稀疏与 ColBERT 多向量三种表示，天然覆盖混合检索的三条路径；<strong>Qwen3-Embedding</strong>（2025 年 6 月发布）登顶 MTEB 多语言榜单，配套的 Qwen3-Reranker 补齐了重排环节；NVIDIA 的 NV-Embed-v2 曾位居 MTEB 英文榜首但采用非商用许可。专有模型中，Gemini Embedding、Voyage 与 Cohere Embed 系列占据头部。MTEB 榜单本身也已演化为多语言、单语言与 RTEB 检索专项等多个榜单，社区共识是：榜单用于初筛，最终效果必须在目标语料上自测。

重排器（Reranker）方面，自托管场景的事实标准是 BAAI 的 bge-reranker-v2-m3；Cohere Rerank 是主流商用 API；ColBERT 式的 late interaction（多向量延迟交互）则在大规模场景下提供了介于双塔与全量交叉编码之间的延迟-精度折中。

## 分块与上下文工程：Contextual Retrieval 降 67% 失败率

分块（Chunking）从固定窗口切分进化为一门「上下文工程」。两个代表性工作：

- <strong>Anthropic Contextual Retrieval</strong>（2024 年 9 月）：用大模型为每个分块生成一段上下文描述作为前缀，再分别做上下文化嵌入与上下文化 BM25，检索失败率下降 49%，叠加重排后最高下降 67%。这套「先给分块补上下文，再走完整混合检索管线」的流程已成为高质量知识库的参考架构。
- <strong>Late Chunking</strong>（Jina AI）：先用长上下文嵌入模型对全文逐 token 编码，再对各个分块区间做池化，让每个分块天然携带全文语境，缓解「块边界切断指代关系」的问题。

语义分块与父子分块（small-to-big：小块用于检索、大块用于生成）则是工程侧的标准做法，LlamaIndex 与 LangChain 均已内置。

## 图结构 RAG：GraphRAG 与 LightRAG，热捧之后回归理性

图结构 RAG 用知识图谱组织语料，代表 2024-2025 年最受关注的技术方向：

- <strong>Microsoft GraphRAG</strong>：用大模型抽取实体关系构建图，再做社区层级摘要，擅长「全局性、主题型」问题；后续加入 DRIFT Search 混合检索与自动调参，LazyGraphRAG 把昂贵的索引推迟到查询期，官方称以全局检索约 0.1% 的索引成本达到相当质量。
- <strong>LightRAG</strong>（HKUDS，EMNLP 2025）：以双层检索（低层实体关系 + 高层主题）加增量更新对 GraphRAG 做轻量化，成本与延迟显著更低，已成为最流行的开源图 RAG 实现。
- <strong>HippoRAG 2</strong>（OSU，ICML 2025）：受海马体索引理论启发，结合知识图谱与个性化 PageRank，在事实、理解与联想记忆类任务上全面超过标准 RAG。

但 2025 年下半年开始，多项研究给图 RAG「降温」：有研究测得 GraphRAG 在 Natural Questions 这类单跳问答上反而比朴素 RAG 低约 13 个百分点；另有工作发现页面级检索上嵌入 RAG 的准确率与 F1 均高于 GraphRAG。目前的共识是：<strong>图结构只在多跳推理与语料级全局归纳上有增益</strong>，把它当通用升级并不划算，索引成本（大量 LLM 调用）也必须计入。

## 长上下文之争：RAG 没有死，但边界被重划

「长窗口模型会不会取代 RAG」是 2024-2025 年争论最激烈的问题。关键证据有两项：Chroma 的《Context Rot》实测 18 个主流模型在标称窗口内性能随输入 token 增长而退化；Databricks 的长上下文 RAG 实测覆盖 20 个模型、最长 200 万 token，发现只有少数 SOTA 模型能在 64K 以上保持精度，结论是长上下文「不是银弹」。Qdrant 的《Is RAG Dead?》则给出了偏长上下文的实测，但同时确认成本与延迟仍是检索的核心理由。

2026 年的落点已相当清晰：小语料、高频复用的场景可以直接把材料塞进上下文（配合提示词缓存）；大规模、多租户、高并发的知识库仍然必须走检索；两者混合——先检索缩小范围、再把候选放入上下文——是默认答案。RAG 的竞争议题从「要不要检索」变成了「如何做更好的上下文工程」。

## 多模态 RAG：ColPali 让 PDF 理解跳过 OCR

传统文档 RAG 依赖 OCR、版面分析与表格抽取的脆弱管线。ColPali（ICLR 2025）改用视觉语言模型直接对页面图像生成多向量嵌入，配合 late interaction 匹配，跳过整条解析管线，在 ViDoRe 基准上大幅领先，索引速度也提升一个数量级。其后续 ColQwen 系列（Qwen2-VL 骨干）已成为视觉文档检索的默认选择， Vectara、Qdrant 等检索产品已内置视觉 RAG 能力；开源侧 HKUDS 的 RAGAnything 将图表、公式、表格经 MinerU 解析后注入 LightRAG 图结构，代表「多模态 + 图结构」的结合方向。

## 开源系统全景：平台、框架与基础设施三层分化

截至 2026 年 11 月 14 日，主流开源 RAG 系统可分三层看：

<strong>开箱即用平台</strong>（适合快速搭建知识库应用）：

| 项目 | 定位 | Stars | 协议 |
| --- | --- | --- | --- |
| Dify | LLM 应用开发平台，可视化编排 + RAG + 模型管理 | 约 161k | 修改版 Apache 2.0 |
| Open WebUI | 自托管 LLM 前端，内置文档 RAG | 约 159k | 自定义品牌保护协议 |
| RAGFlow | 深度文档解析的 RAG 引擎，自述升级为「智能体原生数据库」 | 约 94k | Apache 2.0 |
| AnythingLLM | 本地优先的一体化 RAG + 智能体桌面应用 | 约 68k | MIT |
| FastGPT | 知识库问答与 Flow 编排平台 | 约 30k | Apache 2.0 附加条件 |
| WeKnora（腾讯） | 文档到智能体推理的知识平台 | 约 37k | MIT |

<strong>编排框架</strong>（适合自研管线）：LangChain（约 149k stars）定位已升级为「智能体工程平台」，LangGraph（约 45k stars）用状态机编排带循环的智能体，是 Agentic RAG 的事实标准之一；LlamaIndex（约 53k stars）仍是数据摄取、索引与检索抽象最全的框架；Haystack（约 27k stars）以清晰的 Pipeline 抽象深耕企业搜索场景；txtai（约 13k stars）提供轻量的单机语义搜索方案。

<strong>检索基础设施</strong>：向量数据库中，Milvus（约 47k stars）代表云原生分布式路线，Qdrant（约 36k stars）以 Rust 实现与过滤检索见长，Chroma（约 30k stars）主打开发者体验，pgvector（约 24k stars）让既有 PostgreSQL 用户零成本起步，「pgvector 起步、Milvus/Qdrant 扩容」是常见选型路径；Elasticsearch 与 OpenSearch 的 BM25 + HNSW 混合检索则是关键词与向量融合的工业基准。

两个值得注意的生态信号：

- <strong>协议分化</strong>：平台类项目（Dify、FastGPT、Open WebUI）纷纷转向带品牌保护与 SaaS 限制的自定义协议，而框架与基础设施类（LangChain、LlamaIndex、各向量库、BGE 系模型）维持纯 Apache/MIT。商用选型时必须区分「开源协议」与「源码可得」。
- <strong>品类洗牌</strong>：2024 年红极一时的演示级 RAG 套件正在退场——Weaviate 的 Verba（2026 年 6 月）与 TrueFoundry 的 Cognita（2026 年 3 月）先后归档，Kotaemon 的维护也明显放缓，其功能已被 Dify、RAGFlow 等平台吸收。

## 评估闭环：从「感觉不错」到指标化回归

SOTA 落地架构的最后一块拼图是评估。<strong>RAGAS</strong>（约 16k stars）以忠实度、答案相关性、上下文精确率、上下文召回率四类指标成为事实标准，并支持测试集自动生成；Amazon 的 RAGChecker 提供细粒度诊断，把错误归因到检索或生成环节，与人类判断的相关性优于 RAGAS；TruLens 的「RAG 三元组」（上下文相关性、有据性、答案相关性）适合线上追踪。LangChain 的《State of Agent Engineering》报告（1300+ 从业者调研）显示 57% 的组织已有智能体进入生产，而质量与可靠性是头号落地障碍——这正对应「评测-回归」闭环成为标配的趋势。

## 生产架构的收敛形态

综合上述技术，2025-2026 年生产级 RAG 架构已收敛为一个相对稳定的模板：

1. 文档智能解析（必要时走视觉路线）
2. 结构化分块：模板/语义分块，配合上下文补写
3. 混合检索：BM25 + 向量，多语言场景用 BGE-M3 或 Qwen3-Embedding
4. 重排：bge-reranker-v2-m3、Qwen3-Reranker 或商用 API
5. 上下文重组 + 引用溯源，交给 LLM 生成
6. RAGAS/Langfuse 式评估回归闭环监控线上质量

在此之上，按需叠加：多跳与全局问答加图结构（LightRAG/GraphRAG），复杂决策流升级为 Agentic RAG（LangGraph 编排），个人与小团队场景则直接选用 Dify、RAGFlow 等平台。

## 核心总结

- RAG 已从固定管线演进到 Agentic RAG：智能体自主决定何时与如何检索，Deep Research 类产品即这一范式的产品化
- 生产标配是「混合检索 + 重排 + 上下文补写」：Anthropic Contextual Retrieval 实测检索失败率最高降 67%，BM25 在精确术语场景仍不可替代
- 图结构 RAG（GraphRAG、LightRAG、HippoRAG 2）只在多跳与语料级归纳上有增益，多项 2025 年研究证实其通用场景收益有限、索引成本高
- 长上下文没有取代 RAG：Context Rot 等实测显示窗口内性能随输入增长退化，成本与延迟让检索仍是大规模场景的必选项，议题已转向上下文工程
- 多模态 RAG 以 ColPali/ColQwen 为代表，跳过 OCR 管线直接对页面图像建索引
- 开源生态分平台、框架、基础设施三层：Dify 与 RAGFlow 领跑平台层，LangChain/LangGraph 转向智能体工程，选型需注意协议分化与品类洗牌（Verba、Cognita 已归档）
- 评估闭环（RAGAS、RAGChecker）成为生产标配，质量与可靠性是企业落地的头号障碍

参考：

- [Agentic RAG Survey](https://arxiv.org/abs/2501.09136)（arXiv，2025）
- [Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval)（Anthropic，2024）
- [GraphRAG: From Local to Global](https://arxiv.org/abs/2404.16130)（arXiv，2024）与 [GraphRAG 官方文档](https://microsoft.github.io/graphrag/)
- [LightRAG](https://arxiv.org/abs/2410.05779)（arXiv，EMNLP 2025）
- [HippoRAG 2](https://arxiv.org/abs/2502.14802)（arXiv，ICML 2025）
- [Context Rot](https://research.trychroma.com/context-rot)（Chroma，2025）
- [Long Context RAG Performance of LLMs](https://www.databricks.com/blog/long-context-rag-performance-llms)（Databricks，2024）
- [ColPali](https://arxiv.org/abs/2407.01449)（arXiv，ICLR 2025）
- [Searching for Best Practices in Retrieval-Augmented Generation](https://arxiv.org/abs/2407.01219)（arXiv，EMNLP 2024）
- [State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering)（LangChain，2026）
- 主流项目仓库：[Dify](https://github.com/langgenius/dify)、[RAGFlow](https://github.com/infiniflow/ragflow)、[LangChain](https://github.com/langchain-ai/langchain)、[LlamaIndex](https://github.com/run-llama/llama_index)、[Milvus](https://github.com/milvus-io/milvus)、[Qdrant](https://github.com/qdrant/qdrant)、[RAGAS](https://github.com/explodinggradients/ragas)
