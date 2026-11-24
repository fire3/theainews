---
title: "文档转 Markdown 开源基础设施全景：三条路线、许可证分层与选型指南"
description: "横评近 20 个开源文档解析项目：确定性转换器、布局模型管线与端到端 VLM 三条路线，拆解许可证分层与基准分歧，给出可直接套用的选型决策树。"
pubDate: 2026-11-24
author: "林晓"
category: "tools"
tags: ["文档解析", "Markdown", "RAG", "Docling", "MinerU", "开源"]
image: "/covers/2026-11-24-document-to-markdown-open-source-stack.jpg"
imageAlt: "封面：三列并置的文档解析路线示意，左侧 Office 文档图标、中部版面框线、右侧扫描页与视觉模型光点，箭头统一汇入 Markdown 输出"
topStory: true
---

把 PDF、Word、扫描件变成干净 Markdown，已经从一个「顺手的小工具」长成一层基础设施。截至 2026 年 11 月 24 日，这条赛道上的头部项目星标数相当惊人：微软 MarkItDown 19.8 万、PaddleOCR 9.3 万、MinerU 8.4 万、IBM Docling 7.1 万、Pandoc 4.7 万、Datalab Marker 4.1 万，Firecrawl 今年 8 月才开源的 AnyDoc 也已有 2.4 万。

星标只说明关注度，不说明适用性。真正麻烦的是选型：同样是「PDF 转 Markdown」，一个纯 Rust 库能在 5 毫秒内处理完 Word，一个 7B 视觉模型一页要跑几秒；一个 MIT 许可可以随便商用，另一个「Apache-2.0」却附带月活与收入阈值。这篇文章按技术路线把主流项目拆开对比，并把最容易踩的许可证与基准口径问题讲清楚。

## 一、为什么大家都收敛到 Markdown

三个信号说明 Markdown 已经从「博客格式」变成了机器读取文档的中间语言：Apache Tika 4.0 起把默认输出从纯文本改为 Markdown；MinerU 4.x 用同一个文档模型支持九种渲染目标（Markdown、HTML、LaTeX、DOCX、EPUB、PDF、结构化内容、Content List V1/V2）；Docling 则同时输出 Markdown、HTML、DocTags 与无损 JSON。

MarkItDown 的 README 给了一个朴素理由：Markdown 极接近纯文本、标记极少，却仍能表达标题层级与列表结构，而且 token 效率高，主流大模型本身就「会说」Markdown。

但 Markdown 是有损格式。合并单元格、公式编号、页眉页脚、图形内文字在转换中都会丢失或多出。所以成熟项目都保留一份结构化中间表示——Docling 的 DoclingDocument、MinerU 的结构化内容、AnyDoc 的 Document 模型、Unstructured 的 element 列表——Markdown 只是最终投喂给模型的那一层薄壳。**只拿 Markdown 而不保留定位信息，会让后续的引用溯源几乎无法做**。

## 二、把问题拆成三层，选型立刻清晰

所有项目的能力差异，本质上是对「文档在哪一层坏掉」做了不同的假设。

| 层次 | 解决什么 | 代表实现 | 需要 GPU |
| --- | --- | --- | --- |
| 格式层 | OOXML/OLE/RTF/EPUB/CSV 解包与结构重建 | AnyDoc、Kreuzberg、Mammoth、Pandoc | 否 |
| 文本层 | PDF 内嵌文本、字体编码、阅读顺序 | pdf-inspector、pdftext、PyMuPDF | 否 |
| 布局层 | 版面分区、表格结构、公式、图注 | Docling、MinerU、Marker、PP-StructureV3 | 可选 |
| 识别层 | 像素到文字（扫描件、图片、手写） | Tesseract、PaddleOCR、VLM 类方案 | 通常需要 |

实用的诊断方法是抽 20 页样本看错误形态：出现乱码和字序错位，问题在文本层；表格串行、跨页表格断裂，问题在布局层；整页空白或满页乱字，才需要识别层。**很多团队直接上最大的视觉模型，其实是在用识别层解决格式层的问题**，成本高出一个数量级，效果还不一定更好。

## 三、路线一：确定性转换器，几毫秒且零依赖

这类工具不做 OCR，只把结构化格式「翻译」成 Markdown。它们速度极快、可离线、可跑在浏览器里，是处理 Office 文档的正确起点。

