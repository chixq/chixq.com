---
title: AWS CentOS/RHEL root 盘扩容
author: Kris
date: 2016-03-21
template: article.jade
tags: 原创, AWS, centos, rhel
---

 AWS 没有 official 的提供 CentOS 6.5 的 AMI，我选择了一个 AWS 社区镜像推荐的一个 CentOS6.5 （ami-13c30a7e）（AWS 一般会按顺序，将最新最稳定的 AMI 靠前排列），但是当我
 无论 root 盘选择多少，最后启动的时候，会发现 ／ 分区总是 8G, AWS 文档推荐你停机 -> detach 磁盘 -> 新启动一个 instance 再attach 第一步的磁盘 -> 调整大小后再启动原来的instance，选择 root 挂载点。
 这一套非常麻烦，还要多启动一台 instance，后来发现一个工具 resize2fs，可以支持 online 扩容，不用 stop 机器，也不用多启动其他机器。

**update**: 今天去一个客户现场同样发现了这个问题，不过是 RHEL 6.8 的一个 AMI，启动之后只有一个 6G 的/ ,并且磁盘是 GPT 分区的， fdisk 不能使用（会提示：WARNING: GPT (GUID Partition Table) detected on ‘/dev/xvda’! The util fdisk doesn’t support GPT. Use GNU Parted.）
经过一圈dig，发现一个非常好用的工具， `growpart`, 可以支持 online 扩容，只需要执行：

```
growpart /dev/xvda 1
```

其中 /dev/xvda 是你的设备名称，1 是 6G 那个分区号（lsblk 可以查看），然后重启就会发现， root 盘已经扩容完成，非常方便。

首先，看下当前系统挂载情况。

```
[root@ip-172-31-14-205 ~]# df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/xvda1      7.9G  802M  6.7G  11% /
tmpfs           498M     0  498M   0% /dev/shm
[root@ip-172-31-14-205 ~]# lsblk
NAME    MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
xvda    202:0    0  100G  0 disk
└─xvda1 202:1    0    8G  0 part /
```

可以看到 100G 的磁盘，只用了 8G，直接 resize2fs /dev/xvda1, 来扩充磁盘。

```
[root@ip-172-31-14-205 ~]# resize2fs /dev/xvda1
resize2fs 1.41.12 (17-May-2010)
The filesystem is already 2096896 blocks long.  Nothing to do!

[root@ip-172-31-14-205 ~]#
```

不出意外，会失败，是由于 root盘已经被写死了大小 ，我们需要配置下磁盘的cylinder。利用 fdisk 命令修改磁盘相应配置。

```
NOTE: 这里是参数是设备名称 /dev/xvda
[root@ip-172-31-14-205 ~]# fdisk /dev/xvda

WARNING: DOS-compatible mode is deprecated. It’s strongly recommended to
         switch off the mode (command ‘c’) and change display units to
         sectors (command ‘u’).

Command (m for help): p
```

以下按照提示，分别顺次输入以下命令：
1. 输入 P 显示该磁盘分区情况

2. 输入 D 删除当前分区(如果有多个挂载点，可能需要删除多次) Note: 只是删除各个挂载点，数据不会删掉

3. 输入 N 创建一个新的分区

4. 输入 P 和 1 设置新分区为主分区

5. 输入 1 设置新分区起始柱 (**这个地方一定不能选 1，要输入 2048，需要预留一些空间写分区表，启动信息等, 小于 2048 会导致错误，机器启动不了**)

6. 输入结束位置（回车可以直接分配所有空间）

7. 输入 A 和 1 设置当前分区为启动盘

8. 输入 W 写入新配置的分区表

之后，按照提示，reboot 虚机，等待重启完毕了，再执行最初的`resize2fs`命令即可扩充 root盘了

```
resize2fs /dev/xvda1
```

查看当前root盘大小。

```
[root@ip-172-31-14-205 ~]# df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/xvda1      100G  802M  98G  1% /
tmpfs           498M     0  498M   0% /dev/shm
[root@ip-172-31-14-205 ~]# lsblk
NAME    MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
xvda    202:0    0  100G  0 disk
└─xvda1 202:1    0  100G  0 part /

```

