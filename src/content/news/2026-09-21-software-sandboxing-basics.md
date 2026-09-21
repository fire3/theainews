---
title: "软件沙箱基础：从程序化降权到 Capsicum、seccomp 与 Landlock"
description: "沙箱不是容器：从程序化降权、文件描述符即能力，到 Capsicum、seccomp 与 Landlock 的取舍，一篇讲清软件沙箱的底层机制。"
pubDate: 2026-09-21
author: "林晓"
category: "tutorial"
tags: ["沙箱", "Capsicum", "seccomp", "Landlock", "能力安全", "FreeBSD", "Linux"]
image: "/covers/2026-09-21-software-sandboxing-basics.jpg"
imageAlt: "封面：暖色手绘教育风，超大数字 100 居中，副标题说明 Capsicum 只用 100 行代码就给 Chromium 加上沙箱"
---

「沙箱」这个词被用得太随意：容器、虚拟机、chroot、setuid、浏览器标签页都常被冠以这个名字。Emilua 项目作者 Vinícius dos Santos Oliveira 在 2025 年 1 月的一篇长文里做了件少见的事——把软件沙箱拆回到操作系统提供的原语层面，讲清楚哪些机制真的在限制权限、哪些只是看起来像。

本文基于该文写成，尽量完整地转述其中的机制、数字与经验判断。它面向需要在程序内部隔离不可信代码的开发者——今天大量在沙箱中执行模型生成代码的智能体运行时，用的正是同一批原语。

## 沙箱的定义：三个限定条件

文中的定义来自 Julien Tinnes 与 Chris Evans 在 2009 年 Hack In The Box Malaysia 上的演讲：

> 限制一个进程特权的三种性质：程序化地（programmatically）；无需机器上的管理权限；自主降权（discretionary privilege dropping）。

这三条限定了讨论范围，逐条展开会更清楚。

<strong>程序化（programmatic）</strong>指的是由程序自己在运行时调用接口降权，而不是靠系统管理员事先配置文件权限、seccomp 策略或 SELinux 域。第三方的程序会抽象出自己的虚拟世界——用 UNIX 文件权限去表达「谁能看你的信息流」本来就是错配。传统工具如 `setuidgid` 面向的是系统管理员，不是软件开发者；Firefox 跑 DRM 插件时希望插件拿不到用户 `HOME` 下的所有文件，这类需求只能由程序自己在内部解决。

<strong>无需管理权限（without administrative authority）</strong>指的是普通用户启动的进程也能建立沙箱。当好用的降权接口还不存在时，开发者曾靠滥用只有超级用户才能用的机制绕路，最典型的是用一个 setuid 辅助程序配置 chroot 监牢。问题是它要求程序有权安装 setuid 二进制文件，而一旦允许任意程序安装 setuid 二进制，所有安全措施都可以作废——setuid 等于临时把进程提升为系统的完全管理权限。特权只应减少，不应增加。

<strong>自主降权（discretionary privilege dropping）</strong>则是 Tinnes 提出的说法，用来和更宽泛的「沙箱」区分开。CNSS 2022 年词汇表给的定义是「一个受限的、受控的执行环境，阻止潜在恶意软件访问任何未被授权的系统资源」，但这类定义过于宽松，实际社区对「什么算沙箱」并没有共识。本文讨论的是前一义：自主降权不取代系统管理策略，两者互补并应同时使用。

## 不用 root 降权：suid 与 namespace 的陷阱

经典做法是用 setuid 辅助程序配置 chroot。它的问题不只是「需要特权」，还在于它把内核攻击面放大了。

Docker 的流行让 Linux namespace 成了廉价隔离的代名词，但在嵌套的 user namespace 里，进程在该 namespace 内是以超级用户身份运行的——内核中原本只对超级用户开放的代码路径，现在对所有用户开放。这些内核代码写了十几年，从没按这个前提设计过。Andy Lutomirski 曾公开表示：

