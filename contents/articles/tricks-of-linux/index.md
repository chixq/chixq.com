---
title: "Tricks of Linux"
author: Kris Chi
date: 2014-07-17
template: article.jade
---

对于*nix 系统，大部分的工作都在Terminal中，很多人即使日常频繁使用很多年，也只能用些基本的ls，cd, ps, vim等等命令，殊不知nix系统有着非常多有的Tricks，往往这些Tricks也是你最需要的。而且， 我相信我这里面东西是你在别的地方没见过的。
<span class="more"></span>


![Alt cmd](cmd.png)

Bash Shell
----
* 'Ctrl-R': 查找你以前输入的命令，会自动提示

* 'Ctrl-A': 光标移动到当前输入命令的第一个字符

* 'Ctrl-E'：光标移动到道歉输入命令的最后一个字符

* ‘Ctrl-K’: 删除光标之后的命令,一般配合Ctrl-A

* ‘Ctrl-U’: 删除光标之前的命令,在输错密码时非常好用

* ‘Ctrl-Y’: Y代表yank(copy), 从缓冲区粘贴,当然 Ctrl-U, Ctrl-K删除命令都在缓冲区内

* ‘Ctrl-H’: 等于退格键,想想VIM操作就懂了.

* ‘Ctrl-P’: 上一条命令,等同于方向键↑

* ' ^ ': 如同bash命令sed的作用一样，替换前一条命令最后一个参数。

    > ls docs; ^docs^web

* ' !! ': 两个感叹号，相当于上一条命令, 特别适合Sudo

    > $ chmod a+x ./some_script

    > $ sudo !!

* ' cd - ': 切换到上一个你工作的目录，非常好用


一些有用的组合命令，可以直接添加到.bashrc 或者 .zshrc ( 强烈推荐zsh )

fname 递归查找当前目录下指定文件
```
function fname() { find . -iname "*$@*"; }
```

创建文件夹并且cd进去
```
function mcd() { mkdir $1 && cd $1; }
```

psgrep， 字面意思，ps然后grep
```
function psgrep() { ps axuf | grep -v grep | grep "$@" -i --color=auto; }
```


VIM Tricks
-----
Vim的tricks和各种插件太多了，这里说几个一般很少注意到的。

* :set paste 这样在拷贝到vim里面的代码缩进就不会乱了
* ~. 这两个键可以让你定位到你上次编辑的地方


Tools
-----
诚然Linux已经提供了很多牛逼的工具，但是仍有不顺手不如意的地方，这里就有一些第三方工具。
* zsh/ oh-my-zsh:  替代bash，其中最好用的是git插件，开发必备。注意linux中 terminal emulator和bash的区别，refer to [Oh_My_Zsh]
* iPython: 替代python自带的console，iPython包含有Highlights，command autoo completion等好用的属性
* tmux: 管理terminal 和 terminal emulator，尤其在你登录到vps上却发现不能像本地用terminal emulator一样地开几个窗口或者tab处理不同的任务时，tmux save your day。refer to [Smoothy Tmux]
* clipit: 默认快捷键 Ctrl+alt+H, 保存剪贴板历史记录，太好用了
* j.py: 几乎可以替代cd, 还有类似功能的叫z
    > $ j work 会自动切换到你最常使用的 cd /opt/eclipse/workspace
* autoossh: 如果你遇到 ssh 长时间无操作导致session结束卡在终端的时候，你会需要它
* go-mtps: Linux 一键挂载Androi设备

Network
-----

#### 1.SSH Tricks
我现在工作的主要任务时DevOps，机器上几百个key.pem, 经常要用SSH连服务器，从工作以来积累了些SSH Tricks, 对于效率的提升不言而喻。

* '~.'： 在wikipedia里面，这两个键叫Magic keys, 当你ssh连接超时的时候，session已经不能捕获你的Ctrl-C中断，这两个组合键可以帮你结束Halt住的ssh
* ssh config, 相当于配置文件

```
$ vim ~/.ssh/config
    
Host cloudstack-1
    HostName example.com
    Port 2222
    User admin
    IdentityFile  ~/.ssh/id_example
    IdentitiesOnly yes
    
Host openstack-1
    HostName 192.168.33.10
    User anotheruser
    PubkeyAuthentication no
Host aws-1
    HostName some.address.ec2.aws.com
    User awsuser
    IdentityFile  ~/.ssh/aws_identity.pem
    IdentitiesOnly yes    
```

当你想快速登录时，只需要 ssh cloudstack-1

* 直接执行命令： 有时候我们登录vps只想查看下进程起来没，不需要登录

```
    ssh -i key.pem root@somehost.com psgrep httpd
```

* 取消未知主机登录的提示： 云时代用VM，经常terminate掉再起来，IP(hostname)不一样，ssh总要提示是否需要add to known host, 无用。

```
$ vim ~/.ssh/config 
     UserKnownHostsFile /dev/null
     StrictHostKeyChecking no
```

* 加速ssh session建立: 添加以下配置，可以让多个ssh复用已经建立的ssh session连接，不用重新再建立session

```
Host *  # 表示应用于所有Host
ControlMaster auto  # 默认开启
ControlPath ~/.ssh/sockets/%r@%h-%p 
# socket存放地址，请确保~/.ssh/sockets文件夹存在，这个配置可以保证如果ssh remote server的hostname变更，可以建立新的session
# %r remote_user
# %h hostname
# %p server port
ControlPersist 600  # session 保留时间，秒， 即使你退出ssh，下次连接还是飞速
```

* 替换复杂的加密算法，提高速度

```
$ vim ~/.ssh/config
Host dev # 一台你不关心安全性的机器
    Ciphers arcfour # 采用最简单的加密算法
```

* 采用443端口访问： 很多公司都会禁止22端口，这时候你就需要在你的VPS上开启443端口

```
$ vim /etc/ssh/sshd_config  #注意是服务器上的文件
   Port 443
```

登录的时候记着

```
ssh -i key.pem -p 443 root@server.com
```

#### 2.*its Censorship

[Oh_My_zsh]: http://chixq.com/oh-my-zsh
[Smoothy Tmux]: http://chixq.com/smoothy-tmux
