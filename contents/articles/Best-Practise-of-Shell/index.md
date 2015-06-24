---
title: "Best Practise of Shell"
author: Kris
date: 2015-06-13
template: article.jade
---

Shell 脚本，Make构建工具是 Linux/Unix 中使用率最高，也是最能提高工作效率，体现 Linux/Unix 
优势的两个方面，最近一直在和 Shell 打交道，看了一些文章资料，总结了一下 Shell 脚本编写的最佳
实践, 记录一些 Shell Tips 。<span class="more"></span>

### Magic $

Shell脚本中的变量只能包含数字、字母、下划线，尤其不能包含美元符号$，是因为 $ 符号在Shell脚本
中有着非常重要的特殊含义。

1. $<数字>: $1 $2 ... $n 等，代表向脚本传递的参数，例如 test.sh param1 param2, 在 test.sh 中
就可以使用 $1 $2 分别指代第一个参数 param1, 第二个参数 $2。当然，$0 就代表当前脚本名。

2. $$: 当前脚本的pid，一般用来处理多个脚本实例问题。

3. "$*" 和 "$@" :　这两种表达都指代所有向脚本传递的参数，只是在脚本中如果加了双引号，”$@” 会
将所有参数分开输出“$1”, “$2” ... “$n” ，方便For-loop，而 ”$*” 将所有参数作为一个整体输出 “$1
$2 ... $n”

4. $?: 代表上一个脚本的exit code. 0 代表正常退出， 非0 代表非正常退出。
如果任务被一个信号杀掉, 返回值为 128 加上信号的值. 例如: 标准kill信号值是 15, 那么返回值就是 143。

5. $#: 代表向脚本传递的参数个数

### set/shopt 开关