> 我认为让 `CLONE_NEWUSER` 能获取任一网络 namespace 上的 `CAP_NET_ADMIN`、从而访问网络配置 API，是个巨大风险。举例来说，非特权用户就能编程 iptables。如果这里面没有提权漏洞，我把帽子吃了。

把 user namespace 限制给 Docker 这类受信任的容器化工具是可以的，但它是<strong>软件沙箱的糟糕接口</strong>。Linux 上更新的沙箱接口——比如 Landlock——在设计时就刻意避免指数级放大内核攻击面；而且限制 namespace 的新机制仍在开发中，把它当作通用沙箱机制是长期的坏赌注。

作者的经验也印证了这一点：Emilua 最初几年在软件沙箱上的研究全部围绕 Linux namespace，经历大量挫折后重心转向了别的方案。今天 Emilua 仍然支持 Linux namespace，但定位已改为「构建容器化工具」，真正的沙箱用的是另一套机制。

![三条降权路径对比：程序化接口符合沙箱定义，setuid 辅助程序与 user namespace 都在把权限往上抬](/images/software-sandboxing-basics/three-paths.svg)

## 落地：权限边界在进程

在主流的操作系统里，特权边界就在进程这一层：凭证（credentials）与进程绑定，内核据此判断进程能否用环境授权（ambient authority）获取新资源。

Linux 其实把凭证关联在线程上，但以线程为根的设计行不通。glibc 会额外做工作保证线程间凭证同步；GNOME 开发者曾以为可以按线程来操作，结果被 CVE-2023-43641 打脸。Adam Langley 描述过一个理论上可行的线程级方案——每个不可信线程配一个同进程的受信辅助线程，受信线程只能信任自己的 CPU 寄存器，所有内存都必须视为敌意，代码得手写汇编，通过 socket pair 接收系统调用请求并代其执行——但它在工程成本上不可行。

所以现实答案就是：把程序切分成多个进程，然后做两件事——给每个隔间分配不同特权，处理隔间之间的通信。Capsicum 研究者十多年前的这句话就是最好的模型：

> 隔间化的应用开发，必然就是分布式应用开发：软件组件运行在不同进程中，通过消息传递通信。

## Actor 模型与能力安全

分布式系统里最成熟的协作模式是 actor 模型。抛开数学定义，只保留与实现相关的几条：actor 能管理自己的内部状态、能创建其他 actor、能互相发消息、消息里可以携带其他 actor 的地址。

落到 Emilua 的 API 上只有三个函数：

```lua
new_actor = spawn_vm(module)   -- 创建 actor，返回地址
new_actor:send(msg)            -- 向地址发消息
msg = inbox:receive()          -- 读取发给自己的消息
```

在沙箱场景下，每个进程就是一个 actor，actor 地址用 UNIX domain socket 表达，进程创建时设置好 socket 继承。消息里携带地址这件事也成立，因为<strong>文件描述符可以通过 UNIX domain socket 传递</strong>——收件箱的描述符永不外发，于是天然形成一条 MPSC 通道。Emilua 里要显式要求用子进程实现：

```lua
local new_actor1 = spawn_vm{ module = 'module1', subprocess = {} }
local new_actor2 = spawn_vm{ module = 'module2', subprocess = {} }
```

这套设计顺手解决了另一个问题：把资源交到受限进程手里。「一切皆文件（描述符）」意味着可传递的资源种类极广——普通文件、目录、管道、socket、设备节点（`/dev/random`、GPU 通信等）、共享内存（memfd）、进程句柄（pidfd）、同步对象（eventfd），甚至 eBPF 程序。只要证明描述符没有泄漏给错误的 actor，这套模型就成立。

剩下的缺口由能力安全（capability-based security）补上：它要求令牌不可伪造，而 actor 地址是可伪造的。解决办法是用通道（channel）替代地址——API 不变，使用者无感。有了能力模型就可以回答这类问题：actor A 是否可能有效访问资源 X？如何设计布局，让任何被沙箱化的 actor 都无法同时拿到文件与 socket？Pony 语言就是 actor 模型加能力安全的一个实现。

