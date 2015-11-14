---
title: Kubernetes 系列之一： 部署 Kubernetes
author: Kris Chi
date: 2014-05-10
tags: 原创, docker, 运维
template: article.jade
---

Kubernetes是谷歌开源的Containers Cluster管理系统，Golang实现。据说也是Google在其内部使用了十几年的[Borg][borg]系统的开源版本。本文旨在学习如何搭建一个可以跑通的 Kubernetes 集群。
<span class="more"></span>


Kubernetes维护了一个基于[Docker][docker] Container的集群，使得Container Application的部署，维护以及伸缩更加便利。Kubernetes优于其他系统的特点在于如下方面：

* Lean：操作简单，运维方便
* Portable：可运行在公有云，私有云，物理机，以及混合云之上
* Extensible：模块化，可插拔集成各个组件
* Self-healing：组件可以实现自动更新，重启，复制

### How it works

Kubernetes在Docker技术的基础上，引入了一些利于开发/运维人员理解的一些概念，在使用Kubernetes前，应该首先掌握它们。

* **Cluster**：Kubernetes维护一个集群，Docker的containers都运行其上。并且，这个集群可以运维在任何位置（参见Kubernetes的Portable特性）。
* **Minion**：Kubernetes采用Master-Slaves的部署方式，单独一台Slave机器称为一个Minion。
* **Pods**： 一个Pod是Kubernetes管理的最小单位，控制其创建，重启，伸缩。一个Pod包含一组功能相近，共享磁盘的Docker containers。虽然Pod可以单独创建使用，但是推荐通过Replication controller管理。
* **Replication controllers(RC)**：管理其下控制的Pods的生命周期，保证指定数量的Pods正常运行。
* **Service**：类似于Loadbalance，为一组Pods提供对外的接口。
* **Labels**：K/V模式，用来标记Kubernetes组件的类别关系（例如标记一组Pods是frontServices，另一组是backServices）。Labels对于Kubernetes的伸缩调度非常重要。

Kubernetes的设计架构如下图所示：

