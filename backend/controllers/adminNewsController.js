const Post = require('../models/Post');
const Category = require('../models/Category');
const clean = require('../utils/content');
const wrap = require('../middleware/async');
const missing=res=>res.status(404).json({success:false,message:'Публикация не найдена'});
async function validate(data,partial=false){
 for(const [key,max] of [['title',200],['content',100000],['summary',500]]){
  if(data[key]!==undefined&&(typeof data[key]!=='string'||data[key].length>max||(key!=='summary'&&!data[key].trim())))return 'Проверьте название, текст и краткое описание';
  if(!partial&&key!=='summary'&&data[key]===undefined)return 'Название и текст обязательны';
 }
 if(data.status!==undefined&&!['draft','published','archived'].includes(data.status))return 'Недопустимый статус публикации';
 if(data.isFeatured!==undefined&&typeof data.isFeatured!=='boolean')return 'Недопустимое значение избранной публикации';
 if(data.image!==undefined&&(typeof data.image!=='string'||(data.image&&!/^(https?:\/\/|\/uploads\/)/i.test(data.image))))return 'Укажите ссылку на изображение';
 if(data.category!==undefined||!partial){if(!(await Category.list()).some(c=>c.slug===data.category))return 'Выберите существующую категорию';}
 if(data.tags!==undefined){if(typeof data.tags==='string')data.tags=data.tags.split(',').map(t=>t.trim()).filter(Boolean);if(!Array.isArray(data.tags)||data.tags.some(t=>typeof t!=='string'||t.length>80)||data.tags.length>30)return 'Проверьте теги';}
}
const save=partial=>wrap(async(req,res)=>{
 if(partial&&!await Post.get(req.params.id))return missing(res);
 const error=await validate(req.body,partial);if(error)return res.status(400).json({success:false,message:error});
 if(req.body.content!==undefined){req.body.content=clean(req.body.content);if(!req.body.content.trim())return res.status(400).json({success:false,message:'Текст публикации пуст'});}
 const data=partial?await Post.update(req.params.id,req.body):await Post.create(req.body,req.user.id);
 res.status(partial?200:201).json({success:true,data});
});
exports.createNews=save(false);exports.updateNews=save(true);
exports.getAllNewsAdmin=wrap(async(req,res)=>res.json({success:true,...await Post.list({...req.query,admin:true})}));
exports.getNewsById=wrap(async(req,res)=>{const data=await Post.get(req.params.id);if(!data)return missing(res);res.json({success:true,data});});
exports.deleteNews=wrap(async(req,res)=>{if(!await Post.remove(req.params.id))return missing(res);res.json({success:true,message:'Публикация удалена'});});
exports.toggleFeatured=wrap(async(req,res)=>{const post=await Post.get(req.params.id);if(!post)return missing(res);res.json({success:true,data:await Post.update(post.id,{isFeatured:!post.isFeatured})});});
exports.getDashboardStats=wrap(async(req,res)=>res.json({success:true,data:await Post.stats()}));
