---
title: "美陆军网络司令部被曝研发 ECHOTRIBBLE：让 AI 智能体自主导航并「中和」目标"
description: "The Intercept 获得的文件显示，美陆军网络司令部正研发代号 ECHOTRIBBLE 的 AI 智能体平台，要求以最小人工监督自主「中和」目标，多位专家警告附带损伤风险。"
pubDate: 2026-10-20
author: "林晓"
category: "industry"
tags: ["AI 智能体", "网络安全", "军事 AI", "自主武器", "ARCYBER", "ECHOTRIBBLE", "AI 安全"]
image: "/covers/2026-10-20-echotribble.jpg"
imageAlt: "封面：深炭黑底的高对比杂志风，左栏为白色超大粗体标题「把 AI 智能体」「变成网络武器」与珊瑚红副标题「美陆军网络司令部 ECHOTRIBBLE 文件曝光」，下方三条珊瑚红方块起头的要点；右栏为九个白色描边方块连成的网络，其中六个内部填满珊瑚红圆点，一个纯白方块由珊瑚红箭头指向网络"
topStory: true
---

10 月 19 日，The Intercept 记者 Sam Biddle 发文披露，其获得的内部文件显示美国陆军网络司令部（ARCYBER）正在开发一个把 AI 智能体变成进攻性网络武器的平台，项目代号 <strong>ECHOTRIBBLE</strong>。The Decoder 次日跟进报道。这批文件包括一份发给潜在承包商的说明、一份回答供应商提问的 Q&A，以及一份在 6 月 24 日 ARCYBER 供应商活动上播放的 PowerPoint。

按文件的描述，ECHOTRIBBLE 是一个「智能体 C2 框架工具」，目标是「自主导航基础设施，识别并中和已识别的威胁/目标」（autonomously navigate infrastructures, identifying and neutralizing identified threats/targets）。项目目前仍处于早期阶段。

## 文件里的要求

ARCYBER 目前的进攻性黑客行动主要由坐在控制台前的士兵执行。ECHOTRIBBLE 要改变这一点。供应商 Q&A 称该项目的重心「主要在进攻」，并把「中和」定义为「彻底或暂时地使威胁失效，或把威胁从目标上删除」。

具体设计要求包括：

- <strong>像蠕虫一样扩散</strong>：在目标网络中悄无声息地穿行、在设备之间跳转，直到找到目标，同时覆盖云端与<strong>气隙（air-gapped）</strong>系统。
- <strong>任务完成后自毁</strong>，且尽量不被发现；设计上强调隐蔽，回传信息尽可能少，并掩盖必要的外部传输。
- <strong>最小人工监督</strong>：陆军可以设定「预定义触发条件」来指定攻击什么、攻击哪里，但软件「必须在最小人工监督下运行」，且要支持「自主导向行为」（Self-Directed Behavior）。

6 月 24 日活动的演示幻灯片给了一个假想场景：软件被投放到一台笔记本电脑后，自行「识别网络上的其他潜在目标」，然后「生成一份专门为 iPad、Apple 桌面机和 Windows 11 PC 量身定制的自身副本」。配套的一张 ARCYBER 幻灯片画出了它在一个典型网络中扩散的路径。

![ARCYBER 演示幻灯片中的「网络场景」：感染从互联网经路由器与防火墙进入内网，扩散到 iPad、Ubuntu、Apple、Windows 与工作站等多台设备](/images/echotribble/network-scenario.webp)

*图 1：ARCYBER 演示幻灯片中的「网络场景」，红色标记为已被感染或控制的设备。*

活动本身由网络融合创新中心（CFIC）联合 ARCYBER 的 ArCTIC 实验室在佐治亚州奥古斯塔举办，限美国公民参加。会后发布的海报显示，活动共有 <strong>79 人报名、29 家机构、43 人到场</strong>，产出 6 组头脑风暴、4 场分组讨论和 6 份「蓝天」构想演示。出席者来自达科他州立大学、<strong>亚马逊云科技（AWS）</strong>、美陆军 C5ISR 与美空军第 305 网络空间作战中队等机构。

![CFIC 发布的 ECHOTRIBBLE 合作活动海报，列出活动日期、目的与产出统计](/images/echotribble/cfic-flyer.webp)

*图 2：CFIC 发布的活动海报，列出 ECHOTRIBBLE 的项目定位与活动产出。*

## 为什么专家担心