![GithubImages](https://github.com/kubernetes/kubernetes/blob/master/docs/design/architecture.png?raw=true)
*点击查看大图*
 
如上图所示，左边是Kubernetes的Master Node，主要包含：

1. api-server：提供Restful接口，控制和获取pods，minions，services和rc信息。
2. scheduler：接收api-server的任务，将pods调度到不同的worker node( minions) 上。
3. etcd：分布式K/V存储，方便集群内各个节点通信。
4. kube-proxy：Kubernetes的每个节点上都会运行kube-proxy，这是一个简单的网络通信工具，实现各个节点上的TCP/UDP通信和节点发现。

除此之外，在Master上还有kubelet info service 来分发对于kubelet的请求，如果运行在[CoreOS][coreos]（支持systemd）上，还可以通过[fleet][fleet]和[systemd][systemd]系统协作部署启动Kubernetes节点。

同时，右边是两个Worker Node( Minions )，主要包含：

1. kubelet：kubelet作为container的agent，通过指定规则的描述文件（YAML）启动Docker container，上报container信息。
2. kube-proxy：与Master上的proxy作用相同。
3. docker-daemon：通过etcd和flanneld，将docker运行在指定的subnet的bridge地址上。

除此之外，Minion上还有[flanneld][flanneld], 通过etcd给每个docker-daemon提供subnet配置。

### How to deploy Kubernetes cluster
Kubernetes实现了很多CloudProvider，包括自己的GCE(Google Compute Engine), AWS, Azure, vSphere, Rackspace等，对于我们做technical/practical validation，我们完全可以在物理机（or Barametal）上搭建一个Kubernetes cluster。

#### Step 1. Build binary
由上文可知，Kubernetes实现了低耦合，高内聚，可插拔的组件，对于Master和Minions，我们可以手动构建各自需要的二进制包，将其部署在不同的节点。

*注意：Kubernetes 现在的状态是under actively development，脚本位置和内容随时可能变化，请酌情使用*

1.首先，在构建环境中必须先[安装Docker][installdocker]，Python。

2.git clone 代码并构建各个binaries

```
1. 构建etcd，Master/Minion上的分布式K/V服务
$ git clone git@github.com:coreos/etcd.git
$ cd etcd
$ ./build
得到etcd和etcdctl文件

2. 构建flanneld，Minion的基础服务
$ git clone git@github.com:coreos/flannel.git
$ ./build

3. 构建setup-network-environment，方便Minion部署的一个工具
$ git clone git@github.com:zhcloud/setup-network-environment.git
$ cd setup-network-environment
$ godep go build .

4. 构建Kubernetes binaries
$ git clone git@github.com:GoogleCloudPlatform/kubernetes.git
$ cd kubernetes/build
$ ./make-clean.sh
$ ./run.sh ..hack/build-cross.sh

经过十几分钟之后（视网络情况和GFW高度），应该会build完成，这时候可以在`_output/`文件夹中找到构建成功的binary文件。或者，直接：

$ ./release.sh

会将所有binaries构建到`_output/release-stage/` 和`_output/release-tars`目录下 
```

3.整理Binaries
在`your_path/kubernetes/_output/release_stage/client`目录中找到对应平台的bin文件，例如`linux-amd64`，找到kubecfg，这是Kubernetes集群的CLI管理工具。
在`your_path/kubernetes/_output/release_stage/server`目录中找到对应平台的bin文件，当前server bin只支持`linux-amd64`。

最终Master需要：

* kube-apiserver
* kube-controller-manager
* kube-scheduler
* kube-proxy
* etcd
* etcdctl
* flanneld

Minions需要：

* kubelet
* kubeproxy
* flanneld
* set-network-environment

#### Step 2.  Deploy on Master
在Step1中我们已经生成了构建好的各个binaries，登陆Master主机，确保防火墙关闭, 开启TCP/UDP 0-65535所有端口（严格来讲，应该开放Kubernetes集群所需要的端口），按如下命令顺序启动各个组件
先启动etcd， ${MASTER_PRIVATE_IPV4} 替换为Master的私有IP
```
$ nohup /opt/bin/etcd 
    -name default \
    -advertise-client-urls=http://${MASTER_PRIVATE_IPV4}:4001,http://${MASTER_PRIVATE_IPV4}:2379 \
    -initial-advertise-peer-urls=http://${MASTER_PRIVATE_IPV4}:7001,http://${MASTER_PRIVATE_IPV4}:2380 \
    -initial-cluster default=http://${MASTER_PRIVATE_IPV4}:7001,default=http://${MASTER_PRIVATE_IPV4}:2380 
```
然后通过etcd控制工具etcdctl创建一个Key(例如coreos.com)，value为Minion上绑定的subnet地址('{"Network":"10.0.0.0/16"}')
```
$ /opt/bin/etcdctl mk /coreos.com/network/config '{"Network":"10.0.0.0/16"}'
```

再分别启动其余的服务.
```
$ nohup /opt/bin/flanneld &
```
启动apiserver,使其监听在0.0.0.0
```
$ nohup /opt/bin/kube-apiserver --address=0.0.0.0 --port=8080 --portal_net 10.1.0.0/16 --etcd_servers=http://127.0.0.1:4001 --logtostderr=true &
```
启动kube-controller-manager, 由于我们在物理机上执行, 不需要配置CloudProvider, 所以需要添加--machines参数, 设置为minion的私有IP地址
```
$ nohup /opt/bin/kube-controller-manager --master=127.0.0.1:8080 --machines=${MINION_PRIVATE_IPV4_LIST} --logtostderr=true &
```
启动scheduler
```
$ nohup /opt/bin/kube-scheduler --master=127.0.0.1:8080 &
```
启动proxy
```
$ nohup /opt/bin/kube-proxy --etcd_servers=http://127.0.0.1:4001 &
```
以上, Master的所有服务都已经启动完成,可以通过下面的shell 方法检查运行状态
```
function checkstatus(){
    # Check listening port
    etcd_status=`netstat -ntpl | grep '4001' | awk '{print $6}'`
    api_status=`netstat -ntpl | grep '8080'| awk '{print $6}'`
    scheduler_status=`netstat -ntpl | grep '10251'| awk '{print $6}'`
    controller_status=`netstat -ntpl | grep '10252'| awk '{print $6}'`

    echo 'Master services listening:'
    echo '    etcd_status: '$etcd_status
    echo '    api_status: '$api_status
    echo '    scheduler_status: '$scheduler_status
    echo '    controller_status: '$controller_status

    # Check process status
    etcd_ps=`ps -ef| grep bin/etcd| grep -v grep | awk '{print $2}'`
    flanneld_ps=`ps -ef| grep bin/flanneld| grep -v grep| awk '{print $2}'`
    api_ps=`ps -ef| grep 'bin/kube-apiserver'|grep -v grep| awk '{print $2}'`
    scheduler_ps=`ps -ef| grep 'bin/kube-scheduler'|grep -v grep| awk '{print $2}'`
    controller_ps=`ps -ef| grep 'bin/kube-controll'|grep -v grep| awk '{print $2}'`
    proxy_ps=`ps -ef|grep 'kube-proxy'|grep -v grep| awk '{print $2}'`

    echo 'Master processes pid:'
    echo '    etcd_pid: '$etcd_ps
    echo '    flanneld_pid: '$flanneld_ps
    echo '    api_pid: '$api_ps
    echo '    scheduler_pid: '$scheduler_ps
    echo '    controller_pid: '$controller_ps
    echo '    proxy_pid: '$proxy_ps
}

```
#### Step 3. Deploy on Minions
登陆每台Minion主机，按照如下顺序启动各个组件
启动flanneld
```
$ nohup /opt/bin/flanneld -etcd-endpoints=http://${MASTER_PRIVATE_IPV4}:4001 &
```
将subnet配置信息加入环境变量
```
$ source /run/flannel/subnet.env
```
如果docker在运行,关闭它,并且卸载docker0
```
$ ifconfig docker0 down
$ brctl delbr docker0
```
重新启动docker daemon,使其监听在flanneld配置的subnet上
```
$ nohup docker -d --bip=${FLANNEL_SUBNET} --mtu=${FLANNEL_MTU} &
```
通过set-network-environment工具获取Minion网络配置并加入环境变量
```
$ /opt/bin/setup-network-environment
$ source /etc/network-environment
```
最后,启动kubelet和kubeproxy
```
$ nohup /opt/bin/kubelet --address=0.0.0.0 --port=10250 --hostname_override=${DEFAULT_IPV4} --etcd_servers=http://${MASTER_PRIVATE_IPV4}:4001 --logtostderr=true&

$ nohup /opt/bin/kube-proxy --etcd_servers=http://${MASTER_PRIVATE_IPV4}:4001 &
```
同样,可以通过下面的shell function检查Minion服务状态:

```
function checkstatus(){
    # Check listening port

    kubelet_status=`netstat -ntpl | grep '10250'| awk '{print $6}'`

    echo 'Minion services listening:'
    echo '    kubelet_status: '$kubelet_status

    # Check process status
    flanneld_ps=`ps -ef| grep bin/flanneld| grep -v grep| awk '{print $2}'`
    kubelet_ps=`ps -ef| grep 'bin/kubelet'|grep -v grep| awk '{print $2}'`
    proxy_ps=`ps -ef|grep 'kube-proxy'|grep -v grep| awk '{print $2}'`

    echo 'Master processes pid:'
    echo '    flanneld_pid: '$flanneld_ps
    echo '    kubelet_pid: '$kubelet_ps
    echo '    proxy_pid: '$proxy_ps
}
```

#### Step 4. Done & Test
在Master和Minion都配置启动完成之后，可以在本地测试Kubernetes集群。
通过SSH协议转发Master的api-server 8080端口到本地8080端口
```
$ ssh -i key.pem -f -nNT -L 8080:0.0.0.0:8080 
user@MASTER_PUBLIC_IP
```
通过构建的kubecfg工具查看集群状态：
```
$ kubecfg list minions
```
创建Pod的manifest文件，pod.json

```
{
  "id": "hello",
  "kind": "Pod",
  "apiVersion": "v1beta1",
  "desiredState": {
    "manifest": {
      "version": "v1beta1",
      "id": "hello",
      "containers": [{
        "name": "hello",
        "image": "quay.io/kelseyhightower/hello",
        "ports": [{
          "containerPort": 80,
          "hostPort": 80 
        }]
      }]
    }
  },
  "labels": {
    "name": "hello",
    "environment": "testing"
  }
}
```
启动Kubernetes管理下Demo container
```
$ kubecfg -c pod.json create pods
```
查看Pod创建过程
```
$ kubecfg list pods
Name                Image(s)                        Host                Labels                           Status
----------          ----------                      ----------          ----------                       ----------
hello-china         quay.io/kelseyhightower/hello   <unassigned>        environment=testing,name=hello   Pending
```
直到pods的status变成running,证明已经成功在Minion上启动一个container.


### Next Step

#### 通过CloudFormation在AWS上一键运维Kubernetes

~~TODO~~

本来想自己实现一下通过 AWS  CloudFormation 一键部署，但是发现 Github 上已经有人提供了。[link](http://kubernetes.io/v1.0/docs/getting-started-guides/aws-coreos.html)

#### 通过FIT2CLOUD在阿里云上一键运维Kubernetes

~~这些内容放在下次来讲。~~

已经完成帮助公司写的教程。[link](http://chixq.com/kube-series-2-fit2cloud-qingcloud)



[borg]:http://www.quora.com/What-is-Borg-at-Google
[docker]:http://docker.com
[installdocker]:https://docs.docker.com/installation/
[coreos]:http://coreos.com
[fleet]:https://github.com/coreos/fleet
[systemd]:http://en.wikipedia.org/wiki/Systemd
[flanneld]:https://github.com/coreos/flannel
