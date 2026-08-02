---
title: "smevals 上手：给模型、提示词和 Agent 框架做评测的轻量套件"
description: "Simon Willison 的轻量评测套件 smevals：目录即评测、YAML 配任务、脚本当裁判，还能让编码智能体自己搭评测。"
pubDate: 2026-08-02
author: "林晓"
category: "tutorial"
tags: ["smevals", "模型评测", "LLM", "开源工具", "教程"]
---

前沿模型的进步肉眼可见，但价格也在跟着涨：GPT-5.5 和 5.6 Sol 的价格是 GPT-5.4 的两倍，Claude Fable 5 是 Opus 4.8 的两倍，连 Google 主打便宜的 Gemini 3.5 Flash-Lite 都比上一代贵了。与此同时，便宜模型的选项从未如此丰富：能在小设备上跑起来的本地模型能力暴涨，头部开源模型也在以惊人的速度逼近闭源竞品——价格却低得多。

问题随之而来：怎么在这么多模型里，为特定任务找出最合适、最便宜的那一个？Prime Radiant 的 Simon Willison 为此开源了一个轻量评测工具 **smevals**（small evals），它用"目录即评测"的方式，把模型、提示词和 Agent 框架放在同一个框架里对比。

## 先理解 smevals 的几个概念

smevals 是一个 Python CLI 工具，评测套件就是一个包含 YAML 配置和可执行脚本的目录。它用一套明确的概念组织整个流程：

| 概念 | 含义 |
|---|---|
| eval（评测） | 一组挑战，回答关于模型的某个问题，例如"这个模型生成 SVG 的水平如何" |
| task（任务） | 单个具体挑战，例如"生成一只骑自行车的鹈鹕的 SVG" |
| config（配置） | 指定被测模型，也可包含系统提示词、模型参数或 Agent 框架等变量 |
| run（运行） | 用某个配置执行某个任务的过程记录；runner 是执行运行的脚本 |
| grader（评分器） | 对运行结果评分，产出 grade；每个 grader 执行一系列 checks |
| check（检查） | 可以是简单操作（检查输出包含某字符串、是否为合法 XML），也可以是复杂自定义脚本（checker），甚至调用其他模型来评判 |

整个流程只有四步：设计并实现任务 → 决定评分方式 → 用若干配置跑任务 → 运行 grader 得到分数。结果既可以在终端看，也可以用自带的 Web 应用浏览，还能烘焙成静态站点发布。

## 让编码智能体帮你写评测

smevals 最有意思的设计是：README 不只是给人看的，也是给 Agent 看的。文档随工具一起分发，执行 `smevals docs` 就能取到。

先在 Claude Code、OpenAI Codex、Pi 或任意你习惯的智能体里运行：

```bash
Run the command "uvx smevals docs"
```

等它读完文档，直接下需求：

```text
Now build an eval that tests how well models can write haikus,
with two tasks - a haiku about a pelican and a haiku about two otters in love
```

Agent 就会在当前目录搭好整个评测。然后运行：

```bash
uvx smevals run . -g
```

`.` 表示运行当前目录的评测，`-g` 让运行完立刻评分（否则之后要单独执行 `smevals grade .`）。作者第一次跑的输出长这样：

```text
otters-in-love / default / gpt-4.1-mini ... ok (5.0s)
  grade: pass score=1.0
pelican / default / gpt-4.1-mini ... ok (12.6s)
  grade: pass score=1.0
```

换更多模型对比也很直接，每个 `-m` 会依次把两个任务各跑一遍：

```bash
uvx smevals run . -g -m gpt-5.5 -m gpt-5.4-nano
```

这里的 runner 是一个很短的 shell 脚本 `run-llm`：用 `llm` CLI 按 smevals 给的模型和提示词调用，并把 LLM 的 JSON 日志作为产物一起保存：

```bash
#!/usr/bin/env bash
set -euo pipefail
llm -m "$SMEVALS_MODEL" "$SMEVALS_PROMPT"
llm logs -c --json > log.json
```

这个俳句评测最初只有七个文件：

```text
haiku/
├── eval.yaml
├── tasks/
│   ├── pelican.yaml
│   └── otters-in-love.yaml
├── configs/
│   └── default.yaml
├── graders/
│   └── default.yaml
├── checkers/
│   └── three-lines
└── run-llm
```

## 改进 grader：从数行数到让模型当裁判

Codex 搭的第一版 grader 只检查输出是否恰好三行非空。checker 脚本从 `SMEVALS_RUN_DIR` 环境变量拿到运行目录，输出 JSON，包含 `score`、可选的 `metrics` 和 `notes`：

```python
#!/usr/bin/env python3
import json, os
from pathlib import Path

output = Path(os.environ["SMEVALS_RUN_DIR"], "output.txt").read_text()
lines = [line for line in output.strip().splitlines() if line.strip()]
line_count = len(lines)
passed = line_count == 3

print(json.dumps({
    "score": 1.0 if passed else 0.0,
    "metrics": {"line_count": line_count},
    "notes": f"{line_count} non-empty line(s); expected exactly 3",
}))
raise SystemExit(0 if passed else 1)
```

然后作者让 Codex"用 gpt-5.5 检查音节的辅音元音是否合格"，于是多了一个 `haiku-judge` checker：用 Python 驱动 `llm` 提示词来评判俳句。它要求模型按当代标准英语发音数音节（不数字母）、判断是否扣题、并按意象/连贯性/简洁性给 0–1 的诗歌质量分，同时不因标点大小写奖惩；还通过 JSON Schema 强制返回结构。`graders/default.yaml` 变成了这样，用 `pass_threshold` 判定及格线：

```yaml
name: default
checks:
  - checker: ../checkers/three-lines
    required: true
  - checker: ../checkers/haiku-judge
    model: gpt-5.5
    required: true
scoring:
  pass_threshold: 0.8
```

新 checker 只在 5-7-5 音节模式和题目主题都满足时才退出成功，任何一项检查失败整体就是 fail。由于 smevals 刻意把"运行"和"评分"分开，改完 grader 后可以直接对已有日志重新评分：

```bash
uvx smevals grade . --regrade
```

## 浏览与发布结果

用 Web 应用在本地查看全部运行和评分：

```bash
uvx smevals serve .
```

默认端口 7001，也可以 `--port 8000` 指定。界面里可以对比不同模型和配置的表现：

![smevals Web 报告：对比不同模型的运行与评分结果](/images/smevals-report.webp)

要发布成静态站点，执行：

```bash
uvx smevals build .
```

会在 `build/` 目录生成 `index.html` 和渲染报告所需的文件，丢到任意静态托管即可，本地预览用 `uv run python -m http.server`。

## 核心总结

- **理念**：为不同类别的任务找到最合适、最便宜的小模型，而不是默认冲前沿大模型
- **用法**：目录即评测——YAML 定义任务/配置/评分，shell 或 Python 脚本当 runner 和 checker
- **Agent 友好**：`smevals docs` 让编码智能体自己读文档、搭评测、写 grader，人工只提需求
- **灵活评分**：从字符串检查到"让 gpt-5.5 当俳句裁判"都行，运行与评分分离，改完 grader 可随时 `--regrade`

原文：[smevals - a small eval suite for evaluating models, prompts, and harnesses](https://primeradiant.com/blog/2026/smevals.html)（Prime Radiant）
