var scrollTimer = null;

$(window).scroll(function () {
    var scrollTop = $(this).scrollTop();
    var viewportHeight = $(this).height(),
        scrollbarHeight = viewportHeight / $(document).height() * viewportHeight,
        progress = scrollTop / ($(document).height() - viewportHeight),
        distance = progress * (viewportHeight - scrollbarHeight) + scrollbarHeight / 2 - $('#indicator').height() / 2
        ;

    if($('h2').length !== 0){
        $('h2').each(function (i, e) {
            if (scrollTop > (e.offsetTop - viewportHeight/2)){
                $('#indicator').text(e.innerHTML);
            }
            if (scrollTop < $('h2')[0].offsetTop) {
                $('#indicator').text($('h1')[0].innerHTML);
            }
        });
    } else if ($('h3').length !==0 ) {
        $('h3').each(function (i, e) {
            if (scrollTop > (e.offsetTop - viewportHeight / 2)) {
                $('#indicator').text(e.innerHTML);
            }
            if (scrollTop < $('h3')[0].offsetTop) {
                $('#indicator').text($('h2')[0].innerHTML);
            }
        });
    }else{
        $('#indicator').text($('h1')[0].innerHTML)
    }

    $('#indicator')
        .css('top', distance)
        .fadeIn(100)
    ;
    // Fade out the annotation after 1 second of no scrolling.
    if (scrollTimer !== null) {
        clearTimeout(scrollTimer);
    }
    scrollTimer = setTimeout(function () {
        $('#indicator').fadeOut();
    }, 800);
});
