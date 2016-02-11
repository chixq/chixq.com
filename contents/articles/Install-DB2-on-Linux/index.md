---
title: Linux(CentOS) 上安装／配置 DB2
author: Kris
date: 2016-02-11
template: article.jade
tags: 原创
---


如果你做金融行业的软件开发，你肯定对 DB2 很熟悉。DB2 是 IBM 推出的数据库服务系统，最早是 IBM 小型机（AIX）上独占的数据库，后来 IBM 自己也意识到小型机日趋式微，DB2 也慢慢开始兼容全平台，可以在 AIX、Linux、Windows 上运行。我前段时间在研究 DB2 的性能指标，但是苦于网上除了 IBM 官方几个晦涩的文档，几乎没有在 Linux（CentOS，其它 Ubuntu， Federa 基本大同小异） 上部署 DB2 的教程，自己在网上 dig、傻傻地试了挺久，终于搞定，记录下来，以飨后来者。<span class="more"></span>

### 1. 安装
#### 1.1 下载二进制包
IBM 官网上现在只能通过下载器下载，并且还必须登录注册 IBM Developer 账号，下载也慢到几乎下不动。我用的到是 9.7 版本，所以如果大家想**最保守**地走完这篇教程的话，直接 google 搜索 `db2exc_970_LNX_x86_64.tar.gz` 就好，前几名就有百度网盘地址。
##### 1.2 解压安装
下载好的压缩包上传到 Linux 服务器
```
# tar xvf db2exc_970_LNX_x86_64.tar.gz
# cd server
# ./db2_install
Default directory for installation of products - /opt/ibm/db2/V9.7

***********************************************************
Do you want to choose a different directory to install [yes/no] ?
yes
```
一般就 Yes 就好，记得对目录赋权限，接着选择 ESE 版本 （Essential版本）
```
Specify one of the following keywords to install DB2 products.

  ESE
  CONSV
  WSE
  EXP
  PE
  CLIENT
  RTCL

Enter "help" to redisplay product names.

Enter "quit" to exit.

***********************************************************
ese
```
#### 1.3 安装证书
```
# /opt/ibm/db2/V9.7/adm/db2licm -a db2ese.lic
```
#### 1.4 新建 DB2 实例
先给 DB2 创建用户／组，命令是 CentOS，其它版本命令稍有出入
```
# groupadd db2grp1
# groupadd dasadm1
# groupadd db2fgrp1
# useradd -g db2grp1 -G dasadm1 -m db2inst1
# passwd db2inst1
# useradd -g dasadm1 -G db2grp1 -m dasusr1
# passwd dasusr1
# useradd -g db2fgrp1 -m db2fenc1
# passwd db2fenc1
```
接着创建 DB2 Administrator Server （DAS）
```
# cd /opt/ibm/db2/V9.7/instance
# ./dascrt -u dasusr1
SQL4406W  The DB2 Administration Server was started successfully.
DBI1070I  Program dascrt completed successfully.
```
最后创建 DB2 实例
```
# cd /opt/ibm/db2/V9.7/instance
# ./db2icrt -u db2fenc1 db2inst1
DBI1070I  Program db2icrt completed successfully.
```
#### 1.5 (optional) 开启远程客户端 tcp/ip 通信
这一步，我没有做，因为我也没有从远程客户端连过 DB2，都是本地启动本地登录，不知道是不是可以跳过。
```
切换用户
＃ su - db2inst1
＃ db2set DB2COMM=tcpip
db2inst1@localhost:~$ db2 update dbm cfg using SVCENAME 50000
DB20000I  The UPDATE DATABASE MANAGER CONFIGURATION command completed successfully.
db2inst1@localhost:~$ exit
logout
```
#### 1.6 测试启动 DB2
```
# su - db2inst1
db2inst1@localhost:~$ db2start
02/11/2016 20:58:34     0   0   SQL1063N  DB2START processing was successful.
SQL1063N  DB2START processing was successful.
db2inst1@localhost:~$ exit
logout

查看端口监听
＃ netstat -an | grep 50000
tcp        0      0 0.0.0.0:50000           0.0.0.0:*               LISTEN
```
### 2. 创建并测试 DB2 数据库
通过 DB2 默认自带的命令行工具 `db2` 创建 database 和 table
```
# su - db2inst1
db2inst1@localhost:~$ db2
    (c) Copyright IBM Corporation 1993,2007
    Command Line Processor for DB2 Client 9.7.0

    You can issue database manager commands and SQL statements from the command prompt. For example:
        db2 => connect to sample
        db2 => bind sample.bnd

    For general help, type: ?.
    For command help, type: ? command, where command can be
    the first few keywords of a database manager command. For example:
     ? CATALOG DATABASE for help on the CATALOG DATABASE command
     ? CATALOG          for help on all of the CATALOG commands.

    To exit db2 interactive mode, type QUIT at the command prompt. Outside interactive mode, all commands must be prefixed with 'db2'.
    To list the current command option settings, type LIST COMMAND OPTIONS.

    For more detailed help, refer to the Online Reference Manual.

    db2 =>
    db2 => ATTACH TO db2inst1
     Instance Attachment Information
	 	Instance server        = DB2/LINUX 9.7.0
	 	Authorization ID       = DB2INST1
	 	Local instance alias   = DB2INST1
	
	  db2 => CREATE DATABASE TUT_DB USING CODESET UTF-8 TERRITORY US
		DB20000I  The CREATE DATABASE command completed successfully.
	
	  db2 => CONNECT TO TUT_DB
	
	   Database Connection Information
	 	Database server        = DB2/LINUX 9.7.0
	 	SQL authorization ID   = DB2INST1
	 	Local database alias   = TUT_DB
	 db2 => CREATE BUFFERPOOL tut_buffer PAGESIZE 4096
	 DB20000I  The SQL command completed successfully.

	 db2 => CREATE REGULAR TABLESPACE tut_data PAGESIZE 4096 MANAGED BY DATABASE 		USING (file '/db2repo/TUT_TBS' 19200) EXTENTSIZE 16 OVERHEAD 10.5 		PREFETCHSIZE 16 TRANSFERRATE 0.33 BUFFERPOOL tut_buffer DROPPED TABLE 		RECOVERY ON
	 DB20000I  The SQL command completed successfully.
```

创建好测试 database 再创建 table

```
db2 => CREATE TABLE TUTORIAL.CONTACT ( TUTORIAL_ID INT GENERATED ALWAYS AS IDENTITY (START WITH 1, INCREMENT BY 1) NOT NULL PRIMARY KEY, TUTORIAL_NAME VARCHAR(150) NOT NULL, TUTORIAL_EMAIL VARCHAR(150) NOT NULL, TUTORIAL_PHONE VARCHAR(150) NOT NULL) IN tut_data
DB20000I  The SQL command completed successfully.

db2 => quit
DB20000I  The QUIT command completed successfully.
db2inst1@localhost:~$ exit
logout
#
```

通过上述操作，你就可以在客户端中按照如下配置信息连接 Linux 上部署的 DB2 进行测试了。

> Host: <Linux-IPaddress>
> 
> Port: 50000
> 
> db: TUT_DB
> 
> User: db2inst1
> 
> Password: 创建用户时填写的


