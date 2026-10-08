const Comment = require('../models/Comment');
const Post = require('../models/Post');
const wrap = require('../middleware/async');
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const valid=content=>typeof content==='string'&&content.trim().length>0&&content.trim().length<=1000;
exports.getComments=wrap(async(req,res)=>{
 if(!await Post.get(req.params.newsId,null,false,true))return fail(res,404,'Публикация не найдена');
 res.json({success:true,...await Comment.list({page:req.query.page,limit:req.query.limit,postId:req.params.newsId,status:'approved'})});
});
exports.addComment=wrap(async(req,res)=>{
 if(!valid(req.body.content))return fail(res,400,'Комментарий должен содержать от 1 до 1000 символов');
 const post=await Post.get(req.params.newsId,null,false,true);if(!post)return fail(res,404,'Публикация не найдена');
 const parentId=req.body.parentCommentId;
 if(parentId){const parent=await Comment.get(parentId);if(!parent||parent.news!==post.id||parent.status!=='approved'||parent.parentComment)return fail(res,400,'Ответ возможен только на одобренный комментарий этой публикации');}
 const data=await Comment.create({content:req.body.content.trim(),postId:post.id,userId:req.user.id,parentId});
 res.status(201).json({success:true,data,message:'Комментарий отправлен на модерацию'});
});
exports.updateComment=wrap(async(req,res)=>{
 const comment=await Comment.get(req.params.id);if(!comment)return fail(res,404,'Комментарий не найден');
 if(comment.user._id!==req.user.id)return fail(res,403,'Можно редактировать только свои комментарии');
 if(!valid(req.body.content))return fail(res,400,'Комментарий должен содержать от 1 до 1000 символов');
 res.json({success:true,data:await Comment.update(comment.id,req.body.content.trim()),message:'Комментарий повторно отправлен на модерацию'});
});
exports.deleteComment=wrap(async(req,res)=>{
 const comment=await Comment.get(req.params.id);if(!comment)return fail(res,404,'Комментарий не найден');
 if(comment.user._id!==req.user.id&&req.user.role!=='admin')return fail(res,403,'Недостаточно прав');
 await Comment.remove(comment.id);res.json({success:true,message:'Комментарий удалён'});
});
exports.toggleCommentLike=wrap(async(req,res)=>{const result=await Comment.toggleLike(req.params.id,req.user.id);if(!result)return fail(res,404,'Комментарий не найден');res.json({success:true,...result});});
exports.getModerationQueue=wrap(async(req,res)=>{
 if(req.query.status&&!['pending','approved','rejected'].includes(req.query.status))return fail(res,400,'Недопустимый статус');
 res.json({success:true,...await Comment.list({...req.query,admin:true})});
});
exports.moderateComment=wrap(async(req,res)=>{
 if(!['pending','approved','rejected'].includes(req.body.status))return fail(res,400,'Недопустимый статус');
 if(!await Comment.get(req.params.id))return fail(res,404,'Комментарий не найден');
 res.json({success:true,data:await Comment.moderate(req.params.id,req.body.status)});
});