- **MarkItDown**（19.8 万星，MIT，v0.1.9）：支持 PDF、Word、Excel、PPT、图片、音频、HTML、CSV/JSON/XML、ZIP、EPUB、YouTube。PDF 只走文本层，OCR 依赖 `markitdown-ocr` 插件调用大模型视觉接口。README 自己划了边界：原文写「may not be the best option for high-fidelity document conversions for human consumption」，并明确拒绝接收 Web 服务与前端代码。
- **AnyDoc**（2.4 万星，MIT，v0.2.5）：Rust 实现，覆盖 doc/docx、ppt/pptx、xls/xlsx、ODF、RTF、EPUB、CSV、PDF 共 14 类格式，统一输出 GitHub 风格 Markdown，官方口径是中位耗时 5 毫秒以内。本地不做 OCR，扫描页会返回 `NeedsOcr`，要看懂扫描件得显式接托管解析。它同时提供 Rust、Node、Python、WASM 与 CLI 五种入口。
- **Kreuzberg（现更名 Xberg）**（9,614 星，MIT，v1.5.1）：107 种格式、141 个扩展名、15 种语言绑定、6 种输出（含 Markdown 与 DocTags），自带 Tesseract/PaddleOCR/VLM 后端与 MCP server，是这一层里覆盖最宽的。
- **Apache Tika**（4,155 星，Apache-2.0，4.2.0）：Java 生态的「一千多种文件类型」提取器，4.0 起默认输出 Markdown，内置 Tesseract 与 VLM 解析器。适合已有 Java 栈、需要格式兜底的企业环境。
- **Pandoc**（4.7 万星，GPL-2.0，3.14）：万能标记转换器，按官方索引页清点约 46 种输入、57 种输出。它的 FAQ 对 PDF 输入的回答非常直接：「How can I convert PDFs to other formats using pandoc? You can't.」Pandoc 是 Markdown 生态的地基，但不是 PDF 解析器。
- **Mammoth**：只做 docx 到 HTML 片段，且已弃用 Markdown 输出，官方建议先生成 HTML 再交给别的库转 Markdown。

这一层的共同边界很清楚：**不解决扫描件、不解决复杂版式、不解决公式**。如果语料是数字化原生的 Office 文档与电子书，这一层能覆盖八成需求，且成本接近于零。

还有几个热门名字需要打问号：Zerox 的最后一次推送停在 2025 年 5 月，且必须外接视觉模型 API；MegaParse 自述仍在建设阶段，默认就需要 OpenAI 或 Anthropic 的 key；PyMuPDF4LLM 已退化为空壳包。选型时先看提交频率，再看 README。

## 四、路线二：布局模型管线，工程化的主力

这是目前生产系统用得最多的一类：确定性抽取打底，小模型补齐版面与阅读顺序，只在难页上调用大模型。

- **Docling**（7.1 万星，MIT，v2.152.0）：把 PDF 拆成版面检测、阅读顺序、表格识别（TableFormer 或 `granite-vision-4.1-4b`）、代码公式四个阶段，另有图片分类模型。输入覆盖 PDF、DOCX、PPTX、XLSX、HTML、EPUB、LaTeX、音视频，甚至 Apple Pages/Numbers/Keynote。官方给出的实测吞吐是 L40S 上标准模式（不做 OCR）3.1 页/秒、GraniteDocling VLM 模式 2.4 页/秒；RTX 5090 上分别为 7.9 与 4.2 页/秒。自带 docling-serve 与 MCP server。
- **MinerU**（8.4 万星，4.2.3）：四档解析（flash/basic/standard/advanced），PDF 与图片四档全支持，Office/EPUB/OFD/HTML 只走本地 flash。默认安装即可 CPU 推理，`mineru[full]` 要求 8GB 以上显存。官方变更记录称其管线后端在 OmniDocBench v1.5 上得 86.2，并提供了文档库、定位符续读与 agent skill。
- **Marker**（4.1 万星，v2.2.0）：先用 `pdftext` 抽文本层，再用约 18MB 的 Indra ONNX 模型做版面与阅读顺序，只在公式、复杂表格、中日韩文字和扫描页上召唤 0.69B 的 Surya 2.5。四种模式吞吐差距极大：`no_ocr` 57 页/秒、`fast` 23.6、`balanced` 16.9、`vllm` 4.5。
- **PaddleOCR**（9.3 万星，Apache-2.0，3.7.0）：PP-StructureV3 是七模块拼装管线，优势是输出表格单元格与文本坐标，适合字段抽取；PaddleOCR-VL 则是「版面模型 + VLM 逐元素识别」的两阶段方案，官方明确建议用完整管线而不是只拿 VLM 单干。

这一层的设计精髓是**分层路由**：数字化原生页走确定性路径，只有真正需要「看」的页面才付出 GPU 代价。这比「每页都送视觉模型」便宜一到两个数量级。

