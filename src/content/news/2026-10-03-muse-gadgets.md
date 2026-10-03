---
title: "Meta 开源 Muse Gadgets：把个人 AI 智能体接进你自己的硬件"
description: "Meta 开源 Muse Gadgets 硬件 SDK：闲置的 ESP32 开发板或树莓派刷上固件，就能给 AI 智能体 Muse 装上屏幕、按钮和传感器，官方已支持 15 块现成板子。"
pubDate: 2026-10-03
author: "林晓"
category: "tools"
tags: ["Meta", "Muse", "Muse Gadgets", "ESP32", "树莓派", "开源硬件", "智能体"]
image: "/covers/2026-10-03-muse-gadgets.jpg"
imageAlt: "封面：浅色编辑信息图风格，左侧为标题「Meta 开源 Muse Gadgets」，右侧为开发板、屏幕与云端智能体三格流程示意图，珊瑚橙强调色"
topStory: true
---

10 月 2 日，Meta 把一套叫 <strong>Muse Gadgets</strong> 的硬件工具包放上了 GitHub（仓库 `facebookincubator/muse-gadget-sdk`，Apache 2.0 许可），配套网站 gadgets.muse.ai 同时上线。它要解决的问题很具体：<strong>让 Muse 这个 AI 智能体从手机屏幕里走出来，接上你自己的硬件</strong>。

Muse 是 Meta 9 月 8 日发布的个人 AI 智能体，由自家的 Muse Spark 模型驱动、跑在一台独立的安全虚拟机里，平时替你发邮件、订行程、填表、比价，活动范围一直限于浏览器和各种 App。Muse Gadgets 相当于给它接上一双手：一块几十元的 ESP32 开发板，或者抽屉里吃灰的树莓派，刷上官方开源的固件，就能变成一块显示图片的小屏幕、一个按住说话的按钮、一组读温度湿度的传感器。

![Muse Gadgets 官方展示的五种硬件：圆形 AMOLED 屏、M5Stack StickS3、Muse Home Link、树莓派 5、电子墨水屏](/images/2026-10-03-muse-gadgets/lineup.webp)

从左到右：圆形 AMOLED 屏（Waveshare）、M5Stack StickS3、官方硬件 Muse Home Link、树莓派 5、电子墨水屏（Seeed reTerminal）。来源：Muse Gadgets 官网

## 分工很明确：Muse 负责「想」，板子负责「碰得到」

云端的大脑不会开灯，桌上的板子不会思考。Muse Gadgets 把这两件事接在一起：板子先通过蓝牙和 Wi-Fi 跟 Muse 建立一条加密连接，把自己身上的屏幕、麦克风、按钮、传感器交给 Muse 使用；Muse 再把要做的事交给板子。

![Muse Gadgets 的连接方式：你手边的硬件、配一次对、Muse 云端三栏流程示意图](/images/2026-10-03-muse-gadgets/how-it-works.svg)

官方提供两条路线，折腾难度差很多：

| | ESP32 Device SDK | Linux Device SDK |
|---|---|---|
| 跑在哪 | 任意 ESP32 开发板 | 树莓派 3B+/4/5/Zero 2W，或带蓝牙的 Linux 电脑 |
| 怎么装 | 用 ESP-IDF 6.0.1 编译固件再烧写 | 跑一条安装脚本，装成后台服务 |
| 能做什么 | 显示状态和图片、按住说话、读传感器 | 执行命令、读写文件、看机器健康状态 |
| 适合谁 | 想做一个放在桌上的小设备 | 想让 Muse 直接管你的一台机器 |

## 配一次对，大概五分钟

流程和连一副蓝牙耳机差不多：

1. 在 gadgets.muse.ai 领一个 SDK token：每台设备一个，相当于配对用的介绍信；
2. 刷固件（ESP32）或装服务（Linux）；
3. 手机 Muse App 里打开「设置 → 设备 → 开发者模式」，点加号添加设备，设备名形如 `MuseGadget-XXXXXX`；
4. 等设备指示灯变蓝时，按一下板子上的按钮确认是你本人；
5. 加入家里的 Wi-Fi，指示灯变绿，连接完成。

配好之后设备会一直在线，重启也不掉线；想重新配对，在设备上手动触发即可。官方特意提醒：<strong>这些是社区设备，配对没有厂商认证，挡不住中间人攻击</strong>，所以要放在自己信任的网络里用。

## 15 块板子，能力取决于装了什么

