---
title: "DeepSeek V4 Pro 上线 24 小时急撤：HF 配置疑似错发，权重与 API 后端连夜切换"
description: "DeepSeek V4 Pro 0813 发布不到 24 小时被撤下：Hugging Face 配置一度与 Flash 相同，权重重传、API 指纹热切换，疑为发版流程事故。"
pubDate: 2026-08-14
author: "林晓"
category: "models"
tags: ["DeepSeek", "V4 Pro", "Hugging Face", "发布事故", "API"]
---

8 月 13 日凌晨，DeepSeek 延续"不上发布会、不发海报"的风格，悄悄更新 API 文档，上线了 V4 Pro 正式版（DeepSeek-V4-Pro-0813）。一天之内口碑两极分化：官方跑分中 **Terminal-Bench 2.1 达 87.9 分**，距 Claude Fable 5（88.0 分）仅差 0.1 分；但实测党接入真实业务后反馈体感不及预期，Artificial Analysis 综合得分仅 **53 分**，只比参数量小得多的 V4 Flash 高 1 分。13 日下午，官网撤下 V4 Pro 正式版横幅与开放平台公告，外界一度以为模型遭遇回滚。

## Hugging Face 配置一度与 Flash 完全相同

顺着官方代码仓库 deepseek-ai/DeepSeek-V4-Pro-0813 的提交记录，社区发现最初上传的配置中 **hidden_size 为 4096、路由专家 256 个、隐藏层 43 层、Attention Head 64 个，与 V4-Flash-0731 完全一致**。开发者在 Hugging Face Discussion 提出质疑后，官方组织成员 msr2000 回复"已处理"，随后配置被修正为 hidden_size=7168、384 个路由专家、61 层、128 个 Attention Head，与此前 V4 Pro 的架构重新对齐；MoE 中间层大小、Q-LoRA Rank、路由系数、DSpark 相关参数也一并调整，普通 config.json 与 inference/config.json 两套推理配置均被修改。

## 权重重传与 API 指纹突变

Release 之后，官方先提交了一次 Update config.json，又通过 upload-large-folder 工具连续两次重传大文件。对照关键权重分片（model-00035 至 model-00039.safetensors），**SHA256 校验码全部改变、文件体积也有微妙变化**，说明至少部分真正的模型二进制被重新处理，而非只改了配置文件。

与此同时，DeepSeek 官方 API 的 system_fingerprint（系统指纹）出现罕见剧烈变动：此前开发者能从明文指纹直接读出构建日期（20260812）、生产环境、FP8 量化与 KV Cache 等工程细节，实测中不到半小时，Pro 与 Flash 的指纹几乎同时切换成无法解读的纯 32 位 Hash。指纹同步改变，对应着线上推理后端、部署版本、算力调度策略或指纹生成规则的彻底重构——线上推理栈经历了一场决绝的热切换。

## 结论：更像配置错位，而非模型翻车

几条线索串联起来看，这次发版混乱更可能是**前端接口、后端推理栈与权重配置三者严重错位**：不同时间、不同入口的开发者拿到的体验完全不在同一个频道上。能否定性为发布流程事故，团队内外自有评判，但事件给万亿参数时代的模型竞争敲响了警钟——V4 Pro 的 FP8 量化权重高达 **893 GB、由 66 个分片组成**，任何微小的配置错位，哪怕只是一个 config 参数写错，都可能在推理基础设施层被无限放大，最终在前端体验上砸出大坑。

## 核心总结

- V4 Pro 0813 上线不到 24 小时即撤下公告，口碑从"官测惊艳"快速反转至"实测争议"；
- HF 初始配置与 V4-Flash-0731 完全一致，后修正为 7168 hidden、384 专家、61 层、128 Head；
- model-00035~00039 权重分片 SHA256 全部变化，API system_fingerprint 由可读明文切为 32 位 Hash；
- 事件更可能是发版流程中前端、后端与权重配置错位，而非单纯的模型性能问题。

原文：[梁神变牢梁的原因找到了！疑似 DeepSeek 发错模型，HF配置和API后台紧急切换](https://mp.weixin.qq.com/s/J86oC0GFi7H4UHkkMdcp-A)（AI 前线，2026-08-13）
