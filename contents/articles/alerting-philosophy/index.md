---
title: "Alerting & Monitoring Philosophy"
author: Kris Chi
date: 2015-03-03
template: article.jade
---

本篇文章是对”[My Philosophy on Alerting][refer]”的记录和体会,更多的源于这两年DevOps领域工作的反思.
<span class="more"></span>


![Alt monitoring](header.png)

Terms
----
在Monitoring和Alerting的工作中,经常会出现下面单词:

* oncall: 一般指人工轮流对上线生产系统的监控,告警处理,如果你被安排oncall,
很可能你的手机号已经被写入了Monitoring System的通知列表里.

* page: 一切能快速通知到具体oncall人员的东西都可以叫page,短信电话email,甚至在他上
厕所时给他显示器上贴的便利贴.

* rule: 字面意思,告警设置的规则,包括阈值,告警条件,优先级,通知类型等.

* alert: 告警动作,常见的有email,工单,IM消息,短信,电话等,根据不同的rule来选择.

Philosophy
-----

* 始终铭记,你只是个OP或者DevOp, 系统是为用户服务,而不是为你.

所以,对于用户接口(浏览器)的告警信息一定是直观和友好的.用户只知道他无法添加商品了,
而你不需要告诉他MySQL Connection Reach Maxium, 用户只知道商品不存在而不需要返回Tomcat
的404 Not Found, 用户不知道你的LoadBalance在升级,他们只知道网站打不开了,503错误.

当然,任何事情都分情况的,比如你要监控的系统,用户就是一群OP.

* 监控告警要迅速,保证可达,否则就没有任何意义.

* 监控告警最好的是描述原因,而不是问题.

对于经验丰富的OP,可能会很快的定位问题,但是不能保证每个oncaller都是大拿,这时候,监控信息
如果准确的告诉你Memcached挂了,或者磁盘快满了,比简单描述现在网站延迟超出阈值要有用的多.

* 区分不同的监控告警,对告警区间分层处理.

比如是系统功能还是性能上的,是可用性问题还是具体
feature的bug, 是网页浏览器的问题还是后台python的,这样即有助于定位问题,也可以让Oncall不至于手忙脚乱引发雪崩.

* 预见性告警.

这点很重要,谁也不想在早上8,9点的时候网站瘫痪,即使手脑再快的OP也不愿意在这个
时候刷APM(Actions per Minute). 例如磁盘空间不够, 爆发型上行流量等等.

* 开发适合场景的Dashboard

很容易理解,如果有内存,CPU曲线,在线人数报告,那我们完全可以做到有预见地告警和处理问题,
现在主流Monitor System都带有很全面的Dashboard, 其实有时候并没有太大必要,我已经发现很多时候
对于中小型系统,基本没人关注CPU,IO等等(因为基本够用),一般只会看两眼Health check.

所以说要开发适合场景的Dashboard,最好是自定义规则的,保持一个层级的HUD.


beyond Philosophy
-----
除了上面的一些关于监控告警具体实施的经验之外,还有一些别的体会:

* 如果你想享受 quiet oncall, 就需要尽可能地自动化处理告警page

比如,编写自动重启进程脚本如果代码有内存泄露(出来混,谁还能没几次泄露), 当流量爆发或者半夜之后
服务器自动扩容/收缩,甚至包括重启之前把所有用户session存下来这些容易疏忽的步骤.

* 用户是上帝.

始终保证用户信息的完整,同步和可用.不能因为MySQL挂了,oncall来了,赶紧重启,用户在线操作
一半,等oncaller的fastest recovery结束后,用户什么数据都丢了. 要尽可能的保护用户,留住用户.

* 建立BugTracker, Internal wiki, 甚至Weekly Report

“铁打的军营流水的兵”,保不齐oncall是个新手,如果能有wiki可以搜索常用的Fix step或者脚本,对任何人和
团队来说,都是可贵的, 而且也是很有效的工作管理手段.

* 屏蔽噪声

业务系统不是perfect的,所以需要监控系统,但是监控系统也不是perfect的,在最小的损失下换取最大的人力/物力
节流, 也许真的是网络问题, 也许真的是VPS磁盘IO突然下降,等等,如果每个这种小偏差都要修正,真的会十分头痛.
毕竟,系统是有可用率的(HA: 99.99%, 不是100%), 监控也是有阈值的 :)

当然,It depends, depends on what? 具体的业务/项目需求.



Tools
-----

_todo_

[refer]: https://docs.google.com/document/d/199PqyG3UsyXlwieHaqbGiWVa8eMWi8zzAn0YfcApr8Q/edit#