使用文件描述符作能力的经验法则是<strong>避免 ioctl</strong>，后文会解释原因。actor 模型的能力在于消息可携带地址，因而拓扑可任意变化；Chromium 的沙箱拓扑就是这种多进程结构的一个实例，而在实际项目里，多数情况下树形拓扑就够了。

![actor 拓扑与文件描述符即能力：收件箱描述符不外发构成 MPSC 通道，可交接的资源覆盖文件、socket、设备节点、memfd、pidfd、eventfd 与 eBPF 程序](/images/software-sandboxing-basics/capability-model.svg)

## 文件描述符即能力

能力（capability）不只是对资源的引用，还包含附着其上的访问权限——持有能力即意味着有权执行相应操作。要拿文件描述符当能力，需要两个前提：一是描述符确实能建模为能力，二是要清楚使用时的注意事项。

UNIX 的权限检查<strong>只发生在创建描述符时</strong>，而不是使用已有描述符时，这与能力模型天然兼容：

```c
#include <fcntl.h>
#include <stdio.h>

int main()
{
    int fd = open("/root", O_RDONLY);
    if (fd == -1) {
        perror("open");
    } else {
        printf("success\n");
    }
}
```

以 root 运行输出 `success`，以其他用户运行输出 `open: Permission denied`。更说明问题的是这条：

```bash
# root：可以读到 /etc/shadow
grep -Ee '^nobody:' </etc/shadow
nobody:!*:19642::::::

# 普通用户：读不了
$ grep -Ee '^nobody:' </etc/shadow
-bash: /etc/shadow: Permission denied

# 以普通用户身份运行 grep，但让它继承 root 打开的描述符
# setpriv --reuid=1000 --regid=1000 --init-groups grep -Ee '^nobody:' </etc/shadow
nobody:!*:19642::::::
```

最后一条成功读取，正是因为对已有描述符的操作不再做权限检查。反方向同样成立：suid 二进制被设计成「写者的凭证完全不重要」，所以下面这条命令能用特权进程的凭证写进任意继承来的描述符——

```bash
$ setsid su </dev/null 2>&1 | cat
Password: su: Authentication token manipulation error
```

这个惯例被内核开发者严格遵守，历史上还修正过一次实现：Linux 新增文件系统挂载相关系统调用时，最初版本在处理中用 `write` 并依赖调用进程的凭证做检查，因此被驳回；最终改用新加的 `fsconfig` 才被接受。即便发行版完全禁用 suid 二进制，这个惯例依然会被遵守，因为它只是把攻击者本就能做的事换了个路径。

唯一的例外是 <strong>ioctl</strong>：对来自不可信进程的描述符执行 ioctl 永远是危险的。Boost.Asio 曾不必要地依赖 `FIONBIO`，作者与 Christopher Kohlhoff 邮件沟通后，Boost 1.86 起改为正确做法。顺带一提，连 `isatty()` 在 Linux 上也是用 ioctl 实现的，所以对非标准操作要格外小心。

## FreeBSD 的 Capsicum

Capsicum 自 FreeBSD 9.0 起成为系统的一部分，目标就是让文件描述符能更好地充当能力。它提供一个函数 `cap_enter`：<strong>一次调用彻底关闭环境授权</strong>。

```lua
local new_actor3 = spawn_vm{
    module = 'module3',
    subprocess = {
        init = 'C.cap_enter()'
    } }
```

此后所有系统访问都必须经由已打开的描述符完成；如果某个资源还没有描述符，唯一的获取途径就是 `inbox`。`open` 会失败，socket 连接会失败——因为指向资源的「名字」本身已经不可用。这就是 Capsicum 的精妙之处：不是逐条拒绝操作，而是让名字失去意义。

