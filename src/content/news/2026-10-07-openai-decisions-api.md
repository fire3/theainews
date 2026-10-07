---
title: "OpenAI 上线 Decisions API：用 gpt-6-luna 换回「一个概率」而不是一段话"
description: "OpenAI 公开测试新版 Decisions API：开发者用 predicate、choice、score 三种问题类型，让 gpt-6-luna 对文本或图像返回概率化答案，官方称比 Responses API 快约 10 倍。"
pubDate: 2026-10-07
author: "林晓"
category: "tools"
tags: ["OpenAI", "Decisions API", "gpt-6-luna", "API", "结构化输出", "内容分类", "路由", "数据驻留"]
image: "/covers/2026-10-07-openai-decisions-api.jpg"
imageAlt: "封面：深色科技风，中央三个并列的类型化答案标签与标题「Decisions API」示意"
topStory: true
---

OpenAI 在 2026 年 10 月 6 日把 Decisions API 推向公开测试版（此前在 DevDay 2026 上做过限量预览），官方称预计「未来几周内」正式可用。它解决的问题很具体：<strong>很多应用并不需要模型「写一段话」，只需要模型给出一个可编程的判断</strong>——条件是否成立、属于哪个类别、严重程度几分。Decisions API 就是用专用端点 `POST /v1/decisions` 直接返回这类答案，官方称其速度约为 Responses API 的 10 倍。目前唯一可用的模型是 `gpt-6-luna`。

## 一次请求的三段结构

请求只包含三部分：`model`（执行评估的模型，目前仅支持 `gpt-6-luna`）、`input`（供所有问题共享的证据，可以是纯文本，也可以是含文本与图像的 user 消息）、`questions`（要评估什么，包含每个问题的类型、指令，以及可选项或评分等级）。响应里是一个 `answers` 数组；开发者给每个问题起唯一的 `name`，API 会在答案中原样回传，方便对应。

## 三种问题类型：谓词、选择、评分

| 类型 | 用途 | 返回结果 |
| --- | --- | --- |
| `predicate` | 判断条件是否成立，例如「照片里有没有可见损伤」 | `probability`：0–1 的概率估计 |
| `choice` | 从固定选项里选一个，例如工单归属部门或内容分类 | `choice`：你提供的某个取值，另有 `probabilities` 与 `confidence` |
| `score` | 按有序等级打分，例如问题严重程度 | `score`：各等级索引的概率加权平均 |

`choice` 与 `score` 都会返回离散选项上的概率分布，区别在语义：<strong>没有顺序的类别用 `choice`，有顺序的等级用 `score`</strong>。`score` 取等级数字索引的概率加权平均，因此结果可以落在两个等级之间——例如 Cosmetic（0）概率 0.1、Workaround available（1）概率 0.7、Fully blocked（2）概率 0.2，最终得分就是 1.1。

`predicate` 的典型用法是图像检查。下面是文档中用于演示「照片里有没有凹痕」的产品图，以及返回 0.92 概率的示例响应——开发者设定阈值后，可以把不确定的照片送进人工复核队列。

![文档示例：带明显凹痕的马克杯，用于演示 predicate 类型问题（图源：OpenAI 文档）](/images/openai-decisions-dented-mug.jpg)

![文档示例：变形的易拉罐，同样用于演示「可见损伤」判定（图源：OpenAI 文档）](/images/openai-decisions-can.jpg)

`score` 的演示则用一组包装箱照片展示从「无损伤」到「严重损伤」的等级划分：

![文档示例：用 score 类型对包装损伤程度分三级（图源：OpenAI 文档）](/images/openai-decisions-package-levels.jpg)

`choice` 的例子是工单路由：把「我被重复扣款」的客户投诉分派给 billing、technical、shipping、other 之一，响应会给出完整的概率数组（例如 billing 0.95、technical 0.02、shipping 0.01、other 0.02）以及单独的 `confidence` 字段。OpenAI 建议<strong>始终准备一个兜底选项（如 `other`）</strong>，把不在预设类别内的输入交给通用复核队列。

## 什么时候该用它，什么时候不该

官方给的边界很清楚：当应用需要的答案是上面三种之一时用 Decisions；如果需要的是<strong>符合自定义 JSON schema 的对象</strong>（例如抽取字段、生成说明文字），应该用 Responses API 的 Structured Outputs；如果需要模型发起工具调用，则用 function calling。

关于提问方式，文档给了几条务实建议：把独立的问题放进同一个 `questions` 数组，一次请求共享输入即可同时判断（例如同一张产品照既查损伤、又分品类）；但<strong>如果后一个问题依赖前一个答案，就要拆成两次请求</strong>（先判断有无损伤，再决定维修类别）。同时，问题要围绕可观察的标准来写，把不同关注点拆成不同问题，选项之间含义要互斥，评分等级之间的标准要能区分开。

图像输入有一个明确限制：<strong>只支持内联 base64 data URL，不支持托管的 HTTP/HTTPS 图片地址，也不支持 `file_id`</strong>；图像需要和 `input_text` 指令一起放进 user 消息中。

## 价格、数据控制与语音

定价是 Decisions API 最有辨识度的一点：使用 `gpt-6-luna` 时<strong>输入每百万 token 收 0.10 美元，只按输入计费，缓存读取、缓存写入与输出 token 都不收费</strong>；区域处理附加费与长上下文输入的价格乘数仍然适用，且这些费率只针对 `/v1/decisions`，同一模型走其他接口时按对应模型与处理档位计价。

合规方面，Decisions API 对符合条件的客户支持零数据留存（ZDR）与 HIPAA 用途，数据驻留与区域处理支持美国与欧洲（EEA + 瑞士），具体资格、所需协议与限制需参考数据控制文档。此外文档还提到可以结合 Live API 的客户端委派（client delegation），从语音请求中选出动作并把结果回报给用户。

## 核心总结

- <strong>是什么</strong>：公开测试中的 Decisions API，用专用端点 `POST /v1/decisions` 对文本或图像返回「类型化答案」，官方称比 Responses API 快约 10 倍，目前仅支持 `gpt-6-luna`
- <strong>三种问题类型</strong>：`predicate` 返回 0–1 概率；`choice` 返回固定选项之一加概率数组与置信度；`score` 返回有序等级的概率加权平均（可落在等级之间）
- <strong>与 Structured Outputs 的分工</strong>：需要自定义 JSON 结构或函数调用时仍用 Responses API；Decisions 只覆盖概率、选择、评分这三类判断
- <strong>使用要点</strong>：每个问题要有唯一 `name`；独立问题可合并到一次请求，依赖关系需拆成多次；`choice` 建议保留兜底选项；图像只接受内联 base64，不支持托管 URL 与 `file_id`
- <strong>价格与合规</strong>：输入每百万 token 0.10 美元，缓存读写与输出不计费；支持 ZDR 与 HIPAA（需符合条件），数据驻留覆盖美国与欧洲（EEA + 瑞士）
- <strong>SDK 要求</strong>：Python 3.26.0、JavaScript 7.30.0、Go 3.73.0、Ruby 0.101.0、Java 4.78.0 及以上

原文：[Decisions](https://developers.openai.com/api/docs/guides/decisions)（OpenAI API 文档）

延伸：[OpenAI Releases Decisions API in Public Beta, Powered by GPT-6 Luna](https://www.unite.ai/openai-releases-decisions-api-in-public-beta-powered-by-gpt-6-luna/)（Unite.AI，2026-10-06）
