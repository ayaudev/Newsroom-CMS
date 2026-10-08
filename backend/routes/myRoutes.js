const express = require('express');
const {protect} = require('../middleware/auth');
const upload = require('../middleware/upload');
const controller = require('../controllers/submissionController');
const router = express.Router();
router.use(protect);
router.param('id',(req,res,next,id)=>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return res.status(400).json({success:false,message:'Некорректный идентификатор'});
 req.params.id=id.toLowerCase();next();
});
router.route('/posts').get(controller.listOwn).post(controller.create);
router.route('/posts/:id').get(controller.getOwn).put(controller.editOwn);
router.post('/posts/:id/submit',controller.submitOwn);
router.post('/upload',upload.single('image'),(req,res)=>{
 if(!req.file)return res.status(400).json({success:false,message:'Загрузите изображение'});
 res.json({success:true,data:{filename:req.file.filename,path:'/uploads/'+req.file.filename}});
});
module.exports=router;
