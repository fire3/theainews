---
title: "Mojo 语言正式开源：Apache 2.0 许可，编译器与工具链全部公开"
description: "Modular 宣布 Mojo 全面开源：编译器与工具链以 Apache 2.0（含 LLVM 例外）发布到 GitHub，上周 Mojo 1.0 已实现源码稳定，可从源码自行构建。"
pubDate: 2026-08-19
author: "林晓"
category: "tools"
tags: ["Mojo", "Modular", "开源", "编程语言", "编译器", "GPU"]
image: "/covers/2026-08-19-mojo-open-source.jpg"
imageAlt: "科学严谨风封面：编译器与 GPU 算力节点构成的流程示意图，标题 Mojo 全面开源，统计卡片标注 Apache 2.0、1.0 源码稳定、年底开放贡献"
topStory: true
---

8 月 18 日，Modular 在 ModCon 2026 大会宣布，面向 AI 的系统编程语言 **Mojo🔥** 以 **Apache 2.0 许可（含 LLVM 例外）** 正式全面开源。编译器、工具链以及构建这一语言所需的全部源码，现已发布到官方 GitHub 仓库（github.com/modular/modular），任何人都能从源码构建编译器并运行 Mojo 程序。

## 四年的开放社区，一朝公开编译器

Mojo 的定位是「AI 时代的新一代通用编程语言」：它集成最新的编译器与编程语言研究，目标是解锁 **GPU、AI 加速器等高级算力**。过去四年，Mojo 一直以开放社区的方式共同开发，但编译器始终闭源。上周 Mojo 发布 **1.0（源码稳定）**，本周则更进一步，公开了整套编译器与工具链。

Modular 表示开源路径经过刻意设计：小而紧密的设计团队负责把握语言「灵魂」，再由更广泛的社区反馈避免回声室效应。官方先是开源了 Mojo 标准库，随后陆续发布数十万行用 Mojo 编写的内核代码与工具，并在公开设计提案中收集反馈——如今轮到编译器本身，未来还将进一步开放流程。

## 为何选择 Apache 2.0

官方称 **Apache 2.0 是编程语言与编译器领域的「黄金标准」许可**，灵活性高，可被各类应用自由采用；**LLVM 例外**条款则进一步放宽了用 Mojo 编译、分发二进制的自由，让开发者能尽可能广泛地使用这一语言。

## 从源码构建编译器

所有代码现位于 modular GitHub 仓库，克隆后用一条命令即可从源码构建并运行 Mojo：

```bash
git clone https://github.com/modular/modular.git
cd modular
./bazelw run --config=build-mojo KGEN:mojo -- run hello.mojo
```

如需修改并测试标准库，可运行 `./bazelw test --config=build-mojo mojo/stdlib/test/...`；若只是使用而非开发编译器，用 `--config=prebuilt-mojo` 即可直接下载最新 nightly 编译产物，省去本地编译时间。

## 贡献节奏

Mojo 标准库自 2024 年起就已接受社区贡献。不过官方坦言，在 AI 编程时代会审慎处理贡献流程：目前尚未开放对编译器与工具链的贡献，目标是**今年年底前**开放，届时会公布更多细节。

## 核心总结

- **全面开源**：Apache 2.0（含 LLVM 例外），编译器、工具链与标准库全在 GitHub
- **源码可构建**：一条 bazelw 命令即可从源码编译并运行 hello.mojo
- **路线清晰**：先开放标准库与内核代码，再开放编译器，贡献通道预计年底开放
- **定位**：面向 GPU、AI 加速器的新一代通用系统编程语言

原文：[Mojo🔥 is now open source!](https://www.modular.com/blog/mojo-open-source)（Modular，2026-08-18）
