const { query, transaction } = require('../config/db');
const { randomUUID } = require('node:crypto');
const { fields, bad } = require('../utils/postInput');
const clean = require('../utils/content');
const conflict = message => Object.assign(new Error(message), {status:409});
const missing = () => Object.assign(new Error('Публикация не найдена'), {status:404});
const pending = 'PENDING_REVIEW';
const working = column => "CASE WHEN r.status IN ('draft','PENDING_REVIEW','rejected') THEN r."+column+' ELSE p.'+column+' END';
const ownerSelect = `SELECT p.id AS "_id",p.id,p.slug,r.id AS "revisionId",r.version,
 `+working('title')+` AS title,`+working('summary')+` AS summary,`+working('content')+` AS content,
 `+working('image')+` AS image,`+working('tags')+` AS tags,
 CASE WHEN r.status IN ('draft','PENDING_REVIEW','rejected') THEN r.status ELSE p.status END AS status,
 c.slug AS category,c.name AS "categoryName",p.author_user_id AS "authorUserId",
 json_build_object('_id',u.id,'id',u.id,'name',u.name,'avatar',u.avatar) AS author,
 r.original_submission AS "originalSubmission",r.submitted_at AS "submittedAt",
 r.reviewed_by_admin_id AS "reviewedByAdminId",r.reviewed_at AS "reviewedAt",r.rejection_reason AS "rejectionReason",
 p.status='published' AS "hasPublishedVersion",p.created_at AS "createdAt",COALESCE(r.updated_at,p.updated_at) AS "updatedAt"
 FROM posts p LEFT JOIN post_revisions r ON r.id=p.active_revision_id
 JOIN categories c ON c.id=`+working('category_id')+` JOIN users u ON u.id=p.author_user_id`;
const reviewSelect = `SELECT r.id AS "_id",r.id,r.post_id AS "postId",r.version,r.title,r.summary,r.content,r.image,r.tags,r.status,
 c.slug AS category,c.name AS "categoryName",p.slug,p.author_user_id AS "authorUserId",
 json_build_object('_id',u.id,'id',u.id,'name',u.name,'avatar',u.avatar) AS author,
 r.original_submission AS "originalSubmission",r.submitted_at AS "submittedAt",r.rejection_reason AS "rejectionReason",
 r.reviewed_by_admin_id AS "reviewedByAdminId",r.reviewed_at AS "reviewedAt",a.name AS "reviewerName",
 r.created_at AS "createdAt",r.updated_at AS "updatedAt",p.status='published' AS "hasPublishedVersion",
 p.active_revision_id=r.id AS "isCurrentVersion"
 FROM post_revisions r JOIN posts p ON p.id=r.post_id JOIN categories c ON c.id=r.category_id
 JOIN users u ON u.id=p.author_user_id LEFT JOIN users a ON a.id=r.reviewed_by_admin_id`;
