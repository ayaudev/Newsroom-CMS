require('dotenv').config();
const fs=require('fs/promises');
const path=require('path');
const {createHash,randomUUID}=require('crypto');
const {transaction,pool}=require('../config/db');
const clean=require('../utils/content');
const oid=value=>String(value?.$oid||value?._id?.$oid||value?._id||value||'');
function uuid(value){const id=oid(value);if(!id)throw new Error('В экспорте отсутствует идентификатор');if(/^[0-9a-f-]{36}$/i.test(id))return id;const hash=createHash('sha256').update('newsroom-mongo:'+id).digest('hex');return hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);}
function date(value){if(!value)return null;const raw=value.$date??value;return typeof raw==='object'&&raw.$numberLong?new Date(Number(raw.$numberLong)):new Date(raw);}
async function load(folder,file){const text=await fs.readFile(path.join(folder,file),'utf8');try{const value=JSON.parse(text);return Array.isArray(value)?value:[value];}catch{return text.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));}}
async function importMongo(folder){
 const users=await load(folder,'users.json'),posts=await load(folder,'news.json'),comments=await load(folder,'comments.json');
 await transaction(async client=>{
  for(const user of users){if(!/^\$2[aby]\$/.test(user.password||''))throw new Error('Экспорт должен содержать bcrypt-хеши паролей пользователей');await client.query('INSERT INTO users(id,name,email,password,role,avatar,created_at) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,now())) ON CONFLICT(id) DO NOTHING',[uuid(user),user.name,user.email.toLowerCase(),user.password,user.role||'user',user.avatar||'',date(user.createdAt)]);}
  for(const post of posts){
   const category=String(post.category||'local');await client.query('INSERT INTO categories(id,slug,name) VALUES($1,$2,$3) ON CONFLICT(slug) DO NOTHING',[randomUUID(),category,category]);
   const status=post.status||'draft';
   await client.query(`INSERT INTO posts(id,title,slug,content,summary,category_id,author_id,tags,image,status,views,is_featured,published_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,(SELECT id FROM categories WHERE slug=$6),$7,$8,$9,$10,$11,$12,$13,COALESCE($14,now()),COALESCE($15,now())) ON CONFLICT(id) DO NOTHING`,[uuid(post),post.title,post.slug||'post-'+uuid(post),clean(post.content),post.summary||'',category,uuid(post.author),post.tags||[],post.image||'',status,post.views||0,post.isFeatured||false,status==='published'?(date(post.publishedAt)||date(post.createdAt)||new Date()):date(post.publishedAt),date(post.createdAt),date(post.updatedAt)]);
   for(const user of post.likes||[])await client.query('INSERT INTO post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[uuid(post),uuid(user)]);
  }
  // Insert parents first and assign relationships after every comment exists.
  for(const comment of comments){await client.query('INSERT INTO comments(id,content,post_id,user_id,status,is_edited,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,now()),COALESCE($8,now())) ON CONFLICT(id) DO NOTHING',[uuid(comment),comment.content,uuid(comment.news),uuid(comment.user),comment.status||'pending',comment.isEdited||false,date(comment.createdAt),date(comment.updatedAt)]);}
  for(const comment of comments){if(comment.parentComment){const parent=comments.find(c=>oid(c)===oid(comment.parentComment));if(!parent||oid(parent.news)!==oid(comment.news))throw new Error('Неверная связь между комментариями');await client.query('UPDATE comments SET parent_id=$2 WHERE id=$1',[uuid(comment),uuid(parent)]);}for(const user of comment.likes||[])await client.query('INSERT INTO comment_likes(comment_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[uuid(comment),uuid(user)]);}
  for(const user of users)for(const post of user.favorites||[])await client.query('INSERT INTO favorites(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[uuid(post),uuid(user)]);
 });
 console.log('Импорт завершён: '+users.length+' пользователей, '+posts.length+' публикаций, '+comments.length+' комментариев.');
}
if(require.main===module){const folder=process.argv[2];if(!folder){console.error('Использование: npm run import:mongo -- путь-к-экспорту');process.exitCode=1;pool.end();}else importMongo(folder).catch(e=>{console.error('Импорт отменён: '+e.message);process.exitCode=1;}).finally(()=>pool.end());}
module.exports={importMongo,uuid};
