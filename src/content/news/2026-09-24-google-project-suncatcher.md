---
title: "谷歌 Project Suncatcher：首批 TPU 即将进入轨道测试"
description: "Project Suncatcher 将首批 Trillium TPU 送上轨道，验证发射、辐射、真空散热与激光组网，为 2027 年双星测试铺路。"
pubDate: 2026-09-24
author: "林晓"
category: "research"
tags: ["Google", "Project Suncatcher", "TPU", "太空计算", "卫星网络"]
image: "/covers/2026-09-24-google-project-suncatcher.jpg"
imageAlt: "封面：浅色科学风大数字版式，中央突出 100g，副标题为「首批 Trillium TPU 即将升空」"
topStory: true
---

2026 年 9 月 24 日，Google Research 披露太空 AI 算力项目 Project Suncatcher 的最新进展：首批 Trillium TPU 将搭载 SpaceX 的 Transporter-18 拼车任务升空，任务由 Google 与 Planet 合作开发，用于检验 AI 硬件能否承受发射与低地球轨道环境。Google 将其定位为早期工程验证，重点不是立即建立商业太空数据中心，而是先确认硬件存活、散热与卫星互联；下一阶段里程碑在 2027 年。

## 先让 AI 硬件扛住发射

火箭进入低地球轨道约需 10 分钟，航天器持续加速度最高可达 10g，单个 TPU 芯片的瞬时载荷可能达到 50–100g。团队沿三个轴向反复振动整颗卫星，以模拟发射频率与受力，硬件通过了测试。

进入太空后，<strong>太阳活动与宇宙射线可能诱发比特翻转等电子故障</strong>。Google 在加州大学戴维斯分校 Crocker 核实验室的质子束设施中，让 TPU 运行 AI 工作负载并监测错误。初步结果显示，Trillium TPU 所能承受的总电离剂量高于五年太空任务的预计水平；但真实在轨表现仍需验证。

## 真空散热：从风扇转向热管与辐射器

TPU 会在小面积内产生大量热量，而太空没有空气对流，无法依靠风扇散热。Google 正测试热管与辐射器组合，并已在模拟热环境与真空条件的热真空舱中验证；首批设备入轨后还将继续调整设计。

## 激光组网：在高速运动中对准“数英里外的硬币”

后续每颗卫星将搭载数十个 TPU，以集群方式分担计算，并用激光连接相邻卫星。现有太空激光通信多面向远距离、低带宽场景，而该项目需要<strong>极短距离、极高带宽的稳定连接</strong>，精度堪比从数英里外瞄准运动中的硬币。Google 计划 2027 年部署两颗卫星验证。

## 对太空 AI 算力意味着什么

Project Suncatcher 采取渐进路线：先验证发射、辐射与真空适应性，再解决散热，最后测试激光互联。首次任务旨在识别失效点并为后续设计提供数据，尚不代表可扩展的轨道算力已经成熟。

## 核心总结

- **任务**：首批 Trillium TPU 搭载 Transporter-18 收集在轨数据，并非商业太空数据中心
- **验证**：整星通过三轴振动测试；质子束实验覆盖超过五年任务预期的总电离剂量
- **散热**：真空环境只能依靠辐射，Google 正测试热管与辐射器组合
- **组网**：激光链路需兼顾短距离、高带宽与高精度，2027 年计划双星测试
- **进度**：关键未知项仍是长期在轨辐射、散热稳定性与链路可靠性

原文：[Behind Project Suncatcher, our moonshot to put AI in space](https://blog.google/innovation-and-ai/models-and-research/google-research/google-project-suncatcher-facts/)（Google Blog，2026-09-24）