Capsicum 还提供更细粒度的权限控制：描述符创建时通常带全部权限，之后用 `cap_rights_limit` 收窄。例如可以允许一个进程在信号量上等待、但不允许它 post。下面这段 Lua 让 20 个 worker 各自拿到同一个发送端，但都无权 shutdown-send，因此单个 worker 无法把整条通道关掉：

```lua
local unix = require 'unix'
local in_, out = unix.seqpacket.socket.pair()
out:shutdown('receive')
out = out:release()            -- 取出文件描述符
out:cap_rights_limit({'send'}) -- 禁止 shutdown-send

for i = 1, 20 do
    local worker = spawn_vm{
        module = 'worker',
        subprocess = { init = 'C.cap_enter()' } }
    worker:send(out)
end
out:close()
```

在 capability mode 下 `open()` 不再工作，但 `openat()` 可以，而且相对路径只会解析到给定目录描述符之下的层级。

Capsicum 论文发布时附了一张 Chromium 各平台沙箱机制的实现代价对比表：

| 操作系统 | 模型 | 代码行数 | 说明 |
| --- | --- | --- | --- |
| Windows | ACL | 22,350 | Windows ACL 与 SID |
| Linux | `chroot` | 605 | setuid root 辅助程序沙箱化渲染进程 |
| macOS | Seatbelt | 560 | 基于路径的强制访问控制 |
| Linux | SELinux | 200 | 受限沙箱类型的安全域 |
| Linux | `seccomp` | 11,301 | seccomp 加用户态系统调用包装 |
| FreeBSD | Capsicum | 100 | 用 `cap_enter` 做沙箱 |

![Chromium 各沙箱机制所需的代码行数对比：Windows ACL 22,350 行、Linux seccomp 11,301 行，而 Capsicum 只需 100 行](/images/software-sandboxing-basics/chromium-effort.svg)

其他机制并没有实质性地限制沙箱能力，可以忽略。作者的判断很直白：如果一生只研究一种沙箱机制，那就研究 Capsicum——到本文写作时他还没见过比它更好的。Capsicum 也是这篇文章余下部分所有沙箱设计的灵感来源，不分操作系统。

## 收到描述符之后：UNIX 上的非阻塞 IO

从沙箱收到描述符只是开始，真正操作它时如果粗心，线程就会阻塞，从而被人做成拒绝服务。UNIX 上非阻塞 IO 的混乱由来已久，几个要点：

- 按 POSIX，`close()` 可能阻塞；Linux 上它据称总是成功，不必检查错误。若「关闭缓慢」的文件是问题，可能要专门开线程来跑 `close()`。
- 用 `fstat` 判断收到的描述符是不是 socket；是 socket 就在 `recv()` 上用 `MSG_DONTWAIT`。
- 非 socket 的情况应改用 proactor（完成事件而非就绪事件），例如 Linux 的 io_uring、FreeBSD 的 POSIX AIO。
- io_uring 目前被广泛不信任并被禁用，所以 Linux 上如果描述符来自沙箱进程，干脆拒绝非 socket IO 更省事。
- FreeBSD 上可以用带 `AIO_OP2_FOFFSET` 的 `aio_read2()` 做无偏移读取，其他做法会因 `ENOTCAPABLE` 失败。

这里其实有两个用例：受信进程创建资源并发给不可信的沙箱进程；以及沙箱进程创建资源发给别处。前者可选余地更大，但像 `O_NONBLOCK` 这样的状态在所有描述符副本间共享，一旦描述符到了第一个沙箱进程手里就会变成问题。Capsicum 下可以禁止 `F_SETFL` 来稍微缓解，但这只对 FreeBSD 有效。

## 给既有代码加沙箱（oblivious sandboxing）

现实工程的第一步是承认：<strong>不要重写全部代码</strong>。Capsicum 社区把「让未修改的代码跑在沙箱里」称为 oblivious sandboxing。这类技术通常和自主降权无关，无法解决前面提到的问题，但两者可以在同一个项目里结合使用。