## 五、路线三：端到端 VLM，精度天花板与新的代价

把整页图片直接交给视觉语言模型输出 Markdown，是 2025 年之后增长最快的一支。

- **olmOCR**（2.0 万星，Apache-2.0）：以 Qwen2.5-VL-7B 为底座，本地推理至少需要 12GB 显存，无 CPU 路径。代码与权重同为 Apache-2.0，自带覆盖 1,400 份文档、7,000 多个测试用例的 olmOCR-Bench；官方给出的成本口径是每百万页低于 200 美元。
- **Chandra OCR 2**（Datalab）：输出 HTML/Markdown/JSON 并保留版面块，olmOCR-Bench 上拿到 85.8 分（上一代 83.1）。许可为「代码 Apache-2.0 + 修改版 OpenRAIL-M 权重」，免费阈值比 Marker 更低，且明确禁止用其与自家托管 API 竞争。
- **dots.ocr / dots.mocr**（9,240 星，MIT）：3B 级单模型做多语言版面解析，输出布局 JSON 加 Markdown，已进 vLLM 主干。官方自陈「复杂表格与数学公式的抽取仍是难点」。
- **HunyuanOCR-1.5**（1.12B，腾讯社区许可）：支持 llama.cpp/GGUF，能落到 CPU、消费级显卡甚至笔记本；单卡 H20 上 0.33 页/秒，启用投机解码后 0.71 页/秒。
- 其余如 DeepSeek-OCR（3.34B，MIT）、PaddleOCR-VL-1.6（0.96B）、MonkeyOCR、Dolphin-v2（3B，MIT，自报 OmniDocBench v1.5 89.78）、Nemotron Parse（不足 1B），都在「小参数 + 强版面」这个方向上竞争。

这类方案的收益是抗退化能力强：歪斜扫描、老式字体、手写批注、非拉丁文字，传统管线往往直接崩，VLM 还能给出可用结果。代价是三重：显存与吞吐成本、长文档的重复输出与幻觉、以及<strong>结构信息的不确定性</strong>——同样输出 Markdown，有的模型只给文字流，有的保留版面块与坐标，后者才能支撑引用溯源。

一个值得注意的维护性信号：olmOCR 仓库最近一次 release 停在 2026 年 3 月，dots.ocr 的最后提交也在同期。模型迭代快、工程维护慢是这一层的普遍现象，选它就要接受自己承担集成与升级成本。

## 六、横向对比

| 项目 | 路线 | 主要输入 | OCR | 许可证 | 最近版本 |
| --- | --- | --- | --- | --- | --- |
| MarkItDown | 转换器 | Office/PDF/HTML/EPUB/音视频 | 插件外挂 | MIT | 0.1.9（2026-10） |
| AnyDoc | 转换器 | 14 类 Office/EPUB/CSV/PDF | 无（返回 NeedsOcr） | MIT | 0.2.5（2026-11） |
| Xberg（原 Kreuzberg） | 转换器 | 107 格式 | 多后端 | MIT | 1.5.1（2026-11） |
| Apache Tika | 转换器 | 1000+ 文件类型 | 内置 Tesseract | Apache-2.0 | 4.2.0（2026-10） |
| Pandoc | 转换器 | 约 46 种标记格式 | 无 | GPL-2.0 | 3.14（2026-11） |
| Docling | 布局管线 | PDF/Office/HTML/EPUB/音视频 | 可选多种 | MIT | 2.152.0（2026-11） |
| MinerU | 布局管线 | PDF/Office/EPUB/OFD/HTML | 内置 | MinerU OSL（Apache+条款） | 4.2.3（2026-11） |
| Marker | 布局管线 | PDF/图片/Office/EPUB | 混合路由 | 代码 Apache-2.0、权重 OpenRAIL-M | 2.2.0（2026-11） |
| PaddleOCR | 布局管线/VLM | PDF/图片/Office | 内置 | Apache-2.0 | 3.7.0（2026-06） |
| olmOCR | 端到端 VLM | PDF/图片 | 原生 | Apache-2.0 | 0.4.27（2026-03） |
| Chandra OCR 2 | 端到端 VLM | PDF/图片 | 原生 | 代码 Apache-2.0、权重 OpenRAIL-M | 2026-03 |
| dots.mocr（原 dots.ocr） | 端到端 VLM | 图片/PDF | 原生 | MIT | 2026-03 |
| MonkeyOCR | 端到端 VLM | 图片/PDF | 原生 | v2 为 Apache-2.0，v1 权重仅限学术 | v2（2026-07） |
| Dolphin-v2 | 端到端 VLM | 图片/PDF | 原生 | MIT | 2025-12 |
| HunyuanOCR-1.5 | 端到端 VLM | 图片/PDF | 原生 | 腾讯社区许可 | 2026-07 |

