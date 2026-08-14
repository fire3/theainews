---
title: "DeepSeek Harness 开源实测：一切皆插件，被称'Agent 时代的安卓'"
description: "量子位深度体验 DeepSeek Harness：一切皆插件的 Agent 框架，内置百余插件与轨迹回放，实测长程任务更强，被称为'Agent 时代的安卓'。"
pubDate: 2026-08-14
author: "林晓"
category: "tools"
tags: ["DeepSeek", "Harness", "Agent", "开源", "Cordis"]
image: "/images/dsh-logo.png"
imageAlt: "DeepSeek Harness「黑鲸」logo"
---

DeepSeek Harness（DSH）正式发布并开源，代码托管于 GitHub（deepseek-ai/deepseek-harness）。量子位作者在深度体验后刊发评测：他把几乎所有 Vibe Coding 项目从 Codex 迁移到了 Harness，最大的感触是这套框架"彻头彻尾为自进化与 DIY 而生"——模型、工具、策略、存储、上下文管理全部可插拔，官方已内置一百多个插件，被其称为"Agent 时代的安卓"。

![DeepSeek Harness「黑鲸」logo（黑化版）](/images/dsh-logo.png)

内测群里，已经有开发者把默认界面魔改成了各种样式，比如下面这些由社区动手改造的版本：

![内测群大佬魔改的 logo](/images/dsh-logo-mod-1.png)
![另一版社区魔改的 logo](/images/dsh-logo-mod-2.png)
![社区开发者做的 DSH TUI](/images/dsh-tui.png)

而 DSH 真正能做的，远不止这些——模型、工具、策略、存储、上下文管理，全部都是可插拔的"积木"，官方已经内置了一百多个插件：

![一切皆插件：可插拔的积木式架构示意](/images/dsh-blocks.jpg)

## 上手体验：四种预设与轨迹回放

安装方式有两种：已装 Node.js 工具链的环境可直接用 npx 命令启动 Web UI；也可以 `git clone https://github.com/deepseek-ai/deepseek-harness` 源码安装。目前暂无桌面应用，启动后经浏览器使用，首次需填入模型 API Key，也支持接入其他模型。

![两种安装方式](/images/dsh-install.png)

量子位还提醒，DeepSeek 计划 8 月 17 日调整价格，尤其是缓存价格：

![涨价提示：17 号大涨价，尤其是缓存](/images/dsh-price.jpg)

启动后就能看到"黑鲸"的真容——基本和 DeepSeek 网页版长得一模一样，只不过对话列表变成了本地项目管理列表。开启会话前，需要额外选择工作目录和 Agent 预设：

![DSH Web UI：对话列表成了本地项目管理列表](/images/dsh-web-ui.jpg)

官方提供四类预设：

- **标准模式**：功能完整的编码 Agent，涵盖文件编辑、Shell、搜索、Skills、计划模式、子代理等能力；
- **PTC 模式**：在标准模式之上提供 Code Mode SDK，允许模型编写 TypeScript 程序组合多步操作；
- **极简模式**：仅保留 bash 与 str_replace_editor 两个工具，用于基准测试和最小化复现；
- **创造模式**：在标准模式之上提供运行时检查、插件实验与预设创作指导。

![四类预设一览](/images/dsh-presets.png)

DSH 的特色功能是**轨迹（Trajectory）**：与经过润色的对话视图不同，它能回放事件级原始记录，直观看到模型在哪一步出了问题、每个环节消耗多少 Token：

![轨迹（Trajectory）回放窗口](/images/dsh-trajectory.png)
![轨迹回放：直接看到原始事件级记录与每步成本](/images/dsh-trajectory-tokens.png)

屏幕底部还有实时统计表，可随时查看 Token 消耗与缓存命中率——实测缓存命中大多在 **99% 左右**，有时达到 100%：

![屏幕底部的 Token 消耗与缓存命中统计表](/images/dsh-token-stats.png)

即便不开计划模式，遇到指令不明确时 DSH 也会主动提问并给出建议选项，这比 Codex 更能省脑力：

![指令不明确时主动拉起提问并给出建议选项](/images/dsh-proactive-ask.png)

其他交互和 Codex 差别不大——可以用 `/` 调用上下文压缩、设置目标、计划模式等功能，也支持 Skills 与任务清单：

![/ 命令：上下文压缩、设置目标、计划模式、Skills](/images/dsh-slash.png)
![任务清单功能](/images/dsh-tasklist.png)

比较遗憾的是，经典 Agent 三列表中右侧栏还没做出来，内置浏览器、文件管理、预览等体验上仍与 Codex 有差距；图片支持作为附件上传，但 V4 本身不支持视觉输入，需搭配多模态模型使用：

