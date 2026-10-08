const Post = require('../models/Post');
const Category = require('../models/Category');
const wrap = require('../middleware/async');
const missing=res=>res.status(404).json({success:false,message:'Публикация не найдена'});
const list=extra=>wrap(async(req,res)=>res.json({success:true,...await Post.list({page:req.query.page,limit:req.query.limit,category:req.query.category,search:req.query.search,tag:req.query.tag,...extra(req),status:'published'},req.user?.id)}));
exports.getPublishedNews=list(()=>({}));
exports.getLatestNews=list(()=>({}));
exports.getFeaturedNews=list(()=>({featured:true}));
exports.getTrendingNews=list(()=>({trending:true}));
exports.getNewsByCategory=list(req=>({category:req.params.category}));
exports.getFavorites=list(()=>({favorite:true}));
exports.getNewsBySlug=wrap(async(req,res)=>{
 const post=await Post.get(req.params.slug,req.user?.id,true,true);if(!post)return missing(res);
 await Post.view(post.id);res.json({success:true,data:{...post,views:post.views+1}});
});
exports.getRelatedNews=wrap(async(req,res)=>{
 const post=await Post.get(req.params.id,null,false,true);if(!post)return missing(res);
 res.json({success:true,...await Post.list({related:post,status:'published',limit:5})});
});
exports.getCategories=wrap(async(req,res)=>res.json({success:true,data:await Category.list()}));
const toggle=favorite=>wrap(async(req,res)=>{
 const result=await Post.toggle(req.params.id,req.user.id,favorite);if(!result)return missing(res);
 res.json({success:true,...result,message:favorite?(result.isFavorited?'Добавлено в избранное':'Удалено из избранного'):(result.isLiked?'Отметка добавлена':'Отметка удалена')});
});
exports.toggleLike=toggle(false);exports.toggleFavorite=toggle(true);