## 七、许可证：三个必须查清的坑

第一个坑是**代码与权重分离**。Marker 的代码已是 Apache-2.0，但权重用的是「修改版 AI Pubs OpenRAIL-M」：研究、个人使用、以及融资或营收低于 500 万美元的初创公司免费，超出范围需要购买授权。Chandra 更严格，不仅免费阈值更低，还附加了「不得用于与自家托管 API 竞争」的限制。MonkeyOCR 则是相反的例子：v1 权重仅限学术与非商业用途，商用要单独签约，直到 v2（0.7B parser）才整包转为 Apache-2.0。看到 GitHub 上写着 Apache-2.0 就假定「可以随便商业化」，是这一层最常见的误判。

第二个坑是<strong>「Apache-2.0 加附加条款」</strong>。MinerU 的许可证基于 Apache 2.0，但附加了阈值条件：月活超过 1 亿或月收入超过 2000 万美元须另行获得商业许可，并且以在线服务形式提供时须显著署名。这类条款在中文开源项目里越来越常见，读 LICENSE 正文而不是 SPDX 标签，是唯一可靠的办法。

第三个坑是**依赖传染**。PyMuPDF 系是 AGPL-3.0，把它嵌进 SaaS 会触发源码开放义务；更要注意 `pymupdf4llm` 现在已是一个空壳包，README 说明功能已并入 `pymupdf` 2.x——按老教程安装会得到一个没有实现的壳。相比之下 Pandoc 的 GPL-2.0 只在分发二进制时产生约束，内部调用不受影响。

另外，Unstructured 默认会上报匿名遥测（可用 `DO_NOT_TRACK` 关闭），在合规敏感的场景要显式处理。

## 八、基准怎么读：排名会翻转

三类基准的分数不能直接横比，因为口径完全不同。

Datalab 的 OmniParseBench 用 16,288 条「通过/不通过」单元测试评估 2,937 页文档，Headline 分是文本、表格、版面三族通过率的等权平均。在这个表里 Marker 的 `vllm` 模式 85.9 分、4.5 页/秒，`balanced` 80.5 分、16.9 页/秒，而 Docling 是 67.5 分、2.1 页/秒，MinerU 2.5-Pro 是 87.1 分、0.54 页/秒。

但换到 AllenAI 的 olmOCR-Bench，排序立刻变了：Chandra OCR 2 拿到 85.8、olmOCR 82.4、PaddleOCR-VL 80.0，而 Marker（1.10.1 版本）只有 76.1，MinerU（2.5.4）75.2。同一批系统在两套基准里的相对位置截然不同。

原因是等权平均本身在惩罚能力缺失。OmniParseBench 里纯 OCR 模型不输出版面，版面项直接记 0 分，于是 olmOCR-2 的总分只有 42.6——而这个数字恰好等于其文本 71.3、表格 56.6、版面 0.0 的算术平均。**它的文字识别并不差，是加权方式把它压到了榜尾**。换句话说，榜单名次高度依赖「版面算不算分」，而版面并不总是你的业务重点。

第三方基准 OmniDocBench 的现状更值得玩味。按其榜单的 v1.6_full 口径，OXR-1.0（1.3B）97.03、TeleOCR（1.2B）96.91、OvisOCR3（0.8B）96.69、OvisOCR2（0.8B）96.47、MiniCPM-OCR 1.0（1.3B）96.44、PaddleOCR-VL-1.6（0.9B）96.34、MinerU2.5-Pro（1.2B）95.75——分数为各团队自报，但前七名全部挤在 1.3 分的区间里，且清一色是 0.8B 到 1.3B 的小模型。这意味着这份榜单已经饱和：在这个数据集上继续比分数几乎没有区分度，真正的差异回到吞吐、显存占用、许可证与工程维护上。

还有两个隐性陷阱：一是版本迁移，OmniDocBench 从 v1.5 到 v1.6 增加了 296 页更难的样本并更换了匹配算法，v1.7 又做了口径调整，跨版本比较分数没有意义——把 MinerU 在 v1.5 上的 86.2 和 PaddleOCR-VL 在 v1.6 上的 96.3 放在一起，是最常见的误读；二是语料私有，多数厂商基准不公开测试集，你无法验证它是否对自家模型的强项过拟合。

