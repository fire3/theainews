---
title: "DeepSeek-V4-Flash-Vision-Exp 上线：多模态 API 开启，Agent 能力逼近 Opus-4.8"
description: "等待四个月的 DeepSeek 多模态模型终于落地：看图按 token 计费（最多 384 tokens/张，1 分钱约看 9 张图），文本能力与 V4-Flash 持平，视觉 Agent 评测大幅跃升。"
pubDate: 2026-08-22
author: "林晓"
category: "models"
tags: ["DeepSeek", "多模态", "Vision", "API", "Agent", "模型发布"]
topStory: true
image: "/covers/2026-08-22-deepseek-v4-flash-vision-exp.jpg"
imageAlt: "深色电影感科技封面：DeepSeek-V4-Flash-Vision-Exp 多模态模型上线，一只发光的眼睛与数据流辉光，青色调，标题聚焦视觉与 Agent 能力"
---

DeepSeek 的多模态模型终于来了。4 月开始灰度内测识图、6 月端上网页版与 App 之后，**2026 年 8 月 21 日**，DeepSeek 实验性视觉理解模型 **DeepSeek-V4-Flash-Vision-Exp** 正式上线 API 平台。这个被网友戏称"给鲸鱼开眼"的模型，最核心的变化就是原生支持图片输入——虽然图片生成依然没有。

与纯文本版本 DeepSeek-V4-Flash 相比，它在纯文本能力（Agent、推理、世界知识等）上完全持平；但在需要视觉理解的 Agent Benchmark 上实现了**大幅跃升**，多模态 Agent 能力已接近 Opus-4.8。这就把一批此前因"模型没长眼睛"而无法落地的 Agent 场景（前端开发、PPT、看图对话）真正解锁了。

## 一图看关键信息

| 项目 | 详情 |
|---|---|
| 模型 ID | `deepseek-v4-flash-vision-exp`（实验性质）|
| 上线时间 | 2026-08-21 |
| 文本能力 | 与 DeepSeek-V4-Flash 正式版持平 |
| 视觉 Agent | 相比 V4-Flash 大幅跃升，接近 Opus-4.8 |
| 图片格式 | JPEG / PNG / GIF / WebP（按文件内容识别，不看名称或 MIME）|
| 计费 | 图片按 token 计费，每张最多 384 tokens，价格与 V4-Flash 一致 |
| 调用协议 | Chat Completions、Messages、Responses 三种 |
| 图片传入 | base64 内联、外部 URL、Files API 三种方式 |

## 平衡文本与多模态

官方给出的定位是"平衡文本与多模态能力"：**没有**为了迁就多模态而牺牲纯文本表现。在公开基准的 Agent、推理、世界知识等纯文本任务上，Vision-Exp 与 V4-Flash 保持一致；而一旦进入需要"看"的 Agent Benchmark，它的表现相比 V4-Flash 实现了大幅跃升，多模态 Agent 能力已经接近 Opus-4.8。

这套平衡让新模型能无缝继承此前 DeepSeek-V4 系列积累的文本 Agent 生态，同时补上视觉这块最大的短板——尤其对前端开发这类"看不了图就没法反馈迭代"的场景，价值是实打实的。

## 解锁更多 Agent 场景

由于多模态能力打开，官方与社区展示了大量此前 DeepSeek 模型做不到的玩法：

- **PPT 生成**：纯文本模型"盲画"PPT 很容易崩，Vision 模型能结合视觉版式输出，白领场景最佳受益者。
- **网页二次创作**：让模型读取现有页面视觉，做未来主义风格的官网重构（官方 demo 用"黑蓝深海、玻璃 UI、ASCII 原子像素"重构了 DeepSeek Harness 官网）。
- **前端 Mini Demo**：根据图片灵感生成黏土怪物风格的动态特效页面，验证模型的审美与前端执行力。

搭配 **DeepSeek Harness（DSH）** 使用效果更佳：DSH 本次同步更新，正式原生支持"第一方"多模态模型，可以直接在最新版里选择这个视觉模型，把"看 + 推理 + 工具"串成完整的 Agent 闭环。

## 计费：看图到底多少钱

多模态 API 的计费逻辑是**图片先转成 token，再按 token 计费**，价格与 V4-Flash 模型完全一致。每张图片最多占 **384 tokens**。

按"高峰时段 + 缓存未命中"折算人民币，看一张图大约 **0.12 分钱**；即便每张都占满 384 tokens，**1 分钱理论上能看约 9 张图**。作为对比，OpenAI 的 Image 2 看一张要 2.06 分——比 DeepSeek 贵了将近 20 倍。对高频看图、批量截图分析的开发者来说，成本优势非常明显。

## API 接入速览

设置 `model='deepseek-v4-flash-vision-exp'` 即可访问，base_url 为 `https://api.deepseek.com`。API 支持**图文混合输入**，并兼容三种调用协议：Chat Completions、Messages（Anthropic 兼容）、Responses。

图片传入有三种方式，都基于 OpenAI 兼容的 `content` 数组块格式：

1. **base64 内联**：把图片编码成 `data:` URL 直接塞进请求，最简单，适合本地文件（受 48 MiB 请求体大小限制）。
2. **外部 URL**：传一个公网可访问的 http(s) 链接让模型下载。URL 最长 8192 字符，图片最大 32 MiB，下载需在 60 秒内完成。
3. **Files API 引用**：先用 Files API 把图片上传一次，之后通过 `file_id` 引用。适合同一张图多次复用，或请求体超过内联上限的场景。经 Files API 传入的图片最大可达 **64 MiB**，不受 32 MiB 单图检查约束。

用 Python SDK 做一次最简单的识图：

```python
import base64
from openai import OpenAI

client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

with open("image.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

response = client.chat.completions.create(
    model="deepseek-v4-flash-vision-exp",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What is in this image?"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ],
    }],
)
print(response.choices[0].message.content)
```

等效的 curl 请求：

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <DeepSeek API Key>" \
  -d '{
    "model": "deepseek-v4-flash-vision-exp",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe this image."},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<BASE64_DATA>"}}
      ]
    }]
  }'
```

## Files API 同步上线（免费）

配合多模态 API，DeepSeek 也开放了 **Files API**，且**不收费**。用户可先把图片上传到平台，再在请求里通过 `file_id` 引用，从而节省请求带宽；同一张图片在多个请求中无需重复上传。详细用法见官方 [API 指南 - Files API](https://api-docs.deepseek.com/guides/files)。

## 小结

- DeepSeek-V4-Flash-Vision-Exp 是等待四个月后上线的实验性多模态模型，原生支持图片输入（图片生成仍不支持）。
- 纯文本能力与 V4-Flash 持平，视觉 Agent Benchmark 大幅跃升、接近 Opus-4.8，解锁前端、PPT、图文对话等场景。
- 价格与 V4-Flash 一致，图片每张最多 384 tokens；1 分钱约看 9 张图，较 Image 2 便宜近 20 倍。
- 支持 Chat Completions / Messages / Responses 三种协议，图文混合输入，base64、外部 URL、Files API 三种传图方式；Files API 同步免费开放。
- DeepSeek Harness 同步原生支持第一方多模态模型。

参考：[DeepSeek 官方新闻（V4-Flash-Vision-Exp 上线）](https://api-docs.deepseek.com/zh-cn/news/news260821/) · [API 指南 - 图像理解](https://api-docs.deepseek.com/guides/vision/) · [量子位实测《1分钱9张图！DeepSeek视觉模型连夜实测》](https://mp.weixin.qq.com/s/pFccNqvORawqhFT3ZJ9ZLA)
