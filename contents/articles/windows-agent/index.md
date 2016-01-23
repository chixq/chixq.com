---
title: "Windows Agent 的经验和坑"
author: Kris
date: 2016-01-18
template: article.jade
---

### Agent 原理
Agent 就是安装在被管理机器中的代理服务，负责同步被管理主机的信息，上报监控信息，下发操作指令，这是现在云主机管理，监控中非常通用和普遍的手段。<span class="more"></span>

鉴于 Agent 会直接部署于 OS 内，我眼中 Agent 必须具备如下特性：

* 自控
* 低开销／高并发
* 环境隔离

**自控**：其实这里是在讲安全，不过如果光讲安全，太空洞无凭了，即使 Agent 代码开源，也不能说自己安全。自控，即自我控制的能力，包括Agent 可以停止，更新，重启以及卸载， Agent 的操作可控可追溯等，只有这样，才能说 Agent 安全可控。

**低开销／高并发**：这点非常好理解，现在云主机管理，动辄成百上千台（5 台以内 Agent 也无法发挥最大功效），监控告警，日志查询等操作相应的也是成百上千倍的指令，如果 Agent 无法做到消耗很小的 OS 资源实现高并发，那么不仅对 OS 上真实的业务系统影响很大，更甚者会导致整个 Agent 崩溃出现一些意外的连锁错误。

**环境隔离**：我们知道，OS 中的真实业务系统会依赖一些环境组建（JVM，Python 等）和中间件服务（MySQL 等），Agent 应该完全和 OS 中的环境隔离，不影响、不依赖系统本来的环境配置也不被影响和依赖。只有这样，Agent 才能稳定地运行，否则，例如系统 Python 环境升级或者重新配置，可能导致 Agent 出错退出或者误操作。

综上，我们考虑几个 Agent 可能会用到的技术选型，比如利用消息中间件、epoll 承载低开销／高并发， 比如利用 Docker／Vagrant 将 Agent 依赖的环境配置打包，比如开一个线程／进程专门用来维护 Agent 的升级、启动、停止等。


### Windows Agent 实现原理
公司在开发 Windows Agent 之前，已经开发完成了相应的 Linux/AIX Agent, 所以 Windows 上的 Agent 可以重用已有的Agent 核心业务逻辑代码 （Python），仅仅需要针对 Windows 平台做其上的封装。

**注意**： Python 在 Windows 上**没法实现**系统 epoll()，并且 Windows 没有像 Linux 平台上实现进程daemon 和 fork()。所以我们会用 Windows Service ＋ 计划任务来实现 Linux 上的守护进程和后台任务等。

1. Windows 系统默认都没有预安装 Python，所以 Windows Agent 可以将 Python（解释器）打包一起发布。Python 2.7 版本 zip 压缩之后大概 30M，可以接受，也满足 Agent 环境隔离的要求。
2. pywin32 库封装了 win32api，可以实现安装／删除 Service 等。可以将 Python Agent 安装为 Windows Service，类似 Linux Daemon。
3. psutil 是获取系统信息工具非常好用的一个库，跨平台，相对于利用 WMI 来采集系统信息，更加轻量级，也更易读。能很容易的获取系统 cpu，memory，storage，process等等。
4. windows command line （batch 脚本）由于历史原因，涉及内码表（ANSI）等编码问题，在执行 batch 脚本之前可以先执行 @chcp 65001 > NUL 来获得 UTF-8 编码的输出， 65001 是 Windows 上 UTF-8 的 code page no。
5. Windows Powershell 执行脚本有权限控制，一般不会允许执行任意脚本，可以通过 powershell.exe -GetExecutionPolicy 查看，默认是 remote-signed。如果要执行用户自定义脚本，可以先执行设置脚本权限命令：powershell.exe -SetExecutionPolicy unrestricted 即可执行任意脚本了。
6. Windows 2003 内核不是 Unicode 的，需要特殊处理（或者干脆不支持了 T T）。
7. Windows 编码问题，加上 Python2 的自己的编码坑，加起来就是一锅粥，强烈推荐一个开源库 chardet，会自动识别任意 string 的编码格式，并附带识别可信度（confidence），这样只要遇到任何编码的字符串，先转成 unicode，再转成 UTF-8 编码 String 即可。

>遇到的问题：

利用 pywin32 安装 Service 出错情况：
1. 服务注册／启动不了，大多数情况是 Python Agent 工程没有被正确安装，通俗的讲就是 Agent 对于系统“不可见”，可以尝试在 Python CLI 中执行 `import <agent_project_module>` 看能否成功。
2. 服务突然停止。这个可能有很多原因，但是可能有一个比较不容易被发现，就是如果代码中有 print() 方法，service就会出错，因为 service 在运行中没有console stdout，print()方法就会报错，service 退出，解决方法是用logging。
3. service 运行用户最好是 local_system，这是一个系统级的用户，没有密码，拥有最高权限。虽然 Administrator 用户也拥有很高的权限，但是如果涉及到 windows 的域账户登录，又可能会出现一些意想不到的问题。


### Windows Agent 开发中一些代码片段

待完成

### Windows IE 适配的一些经验

待完成


