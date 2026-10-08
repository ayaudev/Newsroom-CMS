const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, admin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const {
  createNews,
  getAllNewsAdmin,
  getNewsById,
  updateNews,
  deleteNews,
  toggleFeatured,
  getDashboardStats
} = require('../controllers/adminNewsController');

// Validation rules
const newsValidation = [
 body('title').trim().notEmpty().isLength({max:200}).withMessage('Укажите название до 200 символов'),
 body('content').trim().notEmpty().withMessage('Текст обязателен'),
 body('category').trim().notEmpty().withMessage('Выберите категорию')
];

// All routes require authentication and admin role
router.use(protect, admin);

const submissions = require('../controllers/submissionController');
router.param('id',(req,res,next,id)=>{req.params.id=id.toLowerCase();next();});
router.get('/submissions',submissions.listReviews);
router.get('/submissions/:id',submissions.getReview);
router.put('/submissions/:id',submissions.editReview);
router.patch('/submissions/:id/decision',submissions.decide);

// Dashboard stats
router.get('/stats', getDashboardStats);
const comments = require('../controllers/commentController');
const categories = require('../models/Category');
const wrap = require('../middleware/async');
router.get('/comments', comments.getModerationQueue);
router.patch('/comments/:id/status', comments.moderateComment);
router.delete('/comments/:id', comments.deleteComment);
router.get('/categories', wrap(async(req,res)=>res.json({success:true,data:await categories.list()})));
router.post('/categories', wrap(async(req,res)=>{
 const {name,slug}=req.body;
 if(typeof name!=='string'||!name.trim()||name.trim().length>80||typeof slug!=='string'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)return res.status(400).json({success:false,message:'Укажите название и slug латиницей'});
 res.status(201).json({success:true,data:await categories.create({name:name.trim(),slug})});
}));
router.delete('/categories/:id', wrap(async(req,res)=>{
 if(!await categories.remove(req.params.id))return res.status(404).json({success:false,message:'Категория не найдена'});
 res.json({success:true,message:'Категория удалена'});
}));

// CRUD routes
router.route('/news')
  .get(getAllNewsAdmin)
  .post(newsValidation, validate, createNews);

router.route('/news/:id')
  .get(getNewsById)
  .put(updateNews)
  .delete(deleteNews);

router.patch('/news/:id/featured', toggleFeatured);

// Upload image
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Загрузите изображение'
    });
  }
  res.status(200).json({
    success: true,
    data: {
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`
    }
  });
});

module.exports = router;
