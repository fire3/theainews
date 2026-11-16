---
title: "27k Star 的 Univer：给应用与 AI 智能体的开源 Office SDK"
description: "开源 Office SDK Univer：Apache-2.0 核心提供表格与文档编辑、公式计算与 Headless 处理，AI SDK 让智能体检视、编辑并校验 Office 内容，v1.5.2 已发布。"
pubDate: 2026-11-16
author: "林晓"
category: "tools"
tags: ["Univer", "Office SDK", "开源", "电子表格", "协作编辑", "AI 智能体"]
image: "/covers/2026-11-16-univer-office-sdk.jpg"
imageAlt: "封面：浅色信息图风，左栏标题「Univer：把 Office 嵌进产品」与要点列表，右栏抽象电子表格网格视觉"
topStory: false
---

把自己的产品里需要表格、文档编辑能力时，多数团队要么嵌入第三方在线文档（受限于账号体系与定制空间），要么自研一套编辑器（成本高昂）。GitHub 上的开源项目 Univer 走了第三条路：以 Apache-2.0 许可的 Office SDK 形式，把编辑、公式计算、协作与文件处理做成可组装的插件体系，浏览器端、Node.js Headless 任务与 AI 智能体共用同一套内容模型与 API。项目目前约 27,500 Star，11 月 16 日刚发布 v1.5.2，过去一周连续推出 v1.4.0 与 v1.5.0 两个功能版本。

![Univer Office SDK 产品总览](/images/univer-hero-banner.png)

## 三层 SDK：Web、Server 与 AI

Univer 产品家族覆盖电子表格、文档、演示、关系表、画板与 PDF，按三层 SDK 组织：

- **Web SDK** 是基础层：内容模型、编辑渲染、公式计算引擎与应用侧的 Facade API。插件可组合成嵌入式编辑器，也可以脱离 UI 在 Node.js 中做 Headless 处理。
- **Server SDK** 提供实时协作、修订历史与 Office 文件导入导出等后端服务。
- **AI SDK** 面向智能体：结构化的内容检视、编辑执行与结果校验工具，可组合成 Office CLI 或智能体工具链。

![Univer 的 Web SDK、Server SDK 与 AI SDK 结构](/images/univer-sdk-structure.png)

开源仓库提供的是 Web SDK 的核心架构与引擎实现：内容模型与快照格式、插件与依赖管理、命令系统、公式与 Canvas 渲染引擎、Facade API，以及表格与文档的编辑能力。协作、文件格式转换、图表、数据透视表等能力以商业扩展形式另行分发。

## 架构：插件分层与跨功能撤销

Univer 把功能拆成多层插件：功能插件管理内容规则，UI 插件负责界面交互，二者都构建在核心框架（命令系统、依赖注入、渲染与公式引擎）之上。典型例子是跨功能编辑：在筛选区间内插入一行时，行命令会同时组合基础内容变更与筛选插件提供的区间调整，并把两者记入同一条撤销/重做记录。命令系统区分三类动作——Command 编排业务操作、Mutation 修改快照内容、Operation 处理面板开关等瞬态状态。

应用与智能体通过同一套 Facade API（FWorkbook、FWorksheet、FRange 等）操作内容，事件经 univerAPI.Event 以类型化方式暴露。官方文档以「报价单」示例演示完整闭环：写入公式、外部代码修改数量、公式自动重算、读取合计并保存 JSON 快照——整个过程无需任何 AI SDK 依赖。

## 快速上手

```bash
pnpm add @univerjs/presets @univerjs/preset-sheets-core
```

```ts
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import '@univerjs/preset-sheets-core/lib/index.css'

const { univerAPI } = createUniver({
  locale: LocaleType.EN_US,
  presets: [UniverSheetsCorePreset({ container: 'app' })],
})

univerAPI.createWorkbook({}) // 页面中即出现可编辑表格
```

外部代码继续操作同一份工作簿：

```ts
const sheet = univerAPI.getActiveWorkbook()!.getActiveSheet()
sheet.getRange('B2').setValue(4)

univerAPI.getFormula().onCalculationResultApplied().then(() => {
  console.log(sheet.getRange('D4').getValue()) // 公式已重算
})
```

运行环境要求：构建目标 Chrome 88，视图层基于 React 18（兼容 19），Headless 模式支持 Node.js 18.17+。

## 近期版本动态

- **v1.5.0**（11 月 14 日）：新增独立图表工作表、堆积折线图与误差线；画板图示支持 planLayout 自动布局与 LaTeX 文本渲染包；公式计算内存占用下降；Pro 免费档覆盖更多编辑与本地导出流程。
- **v1.4.0**（11 月 7 日）：跨表格、文档与演示的 Office 附件（OLE）工作流，演示文稿形状布尔运算，数据透视表多筛选与 GETPIVOTDATA 函数。
- **v1.5.1 / v1.5.2**（11 月 16 日）：连续两个补丁版本修复问题。

## 生态与授权

官方提供开源参考应用 Univer Workspace，以及 Univer CLI 和多个智能体集成（DeepSeek Harness、WorkBuddy、OpenClaw 的 Office 工具），另有帮助编码智能体集成 SDK 的 Univer SDK Skills。授权方面需注意边界：本仓库的 Apache-2.0 包可用于商业应用；商业插件、Server SDK 与 AI SDK 扩展单独授权，评估版含水印与功能限制。

## 核心总结

- Univer 是 Apache-2.0 开源的 Office SDK：表格与文档编辑、公式计算、Headless 处理免费可用，协作与文件转换为商业扩展
- 三层结构：Web SDK（开源核心）、Server SDK（协作与文件）、AI SDK（智能体工具链），共享同一套内容模型与快照格式
- 应用与 AI 智能体共用 Facade API 与命令系统，跨功能编辑有统一的撤销/重做机制
- 近一周密集发布：v1.4.0 与 v1.5.0 带来图表工作表、画板布局、OLE 附件、GETPIVOTDATA 等功能
- 适合需要在自有产品中嵌入 Office 能力、或让智能体直接操作文档的团队

参考：

- [dream-num/univer - GitHub 仓库](https://github.com/dream-num/univer)
- [Release v1.5.0](https://github.com/dream-num/univer/releases/tag/v1.5.0)
- [Univer 官方文档](https://docs.univer.ai/)
- [开源与商业功能对比](https://univer.ai/compare/)
