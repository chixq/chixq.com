---
title: AWS DevOps Professional Level Passed!
author: Kris Chi
date: 2017-01-31
template: article.jade
---

今天是2017年春节的大年初四，想写点什么，刚好年前的时候我 AWS DevOps Professional 通过了，这里就总结下考试复习和机考的要点，希望能帮助更多的后来的人。<span class="more"></span>

**一、AWS DevOps Certification**

获取 AWS 认证是在云计算行业，甚至整个 IT 行业是非常有说服力的，以证明工程师具备相应的专业技能和技术知识。从我自己感觉，备考 AWS 认证，不仅是对 AWS 体系的深入了解学习（这也是 AWS 的初衷，让人人都成为 AWS 的布道师），更是提高了自己对于通用 IT 基础设施，软件架构的理解，对于常见 Troubleshooting 的敏锐，以及代码，网络安全的意识。

除了阅读（海量）英文文档有些费时，其他真是百利而无一害。(哦，还有一点，如果没有考过，是有点贵的，专家级考试：2,160人民币/人次，如果有公司报销最好。



具体 AWS 认证路线可以参考官网说明，这里仅放出一张图（基于官方，稍作修改）。

![](https://ww2.sinaimg.cn/large/006tNbRwly1fc8nue5p6lj30rs0i2gse.jpg)



其中 DevOps 这个非常火的领域证书路线也很清晰，再考过了 SysOps Associate （偏运维）或者 Developer Associate （偏开发）之后，才能进而准备 DevOps Professional。我是走的 Developer 这条路，因为我觉得 SysOps 里面有太多专业的实际操作（比如 CloudWatch 某个详细指标的设置等），我承认对于 AWS 还没有这么细致入微的实践能力。这次也主要回顾下我考过 AWS DevOps Engineer Professional 的过程。



**二、AWS DevOps 考点**

先把大规模杀伤性武器武器放出来，考 DevOps Professional **必看**如下几个 re:Invent 视频，对照官方白皮书，基本覆盖了 60% 以上的考分。

1. [Deep Dive into Blue/Green Deployments on AWS](https://www.youtube.com/watch?v=aX54mhZbN58)
2. [All You Need To Know About Auto Scaling (CMP201)](https://www.youtube.com/watch?v=4trGuelatMI)
3. [Amazon CloudWatch Deep Dive](https://www.youtube.com/watch?v=pTzv-i1uvvE)
4. [AWS Cloudformation under the Hood](https://www.youtube.com/watch?v=ZhGMaw67Yu0)

详细看这几个视频，在考试的时候发现很多问题都源于这几个视频中的一些 Best Practises 或者介绍中的一些真实案例分析。

针对上面的视频，重点掌握：

1. 蓝绿部署在 AWS 上都有哪些实现方式，cloudformation，autoscaling group， elb，router53 等
2. 蓝绿部署中 cloudformation stack 如何更新，牢记 autoscaling group 同一时刻只能应用一个 launchconfiguration
3. 如果要做到 weighted traffic differ，比如 10% ／ 90% 分别导入 blue env 或者 green env，目前在 AWS 中只有 router53 weighted dns 可以做到
4. autoscaling groups 和 launchconfiguration 的关系
5. autoscaling groups scale in-out 的 policies，default policies 是什么，最容易考比如 scale-in 的时候会优先把 old instance or old-launchconfigurationed instance 先 terminate 等
6. autoscaling groups 中对于 instance lifecycle 要了解原理和适用场景，比如 instance pending 到 inService 来减少 scale out 的预热时间，从 terminate-waiting 到 terminated 可以用来排查 instance 错误等
7. cloudwatch 需要清楚由于 hypervisor 的限制，只能适用于采集 cpu，disk i/o 等指标，如果需要更全面的指标，或者业务级别的自定义指标，则需要部署 custom metrics scripts
8. cloudwatch 新 release 的 futures —— logs and events, 需要知道它们都是干什么用的，尤其是 cloudwatch logs 用于处理 instance 的日志，通过 regex filter  提取需要的日志信息
9. cloudformation 不仅只是停留在 what is it，需要知道具体 template 编写的细节，包括 cloudformation 的预留方法 （intrinsic functions）有哪些等等。
10. cloudformation 有个考点非常关键，即 custom resources，通过 custom resources，cloudformation 可以管理**非 AWS** 资源，比如考题中有个 webtest central service
11. cloudformation 需要掌握 cfn-init ，cfn-hup 等 signal 的用途，以及 creation policy（可以替代 waitCondition），deletion policy，update policy 的适用场景 。比如 cloudformation 管理 autoscaling groups 时，如果更新 launchconfiguration，update policy 就能发挥作用



上面几个视频反复看三遍，可能连蒙带猜刚好考过（60分），但是如果想更稳妥一点，还需要进一步 read the fucking manual， do the fucking practise，既然是 DevOps，那么如下几个服务，是必考的：

* CloudFormation
* Elastic Beanstalk
* Opsworks
* Autoscaling Group
* CloudWatch
* CloudTrail

不必多说的是，DevOps Professional 是 Professional Level，对于这些服务，一定不是仅仅知道是干嘛的，大概怎么用就行的，**需要详细的跟文档**，知道一些非常细节的用法和实践经验，我根据我复习和考试中遇到的问题，做些整理。

* CloudFormation

  * 详尽的 CloudFormation 语法，结构，每个 fn:* 怎么用
  * WaitConditon 的意义和用法
  * cfn-init, cfn-hup, cfn-signal 的意义和用法
  * cloudformation::init 怎么和 cfn-init 配合使用
  * custom resource 怎么协调第三方服务，资源

* Elastic Beanstalk

  * EB 支持那些 AWS 自身的服务
  * EB 主要做 webservice，如果不适合的场景怎么办？（Docker）
  * .ebextensions 文件夹的作用，以及如何做些初始化操作（支持那些语法，Linux 和 Windows 支持是否一致）

* Opsworks

  * Opsworks 和 chef 的关系
  * Opsworks Stack 和 Opsworks for Chef Automate 的区别
  * 如何更新 Chef cookbook
  * Opsworks 中的概念，application，layer，stack，env 等

* Autoscaling Group

  * 看前面视频就够了

* CloudWatch

  * 知道 CloudWatch logs 保留多久的日志 （14 天）有道题就考到这个，说有个三周前的 instance 出了问题，blabla
  * 如何和 Kinesis，EMR 配合 （这块有考点，但只有一两道，我也没有考 100%，这块不敢确定）
  * 其他看视频就够了

* CloudTrail

  * CloudTrail 基本概念
  * CloudTrail、SNS、S3 配合做安全检测
  * 每个 Region 只能有 5 个 trails 的 limit

* 安全相关问题

  * 如果第三方服务（部署于 AWS）需要获取你的 AWS 资源，考虑 cross-account iam role
  * S3 bucket 做 website，web 中的 js 需要和 Dynamodb 通信，如何处理（仔细看清楚是否有 AWS Javascript SDK，决定是否可以用 iam role 来赋权）
  * web federation 对接第三方账号（Google，Facebook，Twitter 等）

* 其他

  * 等想到了再写

    ​

**三、考试技巧**

这个比较投机取巧，但是非常有效  :)

1. 考试 170 分钟，80道题，大多数题都和英文阅读理解一样长。所以建议先把单选都保证做对了，多选全答对概率很低，可以放弃，后面再补上。
2. 答案中如果没有涉及 AWS 服务，或者很少，步骤又很复杂（即可实现性不高），就不要选择
3. 题目中注意一些特殊信号，比如强调了是 windows  .net 服务，就要考虑答案中对于 windows 的特殊处理；或者强调时间长短（三周），就要考虑 AWS 服务对于时间的敏感性；或者强调 instance 数量等，就需要考虑是否超出 service limit。

