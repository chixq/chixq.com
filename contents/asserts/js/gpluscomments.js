/**
 *
 * Created with JetBrains WebStorm.
 * User: chixq
 * Date: 9/15/13
 * Time: 4:37 PM
 * To change this template use File | Settings | File Templates.
 */
//window.onload = renderCommentsCounts();
var commentUnfold = false;
function display(id){
    var target = document.getElementById(id);
    target.style.display=target.style.display=="none"?"block":"none";
}
function renderComments(){
    var commentIcon = document.getElementById('addcomment');
    commentIcon.className='icon-spin6 animate-spin';
    if(!commentUnfold) {
        gapi.comments.render('gpluscomments', {href: window.location.href, first_party_property: 'BLOGGER', view_type: 'FILTERED_POSTMOD'})
    }
    commentUnfold = true;
    setTimeout(recover, 2000);
    function recover(){
        commentIcon.className ="icon-comment-alt";
    }
}

function renderCommentsCounts(){
    gapi.commentcount.render('commentscounter', {
        href: window.location
    });
}
