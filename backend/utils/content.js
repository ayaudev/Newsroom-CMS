const sanitize = require('sanitize-html');
module.exports = content => sanitize(content,{allowedTags:['p','br','strong','b','em','i','u','h2','h3','h4','ul','ol','li','blockquote','a','img','hr','pre','code'],allowedAttributes:{a:['href','title'],img:['src','alt','width','height']},allowedSchemes:['http','https','mailto'],allowProtocolRelative:false});
