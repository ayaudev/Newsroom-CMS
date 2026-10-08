const Submission = require('../models/Submission');
const {preparePostInput,bad} = require('../utils/postInput');
const wrap = require('../middleware/async');
const allowedStatuses=['draft','PENDING_REVIEW','published','rejected','archived'];
const filters = req => {
 if(req.query.status && !allowedStatuses.includes(req.query.status))throw bad('Недопустимый статус');
 return {page:req.query.page,limit:req.query.limit,status:req.query.status};
};
exports.listOwn=wrap(async(req,res)=>res.json({success:true,...await Submission.listOwn(req.user.id,filters(req))}));
exports.getOwn=wrap(async(req,res)=>res.json({success:true,data:await Submission.getOwn(req.params.id,req.user.id)}));
exports.create=wrap(async(req,res)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw bad('Проверьте поля публикации');
 const {intent='submit',...body}=req.body;
 if(!['draft','submit'].includes(intent))throw bad('Выберите сохранение черновика или отправку на проверку');
 const data=await preparePostInput(body,{user:true});
 res.status(201).json({success:true,data:await Submission.create(data,req.user.id,intent)});
});
exports.editOwn=wrap(async(req,res)=>{
 const data=await preparePostInput(req.body,{partial:true,user:true});
 res.json({success:true,data:await Submission.editOwn(req.params.id,req.user.id,data)});
});
exports.submitOwn=wrap(async(req,res)=>{
 if(Object.keys(req.body||{}).length)throw bad('Статус и автор назначаются сервером');
 res.json({success:true,data:await Submission.submitOwn(req.params.id,req.user.id)});
});
exports.listReviews=wrap(async(req,res)=>res.json({success:true,...await Submission.listReviews(filters(req))}));
exports.getReview=wrap(async(req,res)=>res.json({success:true,data:await Submission.getReview(req.params.id)}));
exports.editReview=wrap(async(req,res)=>res.json({success:true,data:await Submission.editReview(req.params.id,req.user.id,await preparePostInput(req.body,{partial:true,user:true}))}));
exports.decide=wrap(async(req,res)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw bad('Проверьте решение редакции');
 if(Object.keys(req.body||{}).some(key=>!['decision','reason','changes'].includes(key)))throw bad('Переданы недопустимые поля решения');
 const changes=req.body.changes===undefined?{}:await preparePostInput(req.body.changes,{partial:true,user:true});
 res.json({success:true,data:await Submission.decide(req.params.id,req.user.id,req.body.decision,req.body.reason,changes)});
});
