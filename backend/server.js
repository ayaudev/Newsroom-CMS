require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, hasDatabaseConfiguration } = require('./config/db');
const app = express();
app.use(cors({origin:process.env.FRONTEND_URL || 'http://localhost:3000'}));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use('/uploads',express.static(path.join(__dirname,'uploads')));
// Validate UUID route parameters before PostgreSQL casting.
app.use((req,res,next)=>{
 const match=req.path.match(/\/(?:admin\/news|admin\/comments|admin\/categories|admin\/submissions|comments)\/([^/]+)/);
 if(match && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[1]))return res.status(400).json({success:false,message:'Некорректный идентификатор'});
 next();
});
app.use('/api/auth',require('./routes/authRoutes'));
app.use('/api/admin',require('./routes/adminRoutes'));
app.use('/api/news',require('./routes/newsRoutes'));
app.use('/api/posts',require('./routes/newsRoutes'));
app.use('/api/my',require('./routes/myRoutes'));
app.use('/api/comments',require('./routes/commentRoutes'));
app.get('/api/categories',require('./controllers/userNewsController').getCategories);
app.get('/api/health',require('./middleware/async')(async(req,res)=>{await pool.query('SELECT 1');res.json({success:true,message:'Newsroom CMS работает'});}));
app.use((req,res)=>res.status(404).json({success:false,message:'Маршрут не найден'}));
app.use((err,req,res,next)=>{
 const messages={'23505':'Такое значение уже существует','23001':'Категория используется в публикациях. Сначала перенесите их в другую категорию','23503':'Категория используется в публикациях или связанная запись не найдена','23502':'Заполните обязательные поля','23514':'Проверьте значения полей','22001':'Превышена допустимая длина текста','22P02':'Некорректный идентификатор или значение'};
 const status=messages[err.code]?400:err.code==='LIMIT_FILE_SIZE'?400:err.status||500;
 if(status>=500)console.error(err);
 res.status(status).json({success:false,message:messages[err.code]||(err.code==='LIMIT_FILE_SIZE'?'Изображение должно быть не больше 5 МБ':status<500?err.message:'Ошибка сервера. Повторите попытку позже')});
});
async function start(){
 if(!hasDatabaseConfiguration()||!process.env.JWT_SECRET)throw new Error('Укажите параметры PostgreSQL и JWT_SECRET в окружении');
 await pool.query('SELECT 1');
 const server=app.listen(process.env.PORT||5000,()=>console.log('Newsroom CMS: порт '+(process.env.PORT||5000)));
 const stop=()=>server.close(()=>pool.end());process.on('SIGTERM',stop);process.on('SIGINT',stop);return server;
}
if(require.main===module)start().catch(error=>{console.error(error.message);pool.end();process.exitCode=1;});
module.exports={app,start};
