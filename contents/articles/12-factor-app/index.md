---
title: 中文翻译：Heroku's 12-Factor-APP
author: chixq
date: 2014-11-09
template: article.jade
tags: 原创, 翻译
---
    
Heroku 一度被追捧为Best PaaS Platform，我没有深究到底这个头衔是否准确，但就最近发现了几篇Heroku Platform的经验，知识总结分享来说，对于我这种刚入DevOps的新人都大有裨益。

PS: 翻译Heroku的另一篇， [HTTP API 设计指南][http-api]

“[**The Twelve-Factor APP**][12factor] ” 是Heroku设计一个符合现代要求的web应用的方法论及相关知识经验的总结。

*****

- [INTRODUCTION](#introduction)
- [BACKGROUND](#background)
- [WHO SHOULD READ THIS DOCUMENT?](#who-should-read-this-document)

- [THE TWELVE FACTORS](#the-twelve-factors)
  - [I. Codebase](#i-codebase)
  - [II. Dependencies](#ii-dependencies)
  - [III. Config](#iii-config)
  - [IV. Backing Services](#iv-backing-services)
  - [V. Build, release, run](#v-build-release-run)
  - [VI. Processes](#vi-processes)
  - [VII. Port binding](#vii-port-binding)
  - [VIII. Concurrency](#viii-concurrency)
  - [IX. Disposability](#ix-disposability)
  - [X. Dev/prod parity](#x-devprod-parity)
  - [XI. Logs](#xi-logs)
  - [XII. Admin processes](#xii-admin-processes)



### INTRODUCTION

当今，软件通常作为服务：即 SaaS，*The twelve-factor app* （12-factor）是创建SaaS的一套方法论：

* 使用标准化的流程控制以减少新员工了解整个工程的时间。
* 各个系统之间尽量隔离，并且对系统的移植能提供最大便捷性。
* 可以适应现在主流的云平台，不受限于服务器和服务器管理。
* 减小生产系统和开发系统的差异，最大程度的通过CD（continuous deployment）来实现敏捷。 
* 不需要特别的改变工具链，架构或者开发流程就能实现服务扩展。
 
12-factor 可以应用于基于各种后端服务（数据库，队列，cache等）的各种语言的App开发。

### BACKGROUND
这篇文章的作者们都直接参与开发/部署成百上千个app，并通过我们Heroku Platform见证了对数以百计的apps的开发，运维和服务扩展。

本篇文章包含了我们对于业界大部分SaaS应用的调查和经验。是对应用开发最佳实践的总结。尤其着眼于应用程序的良性发展，以及开发者的基于代码协作的合作和如何避免[软件自我侵蚀][software-erosion]。

在现代软件开发过程中，我们发现了很多系统性的问题，这也正是我们写这篇文章的初衷，为了引发更多人对此的重视，同时，搭建一个共同的理解基础，在此基础上提供一套解决上述问题的思路。本文的行文源于Martin Fowler's的[《Patterns of Enterprise Application Architecture》][book1]和 [《Refactoring》][refactoring]

### WHO SHOULD READ THIS DOCUMENT?
如果愿意，所有开发软件作为服务的工程师和所有运维这样的软件的工程师都应该通读此文。

******

## THE TWELVE FACTORS

### I. Codebase
> 版本控制，多次部署。

一个12-factor的应用应该始终通过Git，Mercurial或者Subversion这样的版本控制系统跟踪管理。一个跟踪代码所有版本的数据库通常叫做代码仓库，常被写做（code repo, repo）。

代码库可以是唯一仓库（例如集中版本管理的系统Subversion）也可以时很多共享同一个初始上游的仓库（例如分布式版本管理的系统Git）。

一个代码库总是和一个应用一一对应：

* 如果对于分布式系统，有许多代码库，这就不算只有一个应用。分布式系统中的每个组建都算是一个应用，每个应用都应该分别遵守12-factor。
* 许多应用都基于同一个代码库，这违反了12-factor。解决方法是将共享的代码封装成lib，可以通过依赖管理来引入。


![enter image description here](http://12factor.net/images/codebase-deploys.png)
每个应用应该只有一份代码，但是可以有多个部署版本。部署意味着应用的运行时。非常典型的是一个生产环境（production site），一个或者多个
 预发布环境（staging site）。还需注意的是，每个工程师在自己本地运行的应用，也应该算是一次部署。

在所有部署环境中应该运行同一份代码库，只是在每个环境中使用不同的版本。例如，工程师并没有将一些代码提交到预发布环境；预发布环境也有些代码未提交到发布环境。但是它们都共享同一个代码库，只是通过不同的部署版本来区分他们。


### II. Dependencies
> 显式声明和隔离依赖
 大部分语言都会为各个依赖库提供一个包管理功能的系统，例如Perl的[CPAN][cpan]和Ruby的[Rubygems][rubygem]。依赖库可以通过包管理系统安装为系统级的库（称为site package），或者安装到包含应用的指定目录（称为“vendoring” 或者 “bundling”）。

12-factor的应用不应依靠隐式的系统级的库。应该完整地，准确地通过依赖关系声明文件声明所有的依赖库。更进一步，应用应该使用依赖隔离工具来确保没有隐式地引用当前系统级别的库。完整的，显式的依赖声明应该统一地应用于生产环境和开发环境。

例如， [Gem Bundler][gem_bundler]为Ruby程序提供了*Gemfile*声明文件来声明依赖以及*bundle exec*来处理依赖隔离。Python也有两个独立的工具来处理如上的操作-Pip用来声明，Virtualenv用来隔离。甚至C语言都有Autoconf来声明依赖，静态链接可以用来处理依赖隔离。无论是那种工具链，都应该将依赖声明和依赖隔离一起使用，只单独使用其一是不能满足12-factor 应用要求的。

显式的声明依赖，对于刚接手app的工程师来说，简化了环境配置的流程。工程师只需要在检出一份代码库到本地，配置好程序语言的运行时，使用依赖管理工具安装所有预定义的依赖库。他们可以通过一些构建命令来搭建运行应用所需要的所有东西。例如，Ruby/Bundler语言 就是 *bundle install，Clojure/Leiningen语言就是 *Lein deps*。

12-Factor应用不应隐式依靠任何系统的工具。例如调用ImageMagick 或者 curl。即便这些系统工具会在大多数甚至几乎所有系统中预安装，但是不能保证在任意一个我们应用可能会运行的系统都安装了这些工具，或者未来的系统中的工具能适配我们的应用。如果应用必须要调用系统工具，这些工具应该被在应用中被打包程vendoring。


### III. Config

> 配置存于环境

一般只有应用的配置在各个部署环境（staging, production, develop等）各不相同。其中包括： 

* 连接资源的数据库，缓存和其他基础服务。
* 对于外部服务（S3, twitter）的权限配置。
* 类似Hostname这种每个部署环境的默认值。

应用有时会将配置信息作为常量保存在代码中，这违背了12-Factor对于严格区分代码和配置的要求。配置文件在各个部署环境差异很大，但是代码并不是。

最终检测我们应用程序的代码中是否去除了配置信息，是在任意时刻，代码都可以开源，并且不需要任何权限认证。

需要注意的是，这里说的 ”配置“ 并不包含应用内部的应用配置，例如Rails工程的* config/routes.rb* ， 或者Spring工程中描述各个模块如何组合的配置文件。这类的配置在各个部署环境中都不会变，所以应该把他们放在代码中。

另一个管理配置文件的途径是不要将配置文件纳入版本控制系统，例如Rails工程的*config/database.yml* ， 这项对于将配置文件放入代码仓库来说好了很多，但是仍然有缺点：很容易不小心将配置文件纳入版本管理仓库；配置文件会以各种格式散布在不同的地方，导致很难在一个地方检查管理所有的配置文件，更不幸的是，有可能这些配置文件是某些语言或者框架独有的。

12-Factor应用应该在环境变量中存储配置信息（例如env vars或者env）。环境变量在各个部署版本之间很容易改变，而不需要改变代码；不像配置文件，有被纳入版本管理仓库的风险；也不像自定义的配置文件，或者例如Java系统参数这类的配置机制，环境变量是不依赖语言或者系统的。

配置管理的另一个方面就是分组。有时候应用的配置信息会根据不同部署环境冠以不同的组名，例如Rails 的环境中的*development*, *test*, *production*。但是这种方法无法轻松的扩展：随着越来越多的部署环境的创建，需要越来越多的环境分组名，例如 *staging*, *qa*。如果工程越来越大，开发者可能还会加入自己特定的环境分组，例如 *chi-staging*, 这导致应用配置量的爆发，最终引起部署管理的不确定性。

在12-Factor的应用中，环境变量（env vars）每个都是单独设置，互相不影响。它们从组合成一个所谓”enironments“这样的分组，而是对不同的部署环境管理不同的环境变量，这样的方式可以让应用程序平滑的扩展，自然地适应更多的部署环境。

### IV. Backing Services

>将基础服务作为资源

后台服务（基础服务）是支持应用正常运作的一种服务，例如数据库（MySQL, CouchDB），消息队列（RabbitMQ 或者 Beanstalkd），SMTP作为外发邮件服务器（Postfix），以及缓存系统（Memcached）。

后台服务和应用一般都是有同一个系统管理员在同一个环境运维的。除了这种方式外，应用也可以使用第三方提供和管理的后台服务，例如SMTP服务（Postmark），监控数据收集服务（New Relic， Loggly），二进制文件服务（Amazon S3），甚至一些API服务（Twitter， Google Map， Last.fm）。

无论是本地的后台服务还是第三方的，应用的代码都是一样的。对于应用来说，这些服务都是附属的资源，可以通过URL或者配置文件里面的其他定位符/权限证书来访问。例如，12-Factor应用，可以在不修改代码的前提下，将后台服务从本地的MySQL数据库切换到第三方的服务（比如Amazon RDS）。同样，也可以从本地SMTP切换到第三方邮件服务（比如Postmark）。在如上两种情况中，只有配置文件里面的资源处理需要修改。

每个不同的后台服务都是一个独立的资源，例如，1个MySQL数据库是1个资源；2个MySQL数据库（用来对应用层的数据分片）被认为是2个不同的资源。12-Factor将数据库作为附属资源，这就意味这这些资源是松耦合的。

![attached resources](http://12factor.net/images/attached-resources.png)
 
这些资源可以随时绑定和解除绑定。例如，应用的数据库由于硬件问题出错，应用的管理者可以重新启动一台数据库服务器，恢复最近的数据，而当前的数据库可以解除绑定，绑定新启的数据库，一切操作都不需要修改代码。


### V. Build, release, run

> 严格区分构建和运行

一份基准代码成功部署到环境中需要下面3步：

*  构建阶段是指将代码仓库中的代码打包转化成可以执行的发布包(build)，基于开发阶段的某个版本，构建过程获取并打包依赖，将二进制文件和相关资源编译进发布包(build)。
*  发布阶段是把构建阶段生成的发布包与具体部署环境的配置信息整合，并可以立即在运行环境中执行。
*  运行阶段（通常称为运行时）指通过执行一系列操作，使得指定发布版本的应用在执行环境中运行。

12-Factor 应用严格区分build，release和run阶段。例如，在运行阶段，我们不能修改代码，这是因为我们无法将代码的改动影响到build阶段。

![3stages](http://12factor.net/images/release.png)

一般的开发工具都会包含发布管理功能，其中非常重要的一个功能是回溯。例如，[Capistrano][capistrano]会将所有releases放在一个名叫*releases*的子目录下，当前的发布版本只需要做一个连接到特定目录就可以。这样通过*rollback*命令也很方便快速回溯到前一个版本。

每个release都应该有一个唯一的release id，例如结合时间戳的release id ( *2011-04-06-20:32:17*) 或者一个自增长的数字（例如 *v100）。release只能追加新版本，一旦创建，则不能修改，否则，需要创建一个新的release。

Builds源于开发者部署新代码（开发者需要部署新代码，则手动触发创建一个Build）。相对地，运行阶段会自动触发，例如当服务器重启，也可以是管理员手工重启一个挂掉的进程。所以运行阶段保留尽可能少的可变因素，因为导致应用崩溃的问题可能会出现在半夜，那时候没有工程师在。构建阶段可以更加复杂，因为错误信息总是在工程师构建应用时出现。


### VI. Processes

> 应用由一个或多个无状态进程组成

应用总是通过一个或者多个进程跑着各个环境里。
最简单的情况，代码仅仅是一个跑在开发人员笔电中的一段脚本，这段脚本通过一个命令执行（例如，*python my_script.py*）。在另外一个极端的情况下，在生产环境中，一个复杂的应用可能需要[多种进程，也就是零个或者多个运行实例。][concurrency_process]

12-factor的应用是无状态的，[不共享的][share_nothing]。任何需要持久化的数据，都应该保存在确定状态的后台服务中，典型的是数据库。

内存，文件系统都可以作为应用运行时的简单的，支持事务的缓存。例如，下载一个很大的文件时，对其的任何操作，可以将操作结果写入数据库。12-Factor应用从来不会假定任何在内存或者硬盘的缓存将来还可以继续使用——由于应用有很多类型的进程组成，有很大的可能下次请求来时是另外一个进程来处理它。即便是只有一个进程，只要重启（例如代码变更，配置文件变更，进程调度等），就会改变当前本地（内存或者文件系统）的状态。

资源包（Jammit， django_asset_package）会将文件系统作为其编译资源的缓存。12-Factor应用推荐在build阶段来编译资源，而不是在运行阶段，例如 Rails asset pipline。

有些web系统依赖“sticky sessions”（粘性会话），具体是指，在应用进程的内存中缓存用户会话数据，将后续同一个用户请求路由到同一个进程中。Sticky
 Sessions违反了12-Factor应用的要求，不应该被采用。会话状态数据非常适合支持超时设置的数据库，例如Memcached或者Redis。
 
### VII. Port binding

> 端口即服务

 一般地，Web应用都通过Web容器运行。例如，PHP可以作为一个[Apache httpd][apache_httpd]的模块运行，Java应用跑在[Tomcat][tomcat]里。

12-Factor应用的是完全自我维护一个面向网络的服务，不依赖于环境中的web服务器。应用通过HTTP协议在指定端口上提供服务，监听端口上的请求。

在本地开发环境中，开发者可以通过类似*http://localhost:5000/* 这样的URL访问应用提供的服务。在开发过程中，路由层的处理机制会将各个外部请求分发给应用内部绑定在端口上的各个进程。

通用的做法是利用依赖声明将一个web服务器的类库引入应用，参考Python的Tornado，Ruby的Thin，Java和其他基于JVM语言的Jetty。这些都存在于用户空间，进一步说，存在于应用的代码中。通过运行环境约定的端口绑定来处理服务请求。

HTTP协议并不是应用绑定端口提供服务的唯一选择。几乎所有服务器软件都能绑定在指定端口监听请求。例如ejabberd（又称XMPP），Redis（又称 Redis协议）。

另要注意的是，端口绑定说明应用可以作为另外一个应用的后台服务，只需要提供后台应用的URL接口地址，通过配置作为另外一个应用的资源。

### VIII. Concurrency

> 通过进程模型水平扩展

任何一个应用程序，都是由一个或者多个进程组成。Web应用也以多种进程的方式运作。例如，PHP进程作为Apache的一个子进程，跟随请求启动进程。Java进程则相反，Java虚拟机（JVM）启动时维护一个占用很多系统资源（CPU，内存）的大进程，通过线程处理内部并发管理。无论上述那种情况，运行着的进程是开发人员可见的最小单位。

在12-Factor应用中，进程是“一等公民”，进程很大程度上继承了Unix系统的守护进程模型。利用这种模型，开发人员可以将各种各样的请求负载分发给不同的进程类型。例如，HTTP请求交由web进程处理，一个后台长期运行的进程交由一个worker来处理。

![work load](http://12factor.net/images/process-types.png)

这不表示不能通过单个进程处理内部并发的情况，单进程可以利用例如虚拟机的线程模式，EventMachine，Twisted以及Node.js的异步事件机制等。但是单独的一个虚拟机可能需要垂直扩展，这时候应用必须有能力在不同的物理环境中运行多个进程。

进程模型在服务需要扩展时会十分抢眼。由于12-Factor应用的无共享，进程水平可分的特性，使得增加应用的并发变得容易可靠。进程的类型以及每个类型进程的数量就称为*Process Formation*。

12-Factor应用的进程不需要作为守护进程启动或者写入PID文件。应该依赖于系统的进程管理（例如，Upstart，云平台中的分布式进程管理，Foreman工具）来管理输出，处理崩溃的进程，以及用户导致的重启和停机。


### IX. Disposability

> 高稳定性，优雅而快速的启动关闭
 
 12-Factor的应用是灵活的，意味着它们可以随时快速地启动关闭。这一特性有利于快速弹性扩展，一旦代码和配置改变可以快速部署以及加强了生产环境部署的健壮性。

尽量减少进程的启动时间，理想情况下，进程从敲入启动命令到启动完毕可以接收请求或任务之间应该只需要数十秒。减少启动时间带来的更敏捷的部署发布和服务扩展；由于进程管理器能方便，安全的将进程从一个物理环境移动到另外一个，应用也会更加健壮。

进程如果接到进程管理器发出的SIGTERM信号，会优雅地关闭。对于web进程来说，优雅的关闭指停止监听端口（即拒绝所有新请求），处理完现有请求，然后退出。这种模式暗含的要求是HTTP的请求必须很快（大概几秒），长轮询的情况下，一旦链接断开，客户端必须马上重连。

对于worker的进程，优雅地关闭指将当前任务重新放回任务队列。例如，在RabbitMQ中，一个worker会发送一个*NACK*；在Beanstalkd中，如果一个worker断开连接，当前任务会自动退回到任务队列中。对于有锁的系统，例如Delayed Job，关闭前都必须确保释放了任务锁。此类型暗含的要求是所有任务都是可以“中断重连”，而实现这一要求的常规做法是将结果包装成事务，或者操作保持幂等性。

对于突然的崩溃进程需要显得足够健壮，除非错误出现在硬件之中，虽然这种情况对于优雅的关闭来说不是很常见，但仍是需要的。推荐的做法是使用一个健壮的队列服务，例如Beanstalkd，将断开或者超时的任务退回到队列之中。无论是那种情况，12-Factor应用都能处理非正常的，不优雅的中断。这种做法符合[Crash-Only][crash-only]设计理论。



### X. Dev/prod parity

> 将开发，预发布和产品，每个过程尽可能保持一致

传统上，开发（开发人员在本地部署环境中直接编辑代码）和生产（直接面向最终用户的环境）之间有着很大的差别。这些差别主要体现在如下几个方面：

* **时间差距**：开发人员可能会在开发阶段持续数天，数周甚至数个月才能进入生产环境。
* **人员差距**：开发人员开发，但是运维人员负责部署。
* **工具链差距**：开发人员的工具栈可能包括OS X， Nginx，SQLite，但是运维人员使用的是Linux，MySQL和Apache。

12-Factor应用的设计满足持续开发的要求，将开发和生产环境中的差距减小。我们可以看上述的几个差距在12-Factor的表现：

* **缩小时间上的差距**：开发人员可以几个小时甚至几分钟就部署新代码。
* **缩小人员的差距**：开发人员编写代码就包含部署过程，并且自己关注生产环境。
* **缩小工具链差距**：开发人员和运维人员的环境和工具尽可能的一致。

总结为如下列表：


|                  | 传统应用         | 12-Factor 应用   |
|:----------------- | ---------------------------: | ---------------------:|
| 部署间隔          |    数周 |       数小时 |
| 开发人员VS运维人员 |   不同人员   | 同一个人员 |
| 开发环境VS生产环境  |  多样性|      尽可能一致|


后台服务，像数据库，消息队列，缓存等，这些对于开发/生产的一致性很重要。许多语言都提供访问后台服务的库，包括对不同类型服务的适配器，如下表所示：

|  类型     |语言        | 库      | 适配器       |
|:---------|----------------------------:|--------------------:|---------------------:|
|数据库      | Ruby/Rails|          ActiveRecord|         MySQL, PostgreSQL, SQLite|
|消息队列    | Python/Django|       Celery|               RabbitMQ, Beanstalkd, Redis|
|缓存       | Ruby/Rails|           ActiveSupport::Cache| Memory, filesystem, Memcached|

有时，开发人员很喜欢在开发环境中使用轻量级的后台服务，而在生产环境中使用更加健壮重量级的后台服务。例如在开发时使用SQLite而在生产环境中使用PostgreSQL；开发时使用系统内存作为缓存而在生产环境中使用Memcached。

**12-Factor应用的开发人员应该坚决拒绝在开发环境和生产环境中使用不不同的后台服务**，即使语言的适配器接口在理论上抽象到可以忽略后台服务的差异。后台服务的差异意味着即使很小的不兼容问题会毁掉整个应用，最终导致在测试和预发布环境中通过的代码有可能会在生产环境中挂掉。这类问题给持续开发带来阻力，纵观整个应用的生命周期，这种阻力在随后的持续开发中会花费更大的代价。

本地轻量级的后台服务越来越受到人们青睐，多亏了像Homebrew和apt-get这样的包管理工具，安装运行现在类似RabbitMQ，Memcached和PostgreSQL这样的后台服务变得十分便捷，此外，例如Puppet和Chef这种自动配置的工具，接合轻量级的虚拟机环境工具（Vagrant）可以为开发人员在本地尽可能的模拟生产环境。对于保持环境一致和持续开发的益处来说，这些工具的开销并不算什么。

对于不同后台服务的适配器仍然很有用，它可以方便我们切换到新的后台服务。但是，应用的所有环境（开发，测试，预发布，生产）环境中都应该使用同一类型，同一版本的后台服务。

### XI. Logs
> 日志作为事件流

透过日志能看到应用运行的状态。在基于服务器的环境中，日志通常保存在硬盘上（比如logfile），但这仅仅是日志输出的一种格式。

日志是按时间顺序汇总的事件流，将应用运行的进程和后台服务的输出按时间输出。日志的原始文件通常是一个事件一行（异常的跟踪信息可能会占用很多行）。日志没有固定的开始和结束，而是随着应用的运行始终存在。

12-Factor 应用从来不考虑何处和怎么样存储自己的输出。同时也不应该试图去记录或者管理日志文件。相反地，每个运行的进程将其输出直接写入`stdout`。在本地开发时，开发人员可以在terminal中观察应用的stdout。

在预发布和生产环境中，每个进程的输出流应该由环境抓取，收集并且保存到一个或者多个目标文件中，方便查看和长久的保存。但是这些归档的不应该由应用来配置，它们对于应用不可见，是由当前环境配置的。一些开源工程（类似Logplex和Fluent）能实现这样的目的。

应用的实时输出应该导入到一个文件，或者在terminal中用tail命令查看。最重要的是，输出流应该通过一个能分析和索引的系统，例如Splunk，或者通用数据存储服务，例如Hadoop/Hive。这些系统都为应用状态的查看提供了非常强大灵活的功能：

* 查找以前发生的具体事件
* 各种尺度图形化的趋势（例如每分钟多少请求）
* 根据用户定义值启动告警（例如每分钟错误量超过阈值则告警）

### XII. Admin processes

> 将管理/控制任务作为一次性任务

Process formation 是只一组针对常规业务（处理web请求）的进程。除此之外，开发人员还希望执行一些一次性的任务来维护和控制应用：

* 数据库转移任务（例如 Django中`manage.py syncdb`，Rails中的`rake db:migrate`db）。
* 运行一个控制台（也就是REPL shell）来执行一些代码或者检查应用代码在数据库中的情况。大多数语言可以通过解释器提供REPL工具（例如`python`或者`erl`）或者（Ruby中的`irb`，Rails中的`rails console`）
* 一次性提交代码（例如，`php scripts/fix_bad_records.php`）。


一次性的管理进程应该和应用正常的常驻进程在同一个环境中。它们和应用其他的进程共享代码库和配置，同时必须随着应用的代码一起发布已避免同步问题。

对于应用的所有类型的进程应该使用相同的依赖隔离技术。例如，如果一个Ruby进程使用`bundle exec thin start`， 那么数据库迁移也应该使用`bundle exec rake db:migrate`。同样地，使用VirtualEnv的Python程序应该使用打包的`bin/python`来运行Tornado或者其他`manage.py`管理的服务器进程。

12-Factor 更推荐能提供REPL shell的语言，或者能提供简单执行一次性脚本功能的语言。在本地开发中，开发人员可以在应用的检出目录中调用一次性管理进程。在生产环境中，开发人员能通过ssh或者其他的远程调用机制来运行一个进程。

* * * 

英文原版: [Heroku's 12-Factor-APP][12factor]

 
[12factor]: http://12factor.net/
[http-api]: http://chixq.com/articles/http-api-guide/
[software-erosion]: http://blog.heroku.com/archives/2011/6/28/the_new_heroku_4_erosion_resistance_explicit_contracts/
[book1]:http://books.google.com/books/about/Patterns_of_enterprise_application_archi.html?id=FyWZt5DdvFkC
[refactoring]:http://books.google.com/books/about/Refactoring.html?id=1MsETFPD3I0C
[cpan]:http://www.cpan.org/
[rubygem]:http://rubygems.org/

[gem_bundler]:http://gembundler.com/
[capistrano]:https://github.com/capistrano/capistrano/wiki
[concurrency_process]: http://chixq.com/12-factor-app
[share_nothing]:https://en.wikipedia.org/wiki/Shared_nothing_architecture
[apache_httpd]:http://httpd.apache.org/
[tomcat]:http://tomcat.apache.org/
[crash-only]:http://lwn.net/Articles/191059/
