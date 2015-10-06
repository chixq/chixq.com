---
title: HTTP API 设计指南
author: chixq
date: 2014-11-1
template: article.jade
tags: 原创, 翻译
---

一段时间前，Heroku在其Github Repo发表了一篇关于HTTP API设计的经验和总结，这些经验都建立在Heroku Platform的开发和运维之上，非常值得借鉴。
<span class="more"></span>

**Table of Contents**

- [Introduction](#introduction)
- [Foundations](#foundations)
  - [Require TLS](#require-tls)
  - [Version with Accepts header](#version-with-accepts-header)
  - [Support caching with Etags](#support-caching-with-etags)
  - [Trace requests with Request-Ids](#trace-requests-with-request-ids)
  - [Paginate with Ranges](#paginate-with-ranges)
- [Request](#request)
  - [Return appropriate status code](#return-appropriate-status-code)
  - [Accept serialized JSON in request bodies](#accept-serialized-json-in-request-bodies)
  - [Use consistent path formats](#use-consistent-path-formats)
    - [Resource names](#resource-names)
    - [Actions](#actions)
  - [Downcase paths and attributes](#downcase-paths-and-attributes)
  - [Support non-id dereferencing for convenience](#support-non-id-dereferencing-for-convenience)
  - [Minimize path nesting](#minimize-path-nesting)
- [Response](#response)
  - [Provide resource (UU)IDs](#provide-resource-uuids)
  - [Provide standard timestamps](#provide-standard-timestamps)
  - [Use UTC times formatted in ISO8601](#use-utc-times-formatted-in-iso8601)
  - [Nest foreign key relations](#nest-foreign-key-relations)
  - [Generate structured errors](#generate-structured-errors)
  - [Show rate limit status](#show-rate-limit-status)
  - [Keep JSON minified in all responses](#keep-json-minified-in-all-responses)
- [Artifacts](#artifacts)
  - [Provide machine-readable JSON schema](#provide-machine-readable-json-schema)
  - [Provide human-readable docs](#provide-human-readable-docs)
  - [Provide executable examples](#provide-executable-examples)
  - [Describe stability](#describe-stability)



----------


Introduction
-------------
这篇文章展示了我们在Heroku Platform API 开发中具体HTTP+JSON API的设计实践。
同时，本文作为内部的设计指南也将继续规范Heroku的内部API开发，希望其他同仁也能对此感兴趣。
我们的目的是建立持久可靠的业务，并且只将精力集中于业务逻辑的开发，避免重复制造轮子。
我们一直在寻找一个优秀的，可靠的，文档齐全的API设计方法，但这种方法并不是最终的，唯一的。
在开始之前，我们假定你已经了解最基本的HTTP+JSON APIs，所以我们将不会赘述这些基本概念。


Foundations
-------------
###Require TLS

无一例外，访问API需要TLS（*TSL1.0== SSLv3.1*）加密。而不是讨论什么时候需要TLS什么时候不需要，**任何时候任何情况下**，都需要TLS。
理想情况下，应该屏蔽所有访问http或者80端口的请求避免非安全的数据交换。如果具体环境不允许，服务器应该提示403 Forbidden。
同时，尽量避免Redirect，因为即使采用TLS加密，在跳转过程中，敏感数据可能在第一次请求时已经被泄露，而且请求跳转会使服务器压力加倍。

### Version with Accepts header
在请求Header中设置API version信息，在Header中的Accept：字段，通过自定义content type来表明API version，例如：
```
Accept: application/vnd.heroku+json; version=3
```
最好不要使用默认的API version，而是显式的要求客户端对特定版本的API发起请求。

### Support caching with Etags
通过引入[Etag][etag]头来标识别特定版本的返回值。客户端在后续的请求中可以通过给定If-None-Match值来确定后续请求的值是否过期。

*译者注： Etag（Entity Tags） 是 HTTP/1.1 引入的标准，主要为了满足客户端缓存数据的需求，有时作为Last-Modified等Header的补充。*

*Etag由服务器端生成，客户端通过If-Match或If-None-Matchp来判断资源是否被修改。具体的流程如下：*

*×××××××首次请求×××××××*
```
1. 客户端发起 GET 请求一个资源
2. 服务器处理请求，返回资源内容和及其Headers，Headers中包含Etag(例如"2e681a-6-5d044840")(假设服务器支持Etag生成和已经开启了Etag)。HTTP Code = 200。
```
*×××××××第二次请求×××××××*
```
1. 客户端发起 GET 请求一个文件，同时一个If-None-Match Header，这个Header的内容就是第一次请求时服务器返回的Etag：2e681a-6-5d044840。
2. 如果服务器判断发送过来的Etag和计算出来的Etag匹配，If-None-Match为False，不返回200，返回304 （资源未变更Code），客户端继续使用本地缓存。
3. 如果服务器又设置了Cache-Control:max-age和Expires，这时就需要请求的Header完全匹配If-Modified-Since和If-None-Match即检查完修改时间和Etag之后，服务器才能返回HTTP code=304。

```
### Trace requests with Request-Ids
在每个请求的返回值中加入UUID(Universally Unique Identifier) 作为Request-Id，如果这样做，可以很方便的在Server端和Client端的日志文件中找到具体请求，对于Debugging和Tracing很有用。

###  Paginate with Ranges
对于有可能产生大量数据的返回值进行分页，请求头中用Content-Range来标示分页。可参考[Heroku Platform API on Ranges][heroku-api-range]中对于请求和返回的 headers, status codes, limits, ordering, and page-walking的详细描述。

Request
-----------

### Return appropriate status code
对于每个请求的返回值，应该返回合适的HTTP code。成功的请求返回值的HTTP code 应该遵循如下：

- 200： GET 请求成功调用，或者 DELETE， PUT 同步请求调用成功。
- 201： POST同步请求成功调用。
- 202： POST， DELETE或者PUT异步请求成功调用。
- 206： 成功收到GET请求，但是至返回部分结果。具体查看[Paginate][paginator]

注意认证/授权出错的返回值code：

* 401 Unauthorized：用户未认证
* 403 Forbidden: 用户未授权访问具体资源

对于错误的返回值给予更合适的code：

* 422 Unprocessable Entity：  用户请求正确，但是传递了无效的参数
* 429 Too Many Requests：请求过快，稍后重试
* 500 Internal Server Error：服务器出错，检查服务器状态并且/或者 报告异常

请参考[HTTP response code spec][http-code]来处理各种用户或者服务器的错误。

### Accept serialized JSON in request bodies
服务器只接受JSON序列化数据的PUT/PATCH/POST请求，不接受form-encoded数据，这样可以保持请求和返回都是JSON数据。

### Use consistent path formats
####  Resource names
对于资源的命名， 添加版本信息，除非是系统中必须保持唯一的资源（比如，在大多数系统中，用户的账号信息总是唯一的）。这样做，可以保证用户对于特定资源访问的持久唯一性。

#### Actions
对于每个资源的操作，不推荐采用特殊的操作。如果需要特殊操作，推荐将具体的操作表示添加在actions路径之后。
```
 /resources/:resource/actions/:action
```
例如：
```
 /runs/{run_id}/actions/stop
```

###  Downcase paths and attributes

API的路径应该由小写字母和中划线组成：
```
service-api.com/users
service-api.com/app-setups
```

传递参数也应该又小写字母组成，但是需要用下划线，这样组成的变量在Javascript中不需要双引号扩起来：
```
service_class: "first"
```

### Support non-id dereferencing for convenience

有些情况下， 用户请求需要提供资源ID，这会很不方便。例如，对于Heroku 的app，用户知道app name，但是服务器的app资源是通过UUID来标识的，这种情况，服务器就应该同时接收id和app name作为参数：
```
$ curl https://service.com/apps/{app_id_or_name}
$ curl https://service.com/apps/97addcf0-c182
$ curl https://service.com/apps/www-prod
```

而不是仅仅接收IDs（例如97addcf0-c182）

### Minimize path nesting
如果数据的层级关系反映在API路径上，就会出现多级的路径：
```
 /orgs/{org_id}/apps/{app_id}/dynos/{dyno_id}
```

推荐将资源绑定在根目录层级上。层级用来指示资源集合的关系。例如，一个dyno属于一个app，一个app属于一个org：
```
/orgs/{org_id}
/orgs/{org_id}/apps
/apps/{app_id}
/apps/{app_id}/dynos
/dynos/{dyno_id}
```

Response
------------

### Provide resource (UU)IDs
对于每个资源，都提供一个UUID，除非你有充分的理由不用。使用一个全局唯一的ID，甚至在任何一台服务器实例，以及其他资源中都是唯一的，尤其是自增长的ID。
对于UUID，采用中划线连接小写字母的格式：
```
"id": "01234567-89ab-cdef-0123-456789abcdef"
```

###  Provide standard timestamps
记录操作的时间戳，包括create\_at 和 update_at：
```
 {
  ...
  "created_at": "2012-01-01T12:00:00Z",
  "updated_at": "2012-01-01T13:00:00Z",
  ...
}
```
这些时间戳并不是对所有资源都有用，这种情况下，可以省略。

###  Use UTC times formatted in ISO8601

接收并且返回的时间都是UTC时间，采用ISO8601标准的格式：
```
"finished_at": "2012-01-01T12:00:00Z"
```

### Nest foreign key relations
对于序列化的外键，应该包裹一个层级：
```
{
  "name": "service-production",
  "owner": {
    "id": "5d8201b0..."
  },
  ...
}
```

而不是：
```
{
  "name": "service-production",
  "owner_id": "5d8201b0...",
  ...
}
```

这种方式可以方便我们内联更多信息而不用改变整个response的结构，或者引入新的根字段：
```
{
  "name": "service-production",
  "owner": {
    "id": "5d8201b0...",
    "name": "Alice",
    "email": "alice@heroku.com"
  },
  ...
}
```

###  Generate structured errors
应该创建一致的，有组织的错误返回值，例如，包含一个机器能识别的错误id，一个人能读懂的错误message，以及一个备选的url地址，其中有更多的错误信息以及错误处理方法：
```
HTTP/1.1 429 Too Many Requests
{
  "id":      "rate_limit",
  "message": "Account reached its API rate limit.",
  "url":     "https://docs.service.com/rate-limits"
}
```

同时，以文档的方式标明用户可能会遇到的错误id和错误信息格式。

###  Show rate limit status
为了保持服务的可靠，需要限制用户的请求次数和频率。可以采用[token bucket algorithm][token_bucket] 来量化用户请求。

### Keep JSON minified in all responses
多余的空格和Tab只会加大JSON请求的数据大小，实际上很多客户端或者用户自己都会自动的格式化JSON输出，所以完全可以压缩JSON返回值：
```
{"beta":false,"email":"alice@heroku.com","id":"01234567-89ab-cdef-0123-456789abcdef","last_login":"2012-01-01T12:00:00Z", "created_at":"2012-01-01T12:00:00Z","updated_at":"2012-01-01T12:00:00Z"}
```

而不是返回格式化的JSON:
```
{
   "beta": false,
   "email": "alice@heroku.com",
  "id": "01234567-89ab-cdef-0123-456789abcdef",
  "last_login": "2012-01-01T12:00:00Z",
  "created_at": "2012-01-01T12:00:00Z",
  "updated_at": "2012-01-01T12:00:00Z"
}
```

可以考虑通过开关来控制返回值，从而返回给客户端可视化的数据。可以采用请求中加参数（?pretty=true）或者请求Header中定义参数（例如：Accept: application/vnd.heroku+json; version=3; indent=4;）等方式。

Artifacts
-----------

### Provide machine-readable JSON schema
提供一个机器可读的标准来具体定义一个API，可以采用[prmd][prmd]管理你的这些标准，并且保证该标准可以通过*prmd verify*的验证。
###  Provide human-readable docs
提供一份可读性强的文档方便开发者理解你的API。

如果使用*prmd*来定义API的格式，你可以轻松地通过*prmd doc*生成一个基于Markdown的文档，其中包含所有API endpoint的描述。

除此之外，应该提供API的描述如下：

* 认证， 包括如何获取和使用认证tokens
* API的版本和稳定性，包括如何选择不同版本的API
* 通用的API请求和返回的headers
* 各种语言的API调用例子

### Provide executable examples
提供可被直接在终端执行的API调用例子。最好是提供详细的逐步操作例子，减少用户调用API可能需要的工作：
```
$ export TOKEN=... # acquire from dashboard
$ curl -is https://$TOKEN@service.com/users
```
如果采用*prmd doc* 来生成API文档，同时也可以通过其生成每个API的调用实例。

###  Describe stability
根据具体开发的稳定性和成熟度，清晰描述服务的每个API， 服务的稳定性，例如：**prototype/development/production**

参考[Heroku API compatibility policy][api-compatibility] ，帮助你维护API的稳定性和版本切换管理。

一旦你的API被声明为production和稳定的，就不要进行不能向后兼容的改动，如果非要改动导致不能向后兼容，则应该创建一个新的API版本，作为当前的增量版本。

----------

英文原版： https://github.com/interagent/http-api-design

[paginator]: http://localhost.com
[http-code]:http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
[token_bucket]:http://en.wikipedia.org/wiki/Token_bucket
[api-compatibility]:https://devcenter.heroku.com/articles/api-compatibility-policy
[prmd]:https://github.com/interagent/prmd
[etag]:http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.19
[heroku-api-range]:https://devcenter.heroku.com/articles/platform-api-reference#ranges