![经典 Agent 右侧栏等交互尚未完成](/images/dsh-rightbar.png)

## 实测：长程任务能力更强

量子位用 V4 Flash 分别运行 Codex 与 DSH，模型与推理强度完全一致。先是经典"鹈鹕自行车"测试，差别不大：

![实测对比：鹈鹕自行车（左 DSH，右 Codex）](/images/dsh-pelican.png)

但"生成猪八戒 3D 白模"的单句提示下，差异就出来了——Codex "一把梭"的产物简直不像个生物：

![猪八戒 3D 白模：Codex 产物"不像个生物"](/images/dsh-bajie-codex.png)

原因在于 DSH 驾驭下模型的长程任务能力强非常多：DSH 就这一句提示猛跑了约 **20 分钟**，产出完整模型：

![猪八戒 demo：DSH 猛跑 20 分钟产出](/images/dsh-bajie-dsh.png)

反观 Codex，几乎没怎么返工，6 分钟就跑完了，还一度以为要生成图片、向作者索要 GPT-Image-2 的 API：

![Codex 仅 6 分钟完成，异常自信](/images/dsh-codex-6min.png)

这也与社区反馈一致：有用户单次任务最长跑过 **10 小时**；一个第一人称射击游戏 demo 未给任何提示词，下蹲、换弹、瞄准、NPC 等功能全部由模型自行完成：

![无提示词生成的第一人称射击 demo](/images/dsh-fps.gif)

作者还透露，黑鲸会给自己做"思考"的动图，可以直接当表情包用：

![黑鲸「思考」gif](/images/dsh-thinking.gif)

作者的结论很直接：自家模型优先搭配自家 Harness。

## 架构：Cordis 与"Agent 时代的安卓"

DSH 的核心架构基于 **Cordis**——可以理解为乐高的底板：把整体拆解为一个个独立插件，各司其职。开发者可按规则编写新插件插到底板上，也可随时拔下替换不满意的现有插件：

![Cordis：程序员写代码时的"底板"](/images/dsh-cordis.png)

官方甚至内置了一个魔改 Cordis 的 Skill，任何人都能在遇到 Bug 或需要新功能时动手实现再开源出来，未来遇到相似问题也能直接安装社区已有的 DSH 插件，就像给《我的世界》装模组：

![内置魔改 Cordis 的 Skill](/images/dsh-cordis-skill.png)
![社区插件：像给《我的世界》装模组一样](/images/dsh-community-plugin.png)

仓库已预留 Plugin Store，光是官方就已内置 100+ 插件。相比之下，Codex 的 Harness 更像"闭源的 iPhone"：Rust 单体核心加 MCP 工具、hooks、skills 等外部挂件，社区难以触碰主干。DSH 还内置了 dsh-code-review、dsh-find-simplifications、dsh-doc-standards、dsh-prose-standard 等开发向 Skill：

![预留的 Plugin Store，官方已内置 100+ 插件](/images/dsh-plugin-store.jpg)

公众号宣发物料里也披露了不少社区开发者所做的插件——大鲸鱼 TUI、上古 QQ 风皮肤、鲸鱼专属 emoji 等：

![社区开发者做的各类插件（大鲸鱼 TUI、QQ 风皮肤等）](/images/dsh-community-showcase.png)

作者认为 DeepSeek 在布局"自进化"路线：Cordis 协议下，模型可以在不打断任务的前提下自己写插件、自己安装，未来从海量 Agent 实例中筛选优质插件融回主线，是目前比较可落地的自进化实现方式。不过对普通用户而言，这仍是吃生态的功能，短期帮助有限：

![自进化路线：模型自己写插件、自己安装](/images/dsh-self-evolution.png)

## 核心总结

- DeepSeek Harness 正式开源，一切皆插件，官方已内置 100+ 插件并预留 Plugin Store；
- 四类预设：标准、PTC、极简、创造，支持自定义 Agent 运行时；
- 轨迹回放与 Token 仪表盘可监控每一步行为与成本，实测缓存命中率多在 99%；
- 同模型对比下长程任务表现明显优于 Codex，仓库内置开发向 Skill 全家桶；
- 基于 Cordis 的开放架构被称为"Agent 时代的安卓"，也是 DeepSeek 落地自进化路线的载体。

原文：[深度体验DeepSeek Harness，我原谅它涨价了](https://mp.weixin.qq.com/s/j5lAcwv2xiUSoWNlrKLwQQ)（量子位，2026-08-14）
参考：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
