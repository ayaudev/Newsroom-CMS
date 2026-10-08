const Post = require('../models/Post');
const Submission = require('../models/Submission');
const {preparePostInput,fields} = require('../utils/postInput');
const wrap = require('../middleware/async');
const missing=res=>res.status(404).json({success:false,message:'Публикация не найдена'});
const save=partial=>wrap(async(req,res)=>{
 const post=partial?await Post.get(req.params.id):null;
 if(partial&&!post)return missing(res);
 const data=await preparePostInput(req.body,{partial});
 if(post?.activeRevisionId){
  const revision=await Submission.getReview(post.activeRevisionId);
  if(revision.status==='PENDING_REVIEW'){
   if(data.status&&data.status!=='published')return res.status(409).json({success:false,message:'Используйте раздел «Новости на проверке» для решения редакции'});
   const editable=Object.fromEntries(fields.filter(key=>data[key]!==undefined).map(key=>[key,data[key]]));
   if(data.status==='published')await Submission.decide(revision.id,req.user.id,'approve',undefined,editable);
   else await Submission.editReview(revision.id,req.user.id,editable);
   return res.json({success:true,data:await Submission.getOwn(post.id,post.authorUserId)});
  }
  if(revision.status==='draft'||revision.status==='rejected')return res.status(409).json({success:false,message:'Автор ещё не отправил эту версию на проверку'});
 }
 const saved=partial?await Post.update(req.params.id,data,req.user.id):await Post.create(data,req.user.id);
 res.status(partial?200:201).json({success:true,data:saved});
});
exports.createNews=save(false);exports.updateNews=save(true);
exports.getAllNewsAdmin=wrap(async(req,res)=>res.json({success:true,...await Post.list({...req.query,admin:true})}));
exports.getNewsById=wrap(async(req,res)=>{
 const post=await Post.get(req.params.id);if(!post)return missing(res);
 res.json({success:true,data:post.activeRevisionId?await Submission.getOwn(post.id,post.authorUserId):post});
});
exports.deleteNews=wrap(async(req,res)=>{if(!await Post.remove(req.params.id))return missing(res);res.json({success:true,message:'Публикация удалена'});});
exports.toggleFeatured=wrap(async(req,res)=>{const post=await Post.get(req.params.id);if(!post)return missing(res);res.json({success:true,data:await Post.update(post.id,{isFeatured:!post.isFeatured})});});
exports.getDashboardStats=wrap(async(req,res)=>res.json({success:true,data:await Post.stats()}));