切入点很明确——环境授权函数。Super Capsicumizer 9000 等项目的做法是用 `LD_PRELOAD` 注入动态库，拦截这些调用；这套技术并不新鲜，fakeroot 已经用了几十年。它的可行性来自一个事实：程序员几乎不直接做系统调用，而是通过 libc。你只要为想拦截的 libc 函数写一份定义：动态链接时你的符号先被加载；静态链接时 libc 的符号通常是弱符号，会被你的定义覆盖。Emilua 用这个办法同时支持 Linux 与 FreeBSD 上的动态和静态可执行文件，唯一缺了弱符号属性的是 `getaddrinfo`（相关 bug 报告已提交给 glibc 与 FreeBSD）。

选哪些函数拦截？FreeBSD 的 libcasper 是好的起点，但它并不直接拦截自己要替换的函数，需要改名字和参数；另一个灵感来源是 Super Capsicumizer 9000 用的 libpreopen。Adam Langley 也说过，Chromium 的渲染进程需要的权限极少——只要能通过 fontconfig 找到并打开字体文件。

Emilua 0.11 用 `libc_service` 模块把这套流程抽象出来。下面这个例子覆盖 `open`，让子进程以为自己读到了 `/dev/null`，实际拿到的是一个伪造的描述符（真实的降权配置被省略）：

```lua
local libc_service = require 'libc_service'
local master, slave = libc_service.new()

slave.open = [[
local real_open, path, flag, mode = ...
local res, errno, fd = real_open(path, flag, mode)
if fd then
    return fd
else
    return res, errno
end
]]

spawn_vm{
    module = fs.path.new('/a.lua'),
    subprocess = {
        source_tree_cache = source_tree_cache,
        libc_service = slave,
        stdout = 'share',
        stderr = 'share',
    }
}
```

因为底层用 UNIX socket 通信，这套机制可以承载完全动态的安全策略。举个例子：用 Telegram 的 tdlib 自己写客户端时，策略可以规定「只把名字查询解析到 `pluto.web.telegram.org`」「只允许连接前几步里解析出的 IP 地址」。被发到沙箱一侧的小 Lua 脚本还能做调用点修补：当沙箱代码试图连接 `/tmp/.X11-unix/X0` 时，把一个指向无关 display server（比如 Xephyr）的新描述符用 `dup2` 顶替回原请求的 socket——文中给出了完整可行的示例，也顺带演示了如何对 xterm 这类既有程序做 `LD_PRELOAD` 拦截。

在 Linux 上还能拦截 `openat` 并强制附加 `resolve_beneath`，从而模拟 Capsicum 的路径解析语义（当然别忘了把真正的系统调用也禁掉）。安全策略还可以用 `kcmp` 进一步细分，为不同的描述符实现不同的子策略。

## 沙箱化原生插件

沙箱威胁模型里有个常见主题：<strong>初始可信的代码在被攻陷后就变成恶意的</strong>。我们相信 ffmpeg 开发者没有后门，但项目足够复杂，总有等着被发现的合法 bug，这时可以在把它当库导入、并在真正解析外部数据之前才架设沙箱。

但如果假设代码从一开始就被攻陷呢？以 tdlib 为例：在这种模型下，光是加载这个动态库就是危险操作。做法是先在安全环境（FreeBSD 的 jail、Linux 的 namespace）里构建插件，再面对下一个问题：关闭环境授权后 `dlopen()` 无法访问文件系统。变通办法是<strong>按文件描述符加载</strong>——FreeBSD 有 `fdlopen`；Linux 可以传 `/proc/self/fd/` 下的路径，但必须保证描述符永不关闭，否则路径可能被别的插件复用（glibc 按路径去重插件）。

插件真正麻烦的地方是它可能依赖尚未加载的动态库。Linux 上可以直接用 Landlock（`/proc/self/fd/` 那个技巧本来也需要它）；FreeBSD 上可以用 `rtld_set_var` 加 `LIBRARY_PATH_FDS`。Emilua 则提供 `native_modules_cache` 预填插件缓存：

