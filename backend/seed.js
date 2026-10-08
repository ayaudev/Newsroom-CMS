require('dotenv').config();
const User = require('./models/User');
const { pool } = require('./config/db');
async function seed(){
 const {ADMIN_EMAIL:email,ADMIN_PASSWORD:password}=process.env;
 if(!email||!password||password.length<8)throw new Error('Задайте ADMIN_EMAIL и ADMIN_PASSWORD (минимум 8 символов)');
 if(await User.findByEmail(email)){console.log('Пользователь уже существует; данные не изменены');return;}
 await User.create({name:process.env.ADMIN_NAME||'Администратор',email,password,role:'admin'});
 console.log('Администратор создан: '+email);
}
if(require.main===module)seed().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
module.exports=seed;
