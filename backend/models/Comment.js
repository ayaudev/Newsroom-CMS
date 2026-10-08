const { query, transaction } = require('../config/db');
const { randomUUID } = require('crypto');
const select = `SELECT c.id AS "_id",c.id,c.content,c.post_id AS news,c.parent_id AS "parentComment",c.status,c.is_edited AS "isEdited",c.created_at AS "createdAt",c.updated_at AS "updatedAt",json_build_object('_id',u.id,'name',u.name,'avatar',u.avatar) AS "user",p.title AS "postTitle",p.slug AS "postSlug",(SELECT count(*)::int FROM comment_likes l WHERE l.comment_id=c.id) AS "likesCount" FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id`;
exports.get = async id => (await query(select+' WHERE c.id::text=$1',[id])).rows[0];
exports.list = async ({postId,status,page=1,limit=20,admin=false}) => {
 page=Math.max(1,parseInt(page,10)||1);limit=Math.min(100,Math.max(1,parseInt(limit,10)||20));
 const values=[],conditions=[];
 if(postId){values.push(postId);conditions.push('c.post_id::text=$'+values.length);}
 if(status){values.push(status);conditions.push('c.status=$'+values.length);}
 if(!admin)conditions.push("p.status='published'",'c.parent_id IS NULL');
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const total=Number((await query('SELECT count(*) FROM ('+select+where+') s',values)).rows[0].count);
 const data=(await query(select+where+' ORDER BY c.created_at DESC,c.id LIMIT $'+(values.length+1)+' OFFSET $'+(values.length+2),[...values,limit,(page-1)*limit])).rows;
 if(!admin)for(const comment of data)comment.replies=(await query(select+" WHERE c.parent_id=$1 AND c.status='approved' AND p.status='published' ORDER BY c.created_at,c.id",[comment.id])).rows;
 return {data,total,count:data.length,totalPages:Math.ceil(total/limit),currentPage:page};
};
exports.create = async ({content,postId,userId,parentId}) => {
 const id=randomUUID();await query('INSERT INTO comments(id,content,post_id,user_id,parent_id) VALUES($1,$2,$3,$4,$5)',[id,content,postId,userId,parentId||null]);return exports.get(id);
};
exports.update = async (id,content)=>{await query("UPDATE comments SET content=$2,status='pending',is_edited=true,updated_at=now() WHERE id=$1",[id,content]);return exports.get(id);};
exports.moderate = async (id,status)=>{await query('UPDATE comments SET status=$2,updated_at=now() WHERE id=$1',[id,status]);return exports.get(id);};
exports.remove = async id => query('DELETE FROM comments WHERE id=$1',[id]);
exports.toggleLike = async (id,userId) => transaction(async client=>{
 const row=(await client.query("SELECT c.id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=$1 AND c.status='approved' AND p.status='published' FOR UPDATE OF c",[id])).rows[0];
 if(!row)return null;
 const deleted=await client.query('DELETE FROM comment_likes WHERE comment_id=$1 AND user_id=$2 RETURNING comment_id',[id,userId]);
 if(!deleted.rowCount)await client.query('INSERT INTO comment_likes(comment_id,user_id) VALUES($1,$2)',[id,userId]);
 return {isLiked:!deleted.rowCount,likesCount:Number((await client.query('SELECT count(*) FROM comment_likes WHERE comment_id=$1',[id])).rows[0].count)};
});