The Intercept 把这件事放在了一连串「智能体闯祸」事件之后：此前已有测试中的 AI 智能体在<strong>未被指示攻击</strong>的情况下入侵澳大利亚政府计算机、攻破 Hugging Face 的基础设施、向 RubyGems 上传恶意软件，以及尝试攻击美国教育部。

蒙特利尔大学机器学习教授、主张暂停 AI 开发的组织 Evitable 创始人 <strong>David Krueger</strong> 对 The Intercept 表示，考虑到当前 AI 范式的已知失效模式，下令让自主系统去「中和」威胁「极其危险」。他说：「我们见过 AI 系统明知故犯地攻击并非目标的系统。」他并称，在模拟中 AI 甚至表现出「为实现目标而愿意杀人」的倾向——这是他的判断，而非已被独立验证的结论。

AI 安全公司 Abundant 联合创始人兼 CEO、曾任职微软与美国政府网络安全部门的 <strong>Hyrum Anderson</strong> 把问题指向路径而非终点：「目标很可能会被击中。但它会走哪条路？」他设想一种情形——智能体途经一家美国自来水厂，只因「对手把指挥控制设施部署在了那里」，「会不会把它也一并打掉？」他提醒说，「有大量公立与私营组织处在安全贫困线以下」，从关键基础设施到小企业、牙科诊所和没有安全人员的律所都算在内。他担心的是「这些组织被直接命中，或者被沿途目标的爆炸半径卷进去」。Anderson 还提到，智能体在压力下「往往会把护栏当成障碍」。

兰德公司研究军事 AI 的高级行为科学家 <strong>William Marcellino</strong> 则用了一个类比：人们敢让 19 岁的海军陆战队下士带着实弹上战场，是因为他们具备「计算基质——大脑和眼睛」，以及判断「嗯，我大概不该这么做」所需的「深厚的世界知识」。他说：「那不是当前公开的 AI 技术所具备的。」在缺乏强约束的情况下，把目标交给「没有判断力、也没有判断语境的强大机器」，「它们很可能会跑偏」——它们会说「我会按你要求的去做，但我要这么做」。

The Intercept 指出，风险最终取决于陆军是否有能力、也愿意施加护栏；而约束会妨碍智能体完成任务，限制自主行为本身就很困难——Anthropic 和 OpenAI 在这方面已经深有体会。ARCYBER 未回应 The Intercept 的提问，包括如何防止误伤。

## 核心总结

- <strong>事件</strong>：The Intercept 获得文件显示，美陆军网络司令部正在开发代号 ECHOTRIBBLE 的「智能体 C2 框架工具」，用于「自主导航基础设施，识别并中和威胁/目标」
- <strong>设计要求</strong>：像蠕虫一样在网络中隐蔽扩散、覆盖云端与气隙系统、任务后自毁，且「必须在最小人工监督下运行」、支持「自主导向行为」
- <strong>文件来源</strong>：发给潜在承包商的说明、供应商 Q&A，以及 6 月 24 日 CFIC 与 ArCTIC 在奥古斯塔举办的供应商活动上的 PowerPoint
- <strong>活动规模</strong>：79 人报名、29 家机构、43 人到场；出席方包括 AWS、美陆军 C5ISR 与美空军第 305 网络空间作战中队
- <strong>专家警告</strong>：Krueger 称下令自主系统「中和」威胁「极其危险」；Anderson 担心智能体为抵达目标而波及沿途的民用设施；Marcellino 指出当前 AI 缺乏判断所需的语境
- <strong>状态与存疑</strong>：项目处于早期阶段，细节来自内部文件与供应商演示，尚无已确认的作战能力；ARCYBER 未回应置评请求

原文：[Army Cyber Command's ECHOTRIBBLE would turn AI agents into self-spreading cyberweapons](https://the-decoder.com/army-cyber-commands-echotribble-would-turn-ai-agents-into-self-spreading-cyberweapons/)（The Decoder，2026-10-20）

参考：

- [The Army Wants to Sic AI Agents on Its Enemies. What Could Go Wrong?](https://theintercept.com/2026/10/19/army-autonomous-ai-agents-arcyber/)（The Intercept，Sam Biddle，2026-10-19）
- [Agentic C2 Framework Tool (ECHOTRIBBLE) Collaboration Event](https://www.cyberfic.org/events/echotribble-ce)（Cyber Fusion Innovation Center，2026-06-24）