务实的做法是自建 100 到 200 页的真实文档集，标注你真正关心的字段与结构，用检索命中率、字段 F1、人工抽检返工率做回归。**别人的榜单只能用来圈定候选，不能用来做最终决策。**

## 九、生产管线的四个要点

1. **按页路由**：先用 PDF 结构判断每页是文本页还是图像页，文本页跳过 OCR。pdf-inspector 这类专门的「分类器」就是干这个的，官方称它让托管解析引擎快 3.5 到 5 倍。
2. **分档降级**：像 MinerU 的四档、Marker 的四模式那样，为「预览/索引」和「精读/抽取」配不同档位，而不是所有场景都用最高精度。
3. **保留定位**：输出 Markdown 的同时保存页码、块坐标、标题树。MinerU 的 locator 续读、Docling 的 DocTags、AnyDoc 的 Document 模型都是为此设计的，缺了它就没法做引用与增量重解析。
4. **缓存与幂等**：以内容哈希为键缓存解析结果，换模型版本时按需重跑，而不是全量重算。

## 十、选型决策树

- 只要 Office/EPUB/CSV，追求毫秒级与零依赖：**AnyDoc** 或 **Xberg**，需要浏览器端就跑 WASM。
- 已有 Java 栈、需要格式兜底：**Tika 4.x**。
- 文本型 PDF 为主、要极致吞吐：**Marker `no_ocr`/`fast`** 或 **Docling** 标准模式，纯 CPU 可跑。
- 论文、财报、合同，表格与公式多：**MinerU standard** 或 **Marker `vllm`**，有 GPU 时优先。
- 扫描件、历史档案、多语言、手写：**Chandra OCR 2**、**olmOCR** 或 **PaddleOCR-VL**，并接受人工抽检成本。
- 数据不能出内网：**Docling/MinerU** 本地部署 + 自托管 VLM 后端，不要碰任何带托管兜底的默认配置。
- 需要字段级坐标做抽取：**PP-StructureV3** 的单元格与文本坐标比纯 Markdown 更有用。

如果让我给一个默认组合：格式层用 AnyDoc 或 Xberg 处理 Office，PDF 用 Docling 或 MinerU 做布局，扫描页兜底交给一个端到端 VLM，各条链路统一输出「Markdown + 定位 JSON」。这套组合的复杂度不低，但比押注单一「最强模型」更稳——因为这条赛道上，最强模型每三个月换一次，而格式层的确定性代码几乎不会退步。

## 核心总结

- **共识**：Markdown 已成为 LLM 读取文档的中间语言，Tika 4.0 默认输出、MinerU 九种渲染目标都指向这一点。
- **三条路线**：确定性转换器（毫秒级、无 OCR）、布局模型管线（工程主力、分层路由）、端到端 VLM（精度上限、成本与幻觉）。
- **关键洞察**：多数解析失败发生在文本层与布局层，而不是识别层；直接上大视觉模型是常见的成本错配。
- **许可证**：代码许可不等于权重许可，MinerU 与 Marker/Chandra 都有商用阈值，PyMuPDF 系 AGPL 会传染。
- **基准**：OmniParseBench、olmOCR-Bench、OmniDocBench 口径不同，同一系统排名会翻转，等权平均会惩罚能力缺失。
- **落地**：自建小评估集、按页路由、保留页码与坐标、内容哈希缓存，比追逐榜单第一更重要。

参考：

- [microsoft/markitdown](https://github.com/microsoft/markitdown)
- [firecrawl/anydoc](https://github.com/firecrawl/anydoc)
- [Goldziher/kreuzberg（已更名 Xberg）](https://github.com/Goldziher/kreuzberg)
- [docling-project/docling](https://github.com/docling-project/docling)
- [opendatalab/MinerU](https://github.com/opendatalab/MinerU)
- [MinerU LICENSE](https://github.com/opendatalab/MinerU/blob/master/LICENSE.md)
- [datalab-to/marker](https://github.com/datalab-to/marker)
- [datalab-to/chandra](https://github.com/datalab-to/chandra)
- [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
- [allenai/olmocr 与 olmOCR-Bench](https://github.com/allenai/olmocr)
- [studio-dots-ai/dots.ocr（现 dots.mocr）](https://github.com/studio-dots-ai/dots.ocr)
- [Tencent-Hunyuan/HunyuanOCR](https://github.com/Tencent-Hunyuan/HunyuanOCR)
- [Apache Tika](https://tika.apache.org/)
- [Pandoc FAQ](https://pandoc.org/faqs.html)
- [opendatalab/OmniDocBench](https://github.com/opendatalab/OmniDocBench)