官方仓库里列了 15 块已经能跑的板子，从「只有一盏指示灯」到「完整屏幕界面」都有：

| 层级 | 例子 | 能做什么 |
|---|---|---|
| 只有灯 | ESP32-C5 DevKitC-1 | 显示连接状态，最省事的入门板 |
| 能显示图片 | Seeed reTerminal E1001 电子墨水屏、SenseCAP Indicator | 屏幕上显示简报、提醒、购物清单 |
| 完整界面 | Waveshare 1.75 寸圆屏、M5Stack StickS3 / StopWatch、ESP32-S3-BOX-3、SenseCAP Watcher | 会动的虚拟形象、按住说话、设置菜单 |

其中最有意思的是「内网隧道」：内存够用的板子（带 PSRAM）能让 Muse 伸手进你家局域网，去控制已有的智能家居设备，或者任何带本地 HTTP 接口的自制装置——官方举例说，社区技能已经能让 Muse 开灯、控制电视、把文件送到打印机，Philips Hue、Sonos、Apple TV、Google Nest 音箱、三星电视都有对应技能。官方同时提醒，社区技能由第三方维护，可能随时失效，<strong>不要用在安防、急救这类安全关键的场景</strong>。

![Muse 在电子墨水屏上显示的晨间简报：天气、倒垃圾提醒、晚餐和骑行安排](/images/2026-10-03-muse-gadgets/briefing.webp)

一块电子墨水屏上的「今日简报」：天气、几点倒垃圾、晚餐地址、傍晚骑行建议。来源：Muse Gadgets 官网

## 官方那台：Muse Home Link

除了自己折腾，Meta 还做了自己的硬件 <strong>Muse Home Link</strong>：一个白色小圆盒（35 × 42 × 10 毫米），插上任何 USB-C 或 USB-A 电源、摆在路由器旁边，就负责把 Muse 接进你家网络。用的是 ESP32-C5 芯片（240MHz RISC-V）、8MB PSRAM、8MB 闪存，支持 Wi-Fi 6 双频。

它的固件基于同一套开源 SDK，但<strong>官方明确说它不能刷第三方固件</strong>。目前只在美国提供：有 Muse 订阅的用户可以免费领一台，一人限一台，10 月开始发货，先到先得。

## 上手前最好知道三件事

- <strong>这不是消费级产品</strong>。官方在文档里自己写：「为黑客而做，图个乐」，副作用可能包括刷成砖、失去保修、电压不稳、破产，出了事自己负责。
- <strong>Linux 版的权限就是你的权限</strong>。装完服务后，Muse 能以你的账号身份在这台机器上跑 shell 命令、读写文件（对应 `system.run`、`file.read`、`file.write`、`device.health`）。你的账号能 `sudo`，它就能 `sudo`。反过来，机器上的程序也能主动往 Muse 的对话里塞消息，比如「车库门已经开了一个小时」。
- <strong>令牌要当身份凭证看待</strong>。SDK token 会被编译进固件，官方建议把它当作标识而不是密码；一旦泄漏，就在网站上吊销、换新、重新编译。另外建议开启 NVS 加密，否则拿到板子实物的人可以直接读出里面的 Wi-Fi 密码。

## 核心总结

- <strong>发布</strong>：Meta 于 10 月 2 日开源 Muse Gadgets 的设备 SDK 与固件（Apache 2.0），用途是把个人 AI 智能体 Muse 接到自制硬件上
- <strong>两条路线</strong>：ESP32 Device SDK（用 ESP-IDF 6.0.1 烧写固件）与 Linux Device SDK（在树莓派等设备上执行命令、读写文件）
- <strong>玩法</strong>：屏幕、按钮、麦克风、传感器都交给 Muse；带 PSRAM 的板子还能通过内网隧道控制家里的智能设备
- <strong>硬件</strong>：官方列出 15 块可用板子；自家硬件 Muse Home Link 采用 ESP32-C5、支持 Wi-Fi 6，美国 Muse 订阅用户免费领，10 月发货
- <strong>门槛</strong>：每台设备需要一个 SDK token，通过 Muse App 的开发者模式配对；社区设备没有厂商认证，务必在可信网络中使用
- <strong>边界</strong>：Linux 版权限等同于安装账号（可 sudo）；SDK token 随固件分发，建议开启 NVS 加密

原文：[Muse Gadgets](https://gadgets.muse.ai/)（Meta，2026-10）、[设备 SDK 与固件源码](https://github.com/facebookincubator/muse-gadget-sdk)（GitHub，Apache 2.0）
