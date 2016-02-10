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
4. windows command line （batch 脚本）由于历史原因，涉及[内码表](wiki_codepage)（ANSI）等编码问题，在执行 batch 脚本之前可以先执行 @chcp 65001 > NUL 来获得 UTF-8 编码的输出， 65001 是 Windows 上 UTF-8 的 code page no。
5. Windows Powershell 执行脚本有权限控制，一般不会允许执行任意脚本，可以通过 powershell.exe -GetExecutionPolicy 查看，默认是 remote-signed。如果要执行用户自定义脚本，可以先执行设置脚本权限命令：powershell.exe -SetExecutionPolicy unrestricted 即可执行任意脚本了。
6. Windows 2003 内核不是 Unicode 的，需要特殊处理（或者干脆不支持了 T T）。
7. Windows 编码问题，加上 Python2 的自己的编码坑，加起来就是一锅粥，强烈推荐一个开源库 chardet，会自动识别任意 string 的编码格式，并附带识别可信度（confidence），这样只要遇到任何编码的字符串，先转成 unicode，再转成 UTF-8 编码 String 即可。

>遇到的问题：

利用 pywin32 安装 Service 出错情况：
1. 服务通过pywin32注册／启动不了，**但是可以通过debug启动**，大多数情况是 Python Agent 工程没有被正确安装，通俗的讲就是 Agent 对于系统“不可见”，可以尝试在 Python CLI 中执行 `import <agent_module>` 或者 cmd 中执行 `python.exe -m <agent_module>` 看能否成功。
2. 服务突然停止。这个可能有很多原因，但是可能有一个比较不容易被发现，就是如果代码中有 print() 方法，service就会出错，因为 service 在运行中没有console stdout，print()方法就会报错，service 退出，解决方法是用logging 打印输出到日志文件。
3. service 运行用户最好是 local_system，这是一个系统级的用户，没有密码，拥有最高权限。虽然 Administrator 用户也拥有很高的权限，但是如果涉及到 windows 的域账户登录，又可能会出现一些意想不到的问题。


### Windows Agent 开发中一些代码片段
1. pywin32 注册服务。

首先构建 Service
```
# 声明 Service 类继承并实现 win32serviceutil.ServiceFramework 的主要方法
class F2CWinService(win32serviceutil.ServiceFramework):
    _svc_name_ = F2C_WINSERVICE_NAME
    _svc_display_name_ = F2C_WINSERVICE_DISPLAY_NAME
    _svc_description_ = 'Communicates with FIT2CLOUD Event Engine'
    _stopping = None

    def __init__(self, args=None):
        if args != None:
            win32serviceutil.ServiceFramework.__init__(self, args)
        self._logger = logging.getLogger(__name__)
        self._snmp_last_poll_time = time.time()
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self._running = False

        def handler(*args):
            return True

        win32api.SetConsoleCtrlHandler(handler, True)

    def SvcDoRun(self):
        self.ReportServiceStatus(win32service.SERVICE_RUNNING)
        self._running = True
        self._logger.debug("F2CWinService running")
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                              servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, ''))

        # Service 的主要业务逻辑，通过一个while循环保证service后台一直运行，知道 service 出错或者在debug模式中被 ctrl-c 杀掉
        try:
            self.main()
            self._logger.debug("F2CWinService leaving")
            while self._running:
                rc = win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)
                if rc == win32event.WAIT_OBJECT_0:
                    servicemanager.LogInfoMsg("F2CWinService - STOPPED!")  # For Event Log
                    # Service stopped, stop main loop
                    break
        except KeyboardInterrupt:
            self._logger.debug('Mainloop: KeyboardInterrupt')
        except Exception, ex:
            self._logger.error('Mainloop: ERROR occurred! {0}'.format(str(ex)))
        finally:
            self._logger.debug('Mainloop: finally')

        self._logger.debug('Mainloop: leave')

    def SvcStop(self):
        self._logger.debug("F2CWinService stopping")
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        servicemanager.LogInfoMsg("F2CWinservice - STOP PENDING")
        win32event.SetEvent(self.hWaitStop)
        if self._running:
            self._running = False
        else:
            try:
                self._shutdown()
            finally:
                self._stopping = True

    def SvcShutdown(self):
        self._logger.debug("F2CWinService - SHUTDOWN!")
        pass

    def start(self):
        pass

	 ＃ Service 真正的业务逻辑
    def main(self):
        import app
        app.main()

    def _shutdown(self):
        self.SvcShutdown()
```
通过 pywin32 接口注册／启动服务
```
from f2cwinservice import F2CWinService, F2CSNMPService
import win32serviceutil
import sys
import os

sys.argv += ['--startup', 'auto', 'install']

win32serviceutil.HandleCommandLine(F2CWinService)
# sys.argv[-2] = 'manual'
# win32serviceutil.HandleCommandLine(F2CSNMPService)
win32serviceutil.StartService(F2CWinService._svc_name_)
sys.exit()
```