```lua
spawn_vm{
    module = 'some_module',
    subprocess = {
        native_modules_cache = { 'some_plugin' },
        ld_library_directories = library_path_fds,
    } }
```

不过这里有个更值得思考的问题：如果我们不信任 tdlib，为什么还要把数据交给它？对 tdlib 来说，答案还算清楚——我们并没有给 Telegram 开发者他们原本没有的东西（数据本来就在 Telegram 服务器上），跑在插件里只是阻止它不受限制地访问本机数据。作者真正想强调的是下一课：<strong>先评估你的威胁模型是否讲得通</strong>。Linux 内核可以用一个有已知漏洞、无人维护的库来解压 initramfs，这完全没问题——因为只用它处理可信用户生成的数据；反过来，如果这个库被植入后门，故事就完全不同了。有时候「可审计的可信代码」比「纸面质量更高但来源可疑的代码」更重要。

## 用 seccomp 降权

作者把这一节留到最后，因为 seccomp 实在不好用：它是很好的<strong>操作系统加固</strong>机制，却不是好的自主降权机制。它的原理很简单——用 BPF 程序为每个系统调用选择一个动作：

- `SECCOMP_RET_KILL_PROCESS`、`SECCOMP_RET_KILL_THREAD`
- `SECCOMP_RET_TRAP`、`SECCOMP_RET_ERRNO`
- `SECCOMP_RET_USER_NOTIF`、`SECCOMP_RET_TRACE`
- `SECCOMP_RET_LOG`、`SECCOMP_RET_ALLOW`

用它拒绝那些按名字操作的系统调用（`open`、`bind`），就能关掉环境授权，之后可以套用前面所有关于隔间化开发的结论。策略可以写成白名单或黑名单，但黑名单的问题众所周知：新内核会加新系统调用，你今天不知道明天会不会出现一条打破当前策略的调用。

seccomp 的黑名单还要更糟：Linux 支持多架构，系统调用号在不同架构间差别极大。即使在 x86-64 程序里禁掉了 `acct`，被攻陷的沙箱也可以跑一个 x86 可执行文件绕过过滤。而 seccomp 的文档还补了一刀：

> `arch` 字段对所有调用约定并不唯一。x86-64 ABI 与 x32 ABI 都用 `AUDIT_ARCH_X86_64` 作为 arch，且跑在同一批处理器上。二者靠系统调用号上的 `__X32_SYSCALL_BIT` 掩码区分。这意味着策略要么拒绝所有带 `X32_SYSCALL_BIT` 的调用，要么必须同时识别带与不带的调用；一份只按 `nr` 列出待拒绝调用、却不包含带 `X32_SYSCALL_BIT` 的 `nr` 值的策略，会被设置该位的恶意程序绕过。

改用白名单也逃不掉这些实现细节，而且系统调用的参数顺序在不同架构间还会变——这正是 Docker 要为 `clone` 写多条规则的原因。理论上可以做一个库，只用一个函数关掉环境授权，然后所有人复用它，但目前没有客户对这个方向感兴趣。

还有个必须记住的坑：Linux 用户态过度依赖文件系统。即使为了兼容旧代码拦截了 `open`，嵌套沙箱下旧代码访问 `/proc/self` 仍会失败；不如放行 `open`，改用 Landlock 过滤文件系统访问。代价是——如果进程能用另一种 `mode` 重新打开 `/proc/self/fd/`，文件描述符就不再能建模为能力。Landlock 开发者有暴露 Capsicum 式能力的长期目标，或许未来能解决。结论是：<strong>在 Linux 上，Seccomp 加 Landlock 就是你能拿到的全部</strong>。

![seccomp 的八种动作与四个陷阱，以及 Landlock 补位后「描述符即能力」出现的裂痕](/images/software-sandboxing-basics/linux-stack.svg)

## 用 Kafel 简化 seccomp

