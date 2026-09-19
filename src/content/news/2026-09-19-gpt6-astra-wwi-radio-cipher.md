---
title: "GPT-6 Astra：破解一条百年未解的一战德军 ADFGVX 密电"
description: "GPT-6 Astra 破解一条百年未解的一战德军 ADFGVX 密电，用密钥 TRUPPENVERSCHIEBUNG 还原 1918 年塞瓦斯托波尔情报，并与 HMS Canterbury 航海日志吻合。"
pubDate: 2026-09-19
author: "林晓"
category: "models"
tags: ["GPT-6 Astra", "OpenAI", "ADFGVX", "密码学", "一战", "模型能力"]
image: "/covers/2026-09-19-gpt6-astra-wwi-radio-cipher.jpg"
imageAlt: "封面：深海军蓝电影感科技风，左侧标题 GPT-6 Astra 与副标题「一战德军 ADFGVX 密电破译」，右侧无线电波、密表网格与其中一份档案照片剪影，紫色辉光点缀"
topStory: true
---

1918 年 11 月 27 日，一条用德军 **ADFGVX** 密码发送的无线电情报，在一个多世纪后终于被破译——出手的是 OpenAI 的 **GPT-6 Astra**。这条密电属于德国科学博客门户 Scienceblogs.de 收录的「50 个未解密码」之一，此前长期无人解开。Astra 用密钥 **TRUPPENVERSCHIEBUNG** 完成解码，明文记述英国巡洋舰抵达塞瓦斯托波尔（Sevastopol）等情报，并与 HMS Canterbury 号的原始航海日志相互印证。

## 背景：50 个未解密码中的一战德军密电

Scienceblogs.de 有一份颇为著名的「50 个未解密码」清单，收录范围从连环杀手留下的加密文本，到著名的伏尼契手稿（Voynich manuscript）。其中一组是一战德军用 **ADFGVX** 方法加密的无线电密文。

ADFGVX 是一种「先替换、后置换」的复合密码：先用一张 6×6 的表格（行、列分别标 A/D/F/G/V/X）把字母和数字映射成两个密文字符，再对整段密文做列置换。以密钥「HOUSE」为例，表格如下：

|  | A | D | F | G | V | X |
|---|---|---|---|---|---|---|
| A | H | O | U | S | E | A |
| D | B | C | D | F | G | I |
| F | J | K | L | M | N | P |
| G | Q | R | T | V | W | X |
| V | Y | Z | 0 | 1 | 2 | 3 |
| X | 4 | 5 | 6 | 7 | 8 | 9 |

这样一来，每个格子都有唯一坐标：例如「AA」对应 H、「AD」对应 O、「DA」对应 B，于是「PRINZ」可编码为 `FX GD DX FV VD`。换一个密钥词，整张表就完全不同。

德军当时使用了一批已知密钥，数百条此类密电已被破译——包括密码破解专家 George Lasry 的成果；但仍有一打以上悬而未决，其中就有这条 1918 年 11 月 27 日发送的密电（见 J. Rives Childs《The History and Principles of German Military Ciphers, 1914–1918》p. 217）。

![1918 年 11 月 27 日的一战德军 ADFGVX 密电原文](/images/gpt6-wwi-cipher-message.jpeg)

## 破译过程：一场自验证的解密

GPT-6 Astra 给出的原始明文是：

> EIN ENGLISCHER KREUZER EINLIEG X SEWASTOPOL X S4STEN X EIN GESCHWADER DER X ALLIIERTEN FOLGT 26STEN X

大意即「一艘英国巡洋舰于？4 日抵达塞瓦斯托波尔，一支盟军分舰队将于 26 日跟进」（「X」为单词分隔符）。

模型使用的密钥词是 **TRUPPENVERSCHIEBUNG**（德语「部队调动」），该密钥见于 J. Rives Childs《The History and Principles of German Military Ciphers, 1914–1918》第 214–215 页，由此得到如下表格：

![密钥 TRUPPENVERSCHIEBUNG 生成的 ADFGVX 表格](/images/gpt6-wwi-adfgvx-table.jpeg)

使用表格前，还须把密钥的字母按字母表顺序重排（例如 T 排第 16 位、R 排第 13 位）：

![密钥按字母表顺序重排（例如 T 第 16 位、R 第 13 位）](/images/gpt6-wwi-adfgvx-key-reorder.jpeg)

之后把 TRUPPENVERSCHIEBUNG 横向写出，将密文逐字符填在其下，每行 19 个字符——合计 170 字符，即 8 行满 19 个加 1 行 18 个。这样得到 18 个含 9 个字符的列，外加 1 个含 8 个字符的列（G 列）。T 是第 16 列，其前有 14 个 9 字符列和 1 个 8 字符列：9×14 + 8 = 134，所以 T 对应密文的第 135 个字符「A」；同理，R 是第 13 位，对应第 108 个字符「V」。在表格里「AV」即「E」，正是明文 EIN 的首字母。如此循环，直到整条密文被解出。

关于这条密电此前为何无人解开，Astra 的推测是：<strong>TRUPPENVERSCHIEBUNG 作为密钥从 1918 年 12 月 9 日才开始启用</strong>，而这封密电的发送时间更早——11 月 27 日。这其中的时间差原因尚不清楚。

## 历史印证：与 HMS Canterbury 航海日志吻合

Astra 主动核验了自己的结果：根据英舰原始日志，巡洋舰 **HMS Canterbury** 确实于 1918 年 11 月 24 日抵达塞瓦斯托波尔，盟军分舰队随后在 11 月 26 日跟进（见下图第 11 行附近关于盟军分舰队"抵达"的记录）：

![HMS Canterbury 原始航海日志：1918 年 11 月 24 日抵达塞瓦斯托波尔](/images/gpt6-wwi-hms-canterbury-logs.jpeg)

![盟军分舰队 11 月 26 日抵达的记录](/images/gpt6-wwi-allied-squadron-logs.jpeg)

原文作者并不确定这条密电此前是否被破译过，于是把它作为一个「小而酷」的成果公开，顺带展示这款模型的推理能力。

## 核心总结

- **一条百年未解**：1918 年 11 月 27 日发送的德军 ADFGVX 密电，此前多年无人破译；
- **独立完成解码**：GPT-6 Astra 使用密钥 TRUPPENVERSCHIEBUNG 还原出明文；
- **史实互证**：解码内容与 HMS Canterbury 于 1918 年 11 月 24 日抵达塞瓦斯托波尔、盟军分舰队 26 日跟进的航海日志记录相吻合；
- **仍有疑团**：按记载该密钥从 12 月 9 日才启用，比密电发送晚了近两周，原因不明。

原文：[GPT-6 Astra Solves a WWI German Radio Cipher](https://www.prinzai.com/p/gpt-6-astra-solves-a-wwi-german-radio)（prinz，2026-09-17）
