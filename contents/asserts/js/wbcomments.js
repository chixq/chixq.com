function renderWeibo() {
    var url = "http://widget.weibo.com/distribution/comments.php?width=0&url=auto&border=1&skin=9&ralateuid=1823592717&appkey=2267330388&iframskin=9&dpc=1";
    url = url.replace("url=auto", "url=" + encodeURIComponent(document.URL));
    var wbcomments = document.getElementById("gpluscomments");
    wbcomments.style.height = "600px";
    wbcomments.innerHTML = ('<iframe id="WBCommentFrame" src="' + url + '" scrolling="no" frameborder="0" style="width:100%;height:600px;"></iframe>');
}