2. agent 收集各项系统监控指标。

```

logger = LoggerFactory.getLogger(__name__)


class CommonMonitor():
    def __init__(self, monitorplanTablePath=None,
                 monitoringPlanLock=None,
                 monitorDBPath=None):
        '''
        Constructor
        '''
        self.monitorplanTablePath = monitorplanTablePath
        self.monitoringPlanLock = monitoringPlanLock
        self.monitorDBPath = monitorDBPath

    def getCPUUsageMonitoring(self):
        cpuMonitorings = None
        try:

            current_cpu_times = psutil.cpu_times_percent(interval=1)
            try:
                user_usage = current_cpu_times.user
            except AttributeError, ex:
                user_usage = None

            try:
                system_usage = current_cpu_times.system
            except AttributeError, ex:
                system_usage = None

            try:
                iowait = current_cpu_times.iowait
            except AttributeError, ex:
                iowait = None

            try:
                idle = current_cpu_times.idle
            except AttributeError, ex:
                idle = None

            overall_usage = user_usage + system_usage
            cpuUsage = MonitoringData(MonitoringKey.CPU_USAGE, overall_usage, MonitoringUnit.PERCENTAGE)
            cpuUserUsage = MonitoringData(MonitoringKey.CPU_USER_USAGE, user_usage, MonitoringUnit.PERCENTAGE)
            cpuSystemUsage = MonitoringData(MonitoringKey.CPU_SYSTEM_USAGE, system_usage, MonitoringUnit.PERCENTAGE)
            cpuIowait = MonitoringData(MonitoringKey.CPU_IOWAIT, iowait, MonitoringUnit.PERCENTAGE)
            cpuIdle = MonitoringData(MonitoringKey.CPU_IDLE, idle, MonitoringUnit.PERCENTAGE)

            cpuMonitorings = CPUMonitorings()
            cpuMonitorings.setCPUUsage(cpuUsage)
            cpuMonitorings.setCPUUserUsage(cpuUserUsage)
            cpuMonitorings.setCPUSystemUsage(cpuSystemUsage)
            cpuMonitorings.setCPUIowait(cpuIowait)
            cpuMonitorings.setCPUIdle(cpuIdle)
        except Exception, ex:
            logger.error(traceback.format_exc())
            raise Exception("Get CPU Monitorings exception.")
        return cpuMonitorings

    def getLoadAverageMonitoring(self):
        laMonitorings = None
        try:

            la_value = len(psutil.pids())
            oneMinLA = MonitoringData(MonitoringKey.PROCESS_NUM, la_value, MonitoringUnit.NA)

            laMonitorings = LoadAverageMonitorings()
            laMonitorings.setOneMinLoadAverage(oneMinLA)
        except Exception, ex:
            logger.error(traceback.format_exc())
        return laMonitorings

    def getMemoryMonitoring(self):
        memoryMonitorings = None
        try:
            memory_usage = psutil.virtual_memory().percent
            memoryUsage = MonitoringData(MonitoringKey.MEMORY_USAGE, str(memory_usage), MonitoringUnit.PERCENTAGE)
            memoryMonitorings = MemoryMonitorings()
            memoryMonitorings.setUsage(memoryUsage)
        except Exception:
            logger.error(traceback.format_exc())
        return memoryMonitorings

    def getDiskMonitoring(self):
        diskMonitorings = None
        try:
            subprocess.call('diskperf -y', stdout=subprocess.PIPE)
        except Exception, ex:
            logger.error('Perform diskperf -y failed')

        try:
            diskMonitorings = DiskMonitorings()
            disk_io_counter = psutil.disk_io_counters(perdisk=False)
            disk_read_cur = disk_io_counter.read_bytes
            disk_write_cur = disk_io_counter.write_bytes

            if os.path.exists(conf.DISK_LAST_READ_PATH):
                f_read_last = open(conf.DISK_LAST_READ_PATH, 'r')
                disk_read = ''.join(f_read_last.readlines())
                f_read_last.close()
                try:
                    float(disk_read)
                except ValueError:
                    logger.debug("Last disk read error: {0}".format(str(disk_read)))
                    disk_read = 0
            else:
                disk_read = disk_read_cur

            if os.path.exists(conf.DISK_LAST_WRITE_PATH):
                f_write_last = open(conf.DISK_LAST_WRITE_PATH, 'r')
                disk_write = ''.join(f_write_last.readlines())
                try:
                    float(disk_write)
                except ValueError:
                    logger.debug("Last disk read error: {0}".format(str(disk_write)))
                    disk_write = 0
            else:
                disk_write = disk_write_cur

            mean_disk_read = abs((8 * (float(disk_read_cur) - float(disk_read))) / float(1024) / float(60))
            mean_disk_write = abs((8 * (float(disk_write_cur) - float(disk_write))) / float(1024) / float(60))

            mean_disk_io = float(mean_disk_read) + float(mean_disk_write)

            disk_io_speed = MonitoringData(MonitoringKey.DISK_IO_UTIL, mean_disk_io, MonitoringUnit.KILOBITPERSECOND)

            diskMonitorings.setUtil(disk_io_speed)

            with open(conf.DISK_LAST_READ_PATH, 'w') as f_read:
                f_read.write(str(disk_read_cur))
                f_read.close()

            with open(conf.DISK_LAST_WRITE_PATH, 'w') as f_write:
                f_write.write(str(disk_write_cur))
                f_write.close()

            disk_usage = []
            for partition in psutil.disk_partitions():
                if partition.fstype:
                    disk_usage.append(psutil.disk_usage(partition.mountpoint).percent)

            disk_fullest_usage = sorted(disk_usage, reverse=True)[0]
            diskFullest = MonitoringData(MonitoringKey.DISK_FULLEST, str(disk_fullest_usage), MonitoringUnit.PERCENTAGE)
            diskMonitorings.setFullest(diskFullest)

        except Exception, ex:
            logger.error(traceback.format_exc())

        return diskMonitorings

    def getNetworkMonitoring(self):
        networkMonitorings = None
        try:
            network_io_counter_cur = psutil.net_io_counters(pernic=False)
            sent_bytes_cur = network_io_counter_cur.bytes_sent
            recv_bytes_cur = network_io_counter_cur.bytes_recv

            if os.path.exists(conf.NETWORK_LAST_RECV_PATH):
                f_recv_last = open(conf.NETWORK_LAST_RECV_PATH, 'r')
                recv_bytes = ''.join(f_recv_last.readlines())
                f_recv_last.close()
                try:
                    float(recv_bytes)
                except ValueError:
                    logger.error("Last network recv error: {0}".format(str(recv_bytes)))
                    recv_bytes = 0
            else:
                recv_bytes = recv_bytes_cur

            if os.path.exists(conf.NETWORK_LAST_SENT_PATH):
                f_sent_last = open(conf.NETWORK_LAST_SENT_PATH, 'r')
                sent_bytes = ''.join(f_sent_last.readlines())
                f_sent_last.close()
                try:
                    float(sent_bytes)
                except ValueError:
                    logger.error("Last network sent error: {0}".format(str(sent_bytes)))
                    sent_bytes = 0
            else:
                sent_bytes = sent_bytes_cur

            input_speed = abs(8 * (float(recv_bytes_cur) - float(recv_bytes)) / float(1024) / float(60))
            output_speed = abs(8 * (float(sent_bytes_cur) - float(sent_bytes)) / float(1024) / float(60))

            networkInMonitoringData = MonitoringData(MonitoringKey.NETWORK_IN, input_speed,
                                                     MonitoringUnit.KILOBITPERSECOND)
            networkOutMonitoringData = MonitoringData(MonitoringKey.NETWORK_OUT, output_speed,
                                                      MonitoringUnit.KILOBITPERSECOND)
            networkIoMonitoringData = MonitoringData(MonitoringKey.NETWORK_IO,
                                                     input_speed + output_speed,
                                                     MonitoringUnit.KILOBITPERSECOND)

            networkMonitorings = NetworkMonitorings()
            networkMonitorings.setInMonitoring(networkInMonitoringData)
            networkMonitorings.setOutMonitoring(networkOutMonitoringData)
            networkMonitorings.setIo(networkIoMonitoringData)

            with open(conf.NETWORK_LAST_RECV_PATH, 'w') as f_recv:
                f_recv.write(str(recv_bytes_cur))
                f_recv.close()

            with open(conf.NETWORK_LAST_SENT_PATH, 'w') as f_sent:
                f_sent.write(str(sent_bytes_cur))
                f_sent.close()

        except Exception, ex:
            logger.error(traceback.format_exc())

        return networkMonitorings

    def getHostMonitoring(self):
        hostMonitorings = None
        try:
            cpuUsageMonitorings = self.getCPUUsageMonitoring()
            loadAverageMonitorings = self.getLoadAverageMonitoring()
            memoryMonitorings = self.getMemoryMonitoring()
            diskMonitorings = self.getDiskMonitoring()
            networkTrafficMonitorings = self.getNetworkMonitoring()

            hostMonitorings = HostMonitorings()
            hostMonitorings.setCPUUsageMonitorings(cpuUsageMonitorings)
            hostMonitorings.setLoadAverageMonitorings(loadAverageMonitorings)
            hostMonitorings.setMemoryMonitorings(memoryMonitorings)
            hostMonitorings.setDiskUsageMonitorings(diskMonitorings)
            hostMonitorings.setNetworkTrafficMonitorings(networkTrafficMonitorings)
            if customizedMonitorings != None:
                hostMonitorings.setCustomizedMonitorings(customizedMonitorings)
        except Exception as ex:
            logger.error(traceback.format_exc())
        return hostMonitorings

if __name__ == '__main__':
    monitor = CommonMonitor()
    monitor.getDiskMonitoring()
```