Shell 脚本中经常能看到在开始设定 set -o, set -x 等，这是 Linux 系统脚本处理过程中的一些开关（
常用的包括禁止EOF，即Ctrl+D 退出shell脚本，禁止重定向文件被重写, 变量未定义则退出等，详细的开关设置[查看这里](http://baidu.com)），set -o
表示查看当前开关状态，也可以后接开关名称使用，set -o <开关选项>，用　set +o <开关选项> 关闭开关。

当然，也可直接用　set -x , set -u 等快捷方式直接操作系统开关。

shopt 和　set 是一个意思，只是有些不同版本的shell推荐使用shopt。

1. set -x 或 set -o xtrace: 打开所有debug/echo 信息，这点在脚本调试时非常好用。

```
#!/bin/bash
echo "Hello $USER,"
set -x
echo "Today is $(date %Y-%m-%d)"
set +x
```
返回：

```
Hello chenhao,
++example_script.sh:4:: date +%Y-%m-%d
+example_script.sh:4:: echo 'Today is 2009-08-31'
Today is 2009-08-31
+example_script.sh:5:: set +x
```

2. set -u 或 set-o nounset : 如果变量未设置，则程序直接退出，这在某些危险操作时十分关键。

```
#!/bin/bash
set -u
chroot=$1
...
rm -rf $chroot/usr/share/doc
...
```

如果上述操作没有开启　set -u , 刚好又忘了传递参数给 chroot，则脚本执行时会删掉整个　/usr/share/doc　目录，
如果开启了　set -u ，脚本在发现　chroot 变量没有设置时会自动退出。

3. set -e 或　set -o errexit: 开启脚本中任何一条语句返回non-true则退出，这样可以防止错误扩大，导致不可设想
的后果。

当然，如果在全局开启的情况下，某些你根本不在乎错对的语句，你可以使用　set +e 关闭。

```
set +e
command1
command2
set -e
```

4. set -o noclobber: 不允许重定向文件覆盖，即下面的操作会返回错误。

```
set -o noclobber
touch $exist_file
echo “some text” > $exist_file
```

### 学会使用陷阱，traps

在我刚开始工作的时候，看老外写的shell脚本，到处都是traps, 国内的脚本几乎不用这个非常实用的工具。简单来说，
traps就是通过捕获一些系统信号，实现一些动作。例如收到程序Kill信号(kill -9)，清理脚本产生的文件。

系统信号有很多，`kill -l` 可以列出所有支持的信号类型。一般来说，我们只关心几个常用信号，例如：

1. INT (value: 2): 系统中断信号，ctrl-c触发的。

2. TERM (value: 15): 系统终止信号，往往是通过　kill -15 <PID> 触发的。

3. KILL (value: 9): 进程被杀信号，通过　kill -9 <PID> 触发。

4. EXIT: 程序结束信号，这个分几种情况，要么是脚本走到最后一行正常退出，要么在set +e 情况下出错退出，都会触发EXIT信号。

举一个简单的例子，如果脚本在执行过程中，需要利用 Linux　的文件锁　flock, 例如：

```
if [ ! -e $lockfile ]; then
   touch $lockfile
   critical-section
   rm $lockfile
else
   echo "critical-section is already running"
fi
```

如果上述脚本在critical-section中途退出，无论是人为的ctrl-c或者其他程序杀掉它。$lockfile 就会保持锁定状态（或者已创建），则下次脚本再
执行时，会永远不能执行critical-section。这时候，就需要traps来捕捉一系列信号：

*注意traps需要包裹起来已确定捕捉范围*

```
if [ ! -e $lockfile ]; then
   trap "rm -f $lockfile; exit" INT TERM EXIT
   touch $lockfile
   critical-section
   rm $lockfile
   trap - INT TERM EXIT
else
   echo "critical-section is already running"
fi
```

这样，无论程序如何退出或被杀掉，$lockfile总是会被释放，逻辑正确。

同样的，下面的例子展示了如何可靠的添加一个用户。

```
rollback() {
   del_from_passwd $user
   if [ -e /home/$user ]; then
      rm -rf /home/$user
   fi
   exit
}

trap rollback INT TERM EXIT
add_to_passwd $user
cp -a /etc/skel /home/$user
chown $user /home/$user -R
trap - INT TERM EXIT
```

### 始终使用引号操作文件名和目录

很容易理解，如果路径或者文件名的变量中包含空格，则会导致错误。

```
if [ $filename = "foo" ];
```
如果$filename出现空格，脚本会出错，但是如果加上引号，则不会。

```
if [ "$filename" = "foo" ];
```

记得上面提到的$@, 如果加了引号，则可以用For-loop来处理所有传入参数。

```
foo() { for i in "$@"; do printf "%s\n" "$i"; done }
```

### 判断是否存在某个命令

这里非常tricky, 很多人会直接使用 which 或者更粗暴的查找/usr/local/bin这类目录，但是往往
可能会出现连which命令，/usr/local/bin/目录都不存在的情况，这时候，只能使用shell中非常底层
的命令来判断，例如：

** type **
```
type $1 >/dev/null 2>&1 || { echo >&2 "command $1 not found"; exit 1; }
```

** hash **
```
hash $1 2>/dev/null || { echo >&2 "command $1 not found"; exit 1; }
```

这在Docker中有很大用处，往往Docker Image 为了压缩空间，会去除which, find这类第三方工具，
用上面的脚本，可以很容易的判断命令存在与否。

### 保持原子性

意思就是，尽量使脚本语句为一个原子操作，出错整条语句退出，而不会继续“滚雪球”。
这里要提醒的是，`command1 && command2`代表command1 执行成功时才执行command2, 而
`command1 ; command2`，代表无论command1执行成功与否，都执行command2。


总的来说，shell脚本编写格式要求非常严格（试想下if, while语句），并且缺乏好用的编辑调试
工具（一般来说一个趁手的Vim + set -x 就足够基本调试），但是Shell脚本的Linux平台通用性和高效率，以及
丰富的第三方工具（Sed, xargs）都让Shell脚本编写在很长时间内都是熟练掌握Linux的标志。


这里放几个wiki和资料，会随时更新：

[Fixing Unix/Linux/POSIX Filenames:Control Characters (such as Newline), Leading Dashes, and Other Problems](http://www.dwheeler.com/essays/fixing-unix-linux-filenames.html)

[Sending signal to Processes](http://bash.cyberciti.biz/guide/Sending_signal_to_Processes)

[Setting shell options](http://bash.cyberciti.biz/guide/Setting_shell_options)