const pageInfo = filters => ({page:Math.max(1,parseInt(filters.page,10)||1),limit:Math.min(100,Math.max(1,parseInt(filters.limit,10)||12))});
const result = (data,total,page,limit) => ({data,total,count:data.length,totalPages:Math.ceil(total/limit),currentPage:page});
const own = async (client,id,userId) => (await client.query(ownerSelect+' WHERE p.id::text=$1 AND p.author_user_id=$2',[id,userId])).rows[0];
exports.getOwn = async (id,userId) => {
 const data = await own({query},id,userId);
 if(!data) throw missing();
 data.history=(await query('SELECT id,version,status,submitted_at AS "submittedAt",reviewed_at AS "reviewedAt",rejection_reason AS "rejectionReason" FROM post_revisions WHERE post_id=$1 ORDER BY version DESC',[id])).rows;
 return data;
};
exports.listOwn = async (userId,filters={}) => {
 const {page,limit}=pageInfo(filters),values=[userId];
 let where=' WHERE p.author_user_id=$1';
 if(filters.status){values.push(filters.status);where+=" AND (CASE WHEN r.status IN ('draft','PENDING_REVIEW','rejected') THEN r.status ELSE p.status END)=$2";}
 const total=Number((await query('SELECT count(*) FROM ('+ownerSelect+where+') s',values)).rows[0].count);
 const data=(await query(ownerSelect+where+' ORDER BY COALESCE(r.updated_at,p.updated_at) DESC,p.id LIMIT $'+(values.length+1)+' OFFSET $'+(values.length+2),[...values,limit,(page-1)*limit])).rows;
 return result(data,total,page,limit);
};
exports.getReview = async id => {
 const data=(await query(reviewSelect+' WHERE r.id::text=$1',[id])).rows[0];
 if(!data) throw missing();return data;
};
exports.listReviews = async (filters={}) => {
 const {page,limit}=pageInfo(filters),status=filters.status||pending;
 const where=' WHERE r.status=$1 AND p.active_revision_id=r.id';
 const total=Number((await query('SELECT count(*) FROM ('+reviewSelect+where+') s',[status])).rows[0].count);
 const data=(await query(reviewSelect+where+' ORDER BY r.submitted_at,r.id LIMIT $2 OFFSET $3',[status,limit,(page-1)*limit])).rows;
 return result(data,total,page,limit);
};
async function lockPost(client,id,userId){
 const data=(await client.query('SELECT * FROM posts WHERE id::text=$1'+(userId?' AND author_user_id=$2':'')+' FOR UPDATE',userId?[id,userId]:[id])).rows[0];
 if(!data)throw missing();return data;
}
async function active(client,post){return post.active_revision_id?(await client.query('SELECT * FROM post_revisions WHERE id=$1 FOR UPDATE',[post.active_revision_id])).rows[0]:null;}
async function insertRevision(client,post,data){
 const id=randomUUID();
 const version=Number((await client.query('SELECT COALESCE(max(version),0)+1 AS version FROM post_revisions WHERE post_id=$1',[post.id])).rows[0].version);
 await client.query(`INSERT INTO post_revisions(id,post_id,version,title,summary,content,category_id,image,tags,status)
 VALUES($1,$2,$3,$4,$5,$6,(SELECT id FROM categories WHERE slug=$7),$8,$9,'draft')`,[id,post.id,version,data.title,data.summary||'',data.content,data.category,data.image||'',data.tags||[]]);
 await client.query('UPDATE posts SET active_revision_id=$2,updated_at=now() WHERE id=$1',[post.id,id]);
 return id;
}
async function editRevision(client,id,data){
 const columns={title:'title',summary:'summary',content:'content',image:'image',tags:'tags'};
 const values=[id],sets=['updated_at=now()'];
 for(const [key,column] of Object.entries(columns))if(data[key]!==undefined){values.push(data[key]);sets.push(column+'=$'+values.length);}
 if(data.category!==undefined){values.push(data.category);sets.push('category_id=(SELECT id FROM categories WHERE slug=$'+values.length+')');}
 await client.query('UPDATE post_revisions SET '+sets.join(',')+' WHERE id=$1',values);
}
async function submitRevision(client,post,id){
 const row=(await client.query(reviewSelect+' WHERE r.id=$1',[id])).rows[0];
 row.content=clean(row.content);
 if(!row.content.replace(/<[^>]*>/g,'').trim())throw bad('Текст публикации пуст');
 await editRevision(client,id,{content:row.content});
 const snapshot={authorUserId:post.author_user_id||post.author_id,categoryName:row.categoryName};
 for(const key of fields)snapshot[key]=row[key];
 await client.query("UPDATE post_revisions SET status='PENDING_REVIEW',original_submission=$2::jsonb,submitted_at=now(),updated_at=now() WHERE id=$1",[id,JSON.stringify(snapshot)]);
 await client.query("UPDATE posts SET status=CASE WHEN status='published' THEN status ELSE 'PENDING_REVIEW' END,updated_at=now() WHERE id=$1",[post.id]);
}
exports.create = async (data,userId,intent='submit') => {
 const id=randomUUID();
 await transaction(async client=>{
  const slug=data.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')+'-'+id.slice(0,8);
  const post=(await client.query(`INSERT INTO posts(id,title,slug,content,summary,category_id,author_id,tags,image,status)
   VALUES($1,$2,$3,$4,$5,(SELECT id FROM categories WHERE slug=$6),$7,$8,$9,'draft') RETURNING *`,[id,data.title,slug,data.content,data.summary||'',data.category,userId,data.tags||[],data.image||''])).rows[0];
  const revision=await insertRevision(client,post,data);
  if(intent==='submit')await submitRevision(client,post,revision);
 });
 return exports.getOwn(id,userId);
};
exports.editOwn = async (id,userId,data) => {
 await transaction(async client=>{
  const post=await lockPost(client,id,userId),revision=await active(client,post);
  if(revision?.status===pending)throw conflict('Материал уже на проверке. Дождитесь решения редакции.');
  if(revision?.status==='draft')await editRevision(client,revision.id,data);
  else {const current=await own(client,id,userId);await insertRevision(client,post,{...current,...data});}
  await client.query("UPDATE posts SET status=CASE WHEN status='published' THEN status ELSE 'draft' END,updated_at=now() WHERE id=$1",[id]);
 });
 return exports.getOwn(id,userId);
};
exports.submitOwn = async (id,userId) => {
 await transaction(async client=>{
  const post=await lockPost(client,id,userId),revision=await active(client,post);
  if(revision?.status===pending)throw conflict('Материал уже на проверке');
  if(revision?.status==='published'||(!revision&&post.status==='published'))throw conflict('Сначала сохраните новую версию материала');
  let revisionId=revision?.id;
  if(!revision||revision.status==='rejected')revisionId=await insertRevision(client,post,await own(client,id,userId));
  await submitRevision(client,post,revisionId);
 });
 return exports.getOwn(id,userId);
};
async function lockReview(client,id,adminId){
 if(!(await client.query("SELECT 1 FROM users WHERE id=$1 AND role='admin'",[adminId])).rowCount)throw Object.assign(new Error('Доступ разрешён только администратору'),{status:403});
 const info=(await client.query('SELECT post_id FROM post_revisions WHERE id::text=$1',[id])).rows[0];if(!info)throw missing();
 const post=await lockPost(client,info.post_id);
 const revision=await active(client,post);
 if(!revision||revision.id!==id||revision.status!==pending)throw conflict('Эта версия уже рассмотрена или заменена. Обновите список.');
 return {post,revision};
}
async function decide(client,post,revision,adminId,decision,reason){
 const approved=decision==='approve';
 if(approved){
  await client.query(`UPDATE posts SET title=r.title,summary=r.summary,content=r.content,category_id=r.category_id,image=r.image,tags=r.tags,
   status='published',published_at=now(),updated_at=now(),reviewed_by_admin_id=$3,reviewed_at=now(),rejection_reason=NULL
   FROM post_revisions r WHERE posts.id=$1 AND r.id=$2`,[post.id,revision.id,adminId]);
 }else{
  await client.query("UPDATE posts SET status=CASE WHEN status='published' THEN status ELSE 'rejected' END,reviewed_by_admin_id=$2,reviewed_at=now(),rejection_reason=$3,updated_at=now() WHERE id=$1",[post.id,adminId,reason||null]);
 }
 await client.query('UPDATE post_revisions SET status=$2,reviewed_by_admin_id=$3,reviewed_at=now(),rejection_reason=$4,updated_at=now() WHERE id=$1',[revision.id,approved?'published':'rejected',adminId,approved?null:reason||null]);
}
exports.editReview = async (id,adminId,data) => {
 await transaction(async client=>{await lockReview(client,id,adminId);await editRevision(client,id,data);});
 return exports.getReview(id);
};
exports.decide = async (id,adminId,decision,reason,data={}) => {
 if(!['approve','reject'].includes(decision))throw bad('Выберите одобрение или отклонение');
 if(reason!==undefined&&(typeof reason!=='string'||reason.length>1000))throw bad('Причина отклонения должна быть не длиннее 1000 символов');
 await transaction(async client=>{
  const {post,revision}=await lockReview(client,id,adminId);
  if(Object.keys(data).length)await editRevision(client,id,data);
  await decide(client,post,revision,adminId,decision,reason?.trim());
 });
 return exports.getReview(id);
};
