---
title: "寒武纪成为 PyTorch 基金会白金成员：中国 AI 芯片首次进入理事会"
description: "寒武纪加入 PyTorch 基金会并成为最高级别白金成员，两人进入理事会与技术咨询委员会，中国 AI 芯片首次参与全球开源生态决策。"
pubDate: 2026-09-08
author: "林晓"
category: "industry"
tags: ["寒武纪", "PyTorch", "AI 芯片", "开源生态", "vLLM", "DeepSeek"]
image: "/covers/2026-09-08-cambricon-pytorch-platinum.jpg"
imageAlt: "封面：工程蓝图风格，米白网格底配工程蓝与琥珀线条，居中主视觉为带分栏尺寸标注的芯片结构示意图与连接节点，标题「寒武纪加入 PyTorch 理事会」与副标题居中排布"
topStory: true
---

9 月 8 日，寒武纪宣布正式成为 PyTorch 基金会最高级别的<strong>白金成员</strong>，并进入其理事会。继今年 5 月阿里云成为白金成员后，又一家中国公司加入这一开源组织决策层；寒武纪派出的两名技术代表，分别进入理事会与技术咨询委员会。

## 白金席位意味着什么

PyTorch 基金会是 Linux 基金会旗下的开源 AI 组织，管理者 PyTorch、vLLM、DeepSpeed、Ray 等核心项目。截至 2026 年，PyTorch 社区已聚集来自 2000 多家机构的 1.2 万名贡献者。基金会 2022 年成立时，创始成员是 Meta、AMD、AWS、Google Cloud、Microsoft、NVIDIA 等全球巨头；理事会决定设备接口如何抽象、哪些能力进入主干，直接关系到「换一块芯片，代码要不要重写」。

## 从「适配者」到「共建者」

寒武纪走的是 Upstream First 路线：改动先提交回 PyTorch 公共主干，而非维护私有分支。其代码已覆盖 torch.compile、Eager 算子、设备运行时、分布式计算、混合精度、Dataloader 与 Profiler 等七个主干模块；同时与 vLLM 社区合作，把 DeepSeek-V4、GLM-5 等主流开源大模型做到<strong>Day 0 适配</strong>——模型发布当天即可在寒武纪硬件上运行。

## 两个技术席位

寒武纪 AI 框架高级总监王进进入理事会；PyTorch 核心维护者朱靖进入技术咨询委员会，围绕后端集成机制 PrivateUse1 构建 Torch-MLU 扩展。软件工程副总裁 Elton Gong 表示，持续的主干共建能统一框架接口、降低迁移成本；PyTorch 基金会执行董事 Mark Collier 则欢迎寒武纪加入，称任何加速器要规模化成功，都必须贯穿 AI 开发全生命周期。

核心总结：
- 寒武纪成为 PyTorch 基金会白金成员，两人分别进入理事会与技术咨询委员会
- Upstream First：改动直提交主干，已覆盖七个模块，并在 vLLM 上实现 DeepSeek-V4、GLM-5 的 Day 0 适配
- 从框架「适配者」转向「共建者」，中国 AI 芯片首次进入全球开源生态决策层

原文：[寒武纪拿下 PyTorch 基金会白金成员，进入理事会](https://mp.weixin.qq.com/s/T9m5soH-01HtMnLlswcNFQ)（新智元 via ASI启示录，2026 年 9 月 8 日）
