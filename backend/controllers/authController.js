const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const RevokedToken = require('../models/RevokedToken');
const { normalizeName, normalizeEmail, validatePassword } = require('../utils/adminCredentials');
const wrap = require('../middleware/async');
const { query } = require('../config/db');
const token = id => jwt.sign({id},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRE||'7d',algorithm:'HS256',jwtid:randomUUID()});
const fail=(res,status,message)=>res.status(status).json({success:false,message});
const register = role => wrap(async(req,res)=>{
 let {name,email,password}=req.body;
 if(role==='admin'){
  try{name=normalizeName(name);email=normalizeEmail(email);validatePassword(password);}
  catch(error){return fail(res,400,error.message);}
 }
 if(await User.findByEmail(email))return fail(res,400,'Эта электронная почта уже зарегистрирована');
 const user=await User.create({name,email,password,role});
 res.status(201).json({success:true,data:role==='admin'?user:{...user,token:token(user.id)}});
});
exports.register=register('user');exports.registerAdmin=register('admin');
exports.login=wrap(async(req,res)=>{
 const user=await User.findByEmail(req.body.email);
 if(!user||!await bcrypt.compare(req.body.password,user.password))return fail(res,401,'Неверная почта или пароль');
 delete user.password;res.json({success:true,data:{...user,token:token(user.id)}});
});
exports.getMe=wrap(async(req,res)=>{
 const favorites=(await query("SELECT p.id AS \"_id\",p.title,p.slug,p.image FROM favorites f JOIN posts p ON p.id=f.post_id WHERE f.user_id=$1 AND p.status='published'",[req.user.id])).rows;
 res.json({success:true,data:{...req.user,favorites}});
});
exports.updateProfile=wrap(async(req,res)=>{
 const {name,avatar}=req.body;
 if(name!==undefined&&(typeof name!=='string'||!name.trim()||name.trim().length>50))return fail(res,400,'Имя должно содержать от 1 до 50 символов');
 if(avatar!==undefined&&(typeof avatar!=='string'||(avatar&&!/^https?:\/\//i.test(avatar))))return fail(res,400,'Укажите корректную ссылку на аватар');
 res.json({success:true,data:await User.update(req.user.id,{name,avatar})});
});
exports.changePassword=wrap(async(req,res)=>{
 const {currentPassword,newPassword}=req.body;
 if(req.user.role==='admin'){try{validatePassword(newPassword);}catch(error){return fail(res,400,error.message);}}
 if(typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword.length<6)return fail(res,400,'Пароль должен содержать минимум 6 символов');
 const user=await User.findByEmail(req.user.email);
 if(!await bcrypt.compare(currentPassword,user.password))return fail(res,401,'Текущий пароль неверен');
 await User.changePassword(user.id,newPassword);res.json({success:true,message:'Пароль изменён',token:token(user.id)});
});

exports.logout=wrap(async(req,res)=>{
 await RevokedToken.revoke(req.auth.token,req.auth.expiresAt);
 res.json({success:true,message:'Вы вышли из аккаунта'});
});