Kafel 是作者在寻找可复用的 seccomp 策略时见过最有希望的项目：它以语言加库的形式描述系统调用过滤策略，再编译成可交给 seccomp-filter 的 BPF。

作者据此整理出一组按用途拆分的策略（POLICY 块），思路借鉴 Docker 默认配置、systemd 的过滤集和 OpenBSD 的 pledge 承诺，但做了两处调整：避开本就需要 root 的调用（这些策略面向非特权用户，多放行只会让 BPF 程序更大、开销更高）；避开可被用于额外指纹识别的冷门调用（如 `mincore`、`cachestat`）。分组大致包括：

```text
Aio / BasicIo / Clock / Credentials / CRuntime / FileDescriptors / FileIo /
Filesystem / IoEvent / Ipc / Memlock / NetworkIo / NetworkServer /
NetworkSocketTcp / NetworkSocketUdp / NetworkSocketUnix / Process /
Resources / Sandbox / Signal / Sync / Timer / Debug / Pkey …
```

有几条值得单独说：

- 系统调用 `ioctl()` 被塞进 `BasicIo` 组。它本质是「伪装成系统调用的系统调用」，设备驱动能用它做任何事，但任何做文件、socket 或 TTY IO 的程序迟早会撞上 glibc 对 ioctl 的使用，所以干脆放进基础组。
- `Process` 组（`clone`、`clone3`、`execve`、`fork`、`prctl`、`wait4` 等）在沙箱化<strong>别的</strong>二进制时几乎必然需要。只有在沙箱化自己（在危险操作前协作式地进一步降权）时，才可能真的把它整个排除掉。作者感慨，Linux 没为 seccomp 或 cgroup 提供这种「exec 时切换」的机制，而 SELinux 那边早就知道这个机制对正确降权有多重要。
- `Sandbox` 组只放 `landlock_add_rule`、`landlock_create_ruleset`、`landlock_restrict_self`、`seccomp` 四条——即分阶段收紧策略所需的调用。

作者用了这套策略近一年。他也直言 Kafel 的短板：系统调用数据库贫弱（例如完全没有 `clock_gettime64`），做多架构支持也差，因此在改进之前不会被 Docker 之类的项目采用；他本希望能看到策略版本化和更好的策略组合算子，但没有客户感兴趣，时间就投到了别处。

## 核心总结

- **定义**：沙箱 = 程序化、无需管理权限、自主地降低进程特权；它不取代系统管理策略，而是与之互补。
- **边界**：主流操作系统的权限边界在进程，不在线程；线程级方案在工程上不可行。
- **模型**：actor 模型负责隔间化与消息传递，能力安全负责资源授权；用通道替代可伪造的地址，缺口就补上了。
- **能力**：UNIX 只在创建描述符时做权限检查，因此文件描述符天然可当能力用——但 ioctl 是永远的危险例外。
- **Capsicum**：`cap_enter` 一次调用关闭环境授权，让「名字」本身失效；Chromium 上只需 100 行，而 seccomp 要 11,301 行、Windows ACL 要 22,350 行。
- **legacy 代码**：用 `LD_PRELOAD` 拦截少量环境授权函数（oblivious sandboxing）远比重写便宜。
- **Linux 现状**：user namespace 放大了内核攻击面，不当通用沙箱；seccomp 的白/黑名单各有陷阱（多架构、x32 位、参数顺序），最终是 Seccomp 加 Landlock 的组合。
- **方法论**：动手之前先问一句——这个威胁模型讲得通吗？

原文：[Software sandboxing: The basics](https://blog.emilua.org/2025/01/12/software-sandboxing-basics/)（Emilua Blog，Vinícius dos Santos Oliveira，2025-01-12）

参考：[Capsicum: practical capabilities for UNIX](https://www.cl.cam.ac.uk/research/security/capsicum/papers/2010usenix-security-capsicum-website.pdf)（USENIX Security 2010）；[Kafel 项目主页](https://google.github.io/kafel/)；[Emilua 项目](https://emilua.org/)
