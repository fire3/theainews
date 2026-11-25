---
title: "PaperOrchestra：谷歌开源多智能体论文写作框架，五个 Agent 从实验日志写到投稿级 LaTeX"
description: "谷歌开源多智能体论文写作框架 PaperOrchestra：五个 Agent 从想法草稿与实验日志写出投稿级 LaTeX，人类评测中综述质量领先基线 50–68 个百分点。"
pubDate: 2026-11-25
author: "林晓"
category: "research"
tags: ["PaperOrchestra", "多智能体", "论文写作", "Google Cloud AI Research", "PaperWritingBench", "自动科研"]
image: "/covers/2026-11-25-paper-orchestra-multi-agent-paper-writing.jpg"
imageAlt: "封面：工程蓝图风格的五个节点结构示意，中央为论文稿件轮廓，周围环绕大纲、绘图、文献、写作、打磨五个模块"
topStory: true
---

2026 年 11 月 25 日，Google Cloud AI Research 的 PaperOrchestra 仓库在 GitHub 上已积累 6,362 星标与 822 个 fork。这个项目对应团队 4 月提交的论文（arXiv:2604.05018），作者是 Yiwen Song、Yale Song、Tomas Pfister 与 Jinsung Yoon。它要做的事一句话就能说清：把「一个不成熟的想法 + 一堆实验日志」直接变成符合会议模板、可编译的投稿级 LaTeX 稿件，并顺带生成图表、做完整文献综述。

这个方向并不新。AI Scientist、CycleResearcher、AI-Researcher 都在做端到端科研自动化，但它们的写作模块都绑死在自己的实验循环里，无法作为独立工具，接受人类已经做完实验、只差动笔的那批材料。PaperOrchestra 的全部设计取舍，都指向这个缺口。

## 一、把写作拆成五个并行环节

框架的输入是五元组：想法摘要（Idea Summary）、实验日志（Experimental Log）、目标会议的 LaTeX 模板、会议写作规范，以及可选的已有插图。输出是一份 .tex 源码加编译好的 PDF。中间过程交给五个专职 Agent，其中绘图与文献两步并行执行。

| Agent | 职责 | 默认实现 |
| --- | --- | --- |
| 大纲（Outline） | 输出 JSON 大纲：可视化计划（图表类型、数据来源、长宽比）、宏观+微观的检索策略、逐节写作要点与引用提示 | — |
| 绘图（Plotting） | 按可视化计划生成统计图与概念示意图，由视觉模型批评家闭环修正 | PaperBanana |
| 文献（Literature Review） | LLM 联网找候选论文，Semantic Scholar API 验真，按时间截断过滤，去重后自动生成 .bib | 自建 |
| 写作（Section Writing） | 从实验日志抽取数值构造表格，撰写摘要、方法、实验与结论，并嵌入生成的图 | — |
| 打磨（Content Refinement） | 模拟同行评审打分，改动后总分上升或打平且子项不倒退才接受，否则回滚 | AgentReview |

![PaperOrchestra 框架总览：专职 Agent 解析非结构化输入，合成图表与文献，编译完整初稿，再迭代打磨为可投稿 PDF](/images/paperorchestra-overview.png)

