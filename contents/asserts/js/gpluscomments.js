/**
 *
 * Created with JetBrains WebStorm.
 * User: chixq
 * Date: 9/15/13
 * Time: 4:37 PM
 * To change this template use File | Settings | File Templates.
 */
function openComments(){
    document.writeln("div id=\'gpluscomments\'></div>");
    document.writeln("  <script src=\'https://apis.google.com/js/plusone.js\' type=\'text/javascript\'></script>");
    document.writeln("  <script>");
    document.writeln("    gapi.comments.render(\'gpluscomments\', {href: \'{{ site.production_url }}{{ page.url }}\', first_party_property: \'BLOGGER\', view_type: \'FILTERED_POSTMOD\'})");
    document.writeln("  </script>");
}
function display(id){
    var target = document.getElementById(id);
    target.style.display=target.style.display=="none"?"block":"none";
}
function renderComments(){
    gapi.comments.render('gpluscomments', {href: window.location.href, first_party_property: 'BLOGGER', view_type: 'FILTERED_POSTMOD'})
}