### Windows IE 适配的一些经验
这里其实是跟 python agent 没有太大关系，主要是 web portal 做适配的时候遇到的问题。不过 web portal 的 IE 适配我是和 windows agent 一起做的，就一起记录下。

PS: agent 连接 server 如果走的是 SSL 加密协议，注意 windows 下对于 CA 证书的检验和 Linux 下略有不同，一个比较保险的做法就是对于 windows 下的SSL连接，忽略证书问题，比如对于 python 代码，可以如下处理：

```
self_signed_context = ssl._create_unverified_context()
url_resp = urllib2.urlopen(url, context=self_signed_context).read()
```

进入正文，IE 浏览器的最新版 IE 11， IE edge 基本已经和 webkit 内核差不多了，只需要打开支持 IE 11，IE edge 基本上也没有太大问题。

**IE11** Bug

但是，IE 11有个大bug（在微软 Dev Center [已经 file 但是仍然没有解决](ie11_bug) ），尤其在 form 提交中，如果 form 中刚好包含 input type="password", IE 11 又开了自动保存表单用户密码，form提交就会出错。（如果发现登录／注册页面在 IE 11 下总是出错，其它版本没问题，大概就是这个问题。）这时候只要将 IE 11 的自动保存表单用户密码关掉就 OK 了。不过这种很不友好，通过各种 dig 和 hack，发现一条捷径，即通过 js 判断 IE11，如果是的话，把所有涉及用户名，密码的<input>标签人为的插入一个<input display=none>，由于加入的标签没有 id／name，这样即不影响 form 提交的参数，还完美的导致 IE 11的自动保存用户名／密码功能失效，也就不会触发 IE11 的 bug，绕过 bug 后 form 提交就没有任何问题。

**IE ajax json**无法解析

由于 IE 对于 api 返回 data type 无法识别 application/json 格式，所以导致 api 调用出错。正确的方法是对 api 返回 data_type 设定为 application/text, 然后 js 再将 text json.Parse()一下即可。

**IE textarea**回车无法正确解析

这个很简单，Linux 回车是 \n, windows 回车是 \r\n, 所以如果刚好 textarea 是 Linux 返回的，确实 IE 中看是没有回车的。

用 jquery 的 val() 方法 set／get 文本就好了， jquery 已经做了好各个浏览器，平台的回车符适配。

[wiki_codepage]:https://zh.wikipedia.org/wiki/%E4%BB%A3%E7%A0%81%E9%A1%B5
[ie11_bug]:https://social.msdn.microsoft.com/Forums/ie/en-US/7d02173f-8f45-4a74-90bf-5dfbd8f9c1de/ie-11-issue-with-two-password-input-fields