*图片来源：[项目页](https://yiwen-song.github.io/paper_orchestra/)*

文献环节是这套流水线里最值得看的一段。它不是让模型凭参数记忆「回忆」参考文献，而是先用带联网搜索的模型找候选，再逐条到 Semantic Scholar 校验是否存在，取回摘要与元数据，按论文 ID 去重，最后自动生成 BibTeX。任何无法完成映射或超出时间截断的候选都会被丢弃。这一步直接用工程手段堵住了自动写作最常见的失分点——编造引用。

## 二、PaperWritingBench：从 200 篇顶会论文反推「动笔前的状态」

评价自动写作一直缺一把标准的尺子。团队的解法是从已发表的论文倒推原始材料：从 CVPR 2025 与 ICLR 2025 各取 100 篇，用 MinerU 把 PDF 解析成保公式的 Markdown，用 PDFFigures 2.0 抽出图表与图注，再让模型反推出两份「动笔前」材料。

- 想法摘要：只保留方法与理论，剥离实验结果；另做稀疏版（只有高层思路）与稠密版（保留形式化定义与公式）两种。
- 实验日志：实验设置与实证结论，包括基线、数据集、指标与表格数值；图里的视觉结论被改写成独立的文字事实观察。

为防止信息泄漏，两份材料彻底匿名化，去掉作者与标题，并删除所有引用、URL 与图表编号引用。这是整套评测可信度的地基：如果原始材料里还留着标题，模型完全可以靠预训练记忆「回忆」出原论文。

配套的自动评审器覆盖四类指标：引用 F1（区分必引的 P0 集合与可引的 P1 集合）、文献综述质量的六轴 LLM 打分（引用规范、覆盖与完整性、批判性分析与综合、组织、定位与新颖性、相关性与聚焦）、AI Scientist-v2 Reviewer 与 ScholarPeer 两套模拟审稿系统给出的总体评分与录用判定，以及双向交换顺序的成对比较（SxS），用于消除位置偏置。

## 三、结果：引用数量才是分水岭

在稀疏想法设定下，最强的对照组是 AI Scientist-v2 与「单 Agent 一把梭」基线。结论相当明确。

| 指标 | 单 Agent | AI Scientist-v2 | PaperOrchestra | 人类原文 |
| --- | --- | --- | --- | --- |
| 平均引用数 | 9–14 | 9–14 | 45.7–48.0 | 约 59 |
| 模拟录用率 · CVPR（ScholarPeer） | 71% | 70% | 84% | 86% |
| 模拟录用率 · ICLR（ScholarPeer） | 72% | 64% | 81% | 94% |
| 总体评分 · CVPR（AI Scientist-v2 审稿器） | 4.60 | 4.22 | 5.12 | 5.95 |

引用数是理解整张表的关键。基线在引用 F1 上看起来并不算差，但这是低引用量带来的数学假象：它们只抓最显眼的必引论文，P0 召回升高、P1 召回接近零。PaperOrchestra 生成的引用数量已接近人类原文水平，P1 召回比最强基线高 12.6–13.8 个百分点，说明它确实在不熟悉的领域里做过检索，而不是靠关键词浅扫。

文献综述质量上，LLM 裁判给出的总分比最强 AI 基线高 32.9–33.3 分（Gemini-3.1-Pro 评测）与 9.7–9.9 分（GPT-5 评测），在「引用规范」与「批判性分析」两轴上的优势最明显。

人类评测则由 11 位 AI 研究者完成，从两个会议各抽 20 篇共 40 篇稿件，与全部基线配对比较，得到 180 组盲评。PaperOrchestra 在文献综述上领先基线的绝对胜率差为 50–68 个百分点，整体质量领先 14–38 个百分点，与人类原文相比取得 43% 的平局或胜出。自动评审与人类的一致性也可查：GPT-5 裁判在整体质量上与人类评分的皮尔逊相关系数为 0.6458。

消融实验里有两个数字值得记下。拆掉内容打磨环节，稿件质量下降得相当明显——加入打磨后的版本在对局中取得 79–81% 的胜率、零负场，模拟录用率提升 19 个百分点（CVPR）与 22 个百分点（ICLR）。改用自动生成的图表（PlotOn）替代人类原图（PlotOff），在四个设定下仍有 51–66% 的对局取得平局或胜利，说明绘图 Agent 补上的不只是「有图」，而是与叙事对得上的图。

## 四、代价与边界

这套流水线不便宜。单篇论文约需 60–70 次 LLM 调用，平均耗时 39.6 分钟；AI Scientist-v2 是 40–45 次调用、35.1 分钟；单 Agent 基线只要 1 次调用、3.3 分钟。也就是说，质量的提升主要来自把一次调用摊成几十次有分工、有校验的调用。

团队自己列的局限有三条。其一，视觉生成依赖 PaperBanana 外部框架，对「图内容幻觉」缺少直接控制，目前也没有针对生成图表的事实核验环节。其二，打磨仍是 LLM 自我批评的闭环，没有引入人类介入的交互式改稿，而作者反复强调系统定位是辅助工具而非独立作者。其三，基准本身存在预训练数据污染风险，虽然输入已严格脱敏，所有基线共享同一批基座模型使相对比较仍算公平，但要做到彻底隔离「生成」与「记忆」，需要用未发表的材料。

## 核心总结

- PaperOrchestra 用大纲、绘图、文献、写作、打磨五个 Agent，把非结构化的动笔前材料转成可编译的 LaTeX 投稿包，绘图与文献两步并行。
- 文献环节采用「联网检索 + Semantic Scholar 验真 + 时间截断 + 去重生成 .bib」的工程链路，直接针对自动写作编造引用的通病。
- PaperWritingBench 用 200 篇 CVPR/ICLR 2025 论文反向构造脱敏的稀疏/稠密想法摘要与实验日志，把「写作」从「实验」里单独剥离出来评测。
- 差距不在引用 F1 而在引用数量：基线平均只引用 9–14 条，PaperOrchestra 生成 45.7–48.0 条，人类原文约 59 条。
- 人类盲评中，综述质量领先基线 50–68 个百分点，整体质量领先 14–38 个百分点；但距离人类原文仍有可见差距。
- 单篇成本 60–70 次模型调用、约 39.6 分钟；代码以 Apache-2.0 开源，数据集单独发布在 Hugging Face。

## 使用方式

仓库要求 Python 3.11，用 conda 建 `paper_orchestra` 环境后安装依赖，并在根目录 `.env` 里填 Semantic Scholar、Gemini 或 OpenAI 的密钥。命令行入口有两种：

```bash
# 直接跑脚本
./paper_writing_cli.sh

# 或显式指定目录
python paper_writing_cli.py \
  --raw_materials_dir /path/to/raw_materials/ \
  --latex_template_dir templates/cvpr2025 \
  --output_dir /path/to/output/ \
  --use_plotting true
```

`--use_plotting` 默认关闭，开启后才走绘图 Agent 分支；`--writer_model_name` 与 `--reflection_model_name` 可分别指定写作类与反思类 Agent 的模型。另有一个 Streamlit 交互式前端，说明在 `frontend/README.md`。仓库 README 明确标注数据集不在代码仓库内，需从 Hugging Face 的 `yiwen-song/PaperWritingBench` 单独下载，放到 `datasets/` 下；同时声明该项目并非 Google 官方支持的产品。

对科研工作者来说，更现实的用法不是让它投稿，而是把它当成一台「把实验记录整理成初稿」的机器，再人工接管事实核查与论证。引用能验真、图表能生成、模板能对齐——这三件事本来就是写论文时最耗时的机械劳动。

原文：[PaperOrchestra: A Multi-Agent Framework for Automated AI Research Paper Writing](https://arxiv.org/abs/2604.05018)（arXiv，2026-04-06）

代码：[google-research/paper-orchestra](https://github.com/google-research/paper-orchestra)

项目页：[yiwen-song.github.io/paper_orchestra](https://yiwen-song.github.io/paper_orchestra/)

数据集：[PaperWritingBench](https://huggingface.co/datasets/yiwen-song/PaperWritingBench)
