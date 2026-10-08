const { query, transaction } = require('../config/db');
const { randomUUID } = require('crypto');
const select = `SELECT p.id AS "_id", p.id, p.title, p.slug, p.content, p.summary, c.slug AS category,
 c.id AS "categoryId", c.name AS "categoryName", p.tags, p.image, p.status, p.views,
 p.is_featured AS "isFeatured", p.published_at AS "publishedAt", p.created_at AS "createdAt", p.updated_at AS "updatedAt",
 json_build_object('_id',u.id,'name',u.name,'avatar',u.avatar) AS author,
 (SELECT count(*)::int FROM post_likes l WHERE l.post_id=p.id) AS "likesCount",
 EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=$1::uuid) AS "isLiked",
 EXISTS(SELECT 1 FROM favorites f WHERE f.post_id=p.id AND f.user_id=$1::uuid) AS "isFavorited"
 FROM posts p JOIN categories c ON c.id=p.category_id JOIN users u ON u.id=p.author_id`;
exports.list = async (filters={}, userId=null) => {
 const values=[userId], conditions=[];
 const add=(sql,value)=>{values.push(value);conditions.push(sql.replace('?', '$'+values.length));};
 if(filters.status) add('p.status=?',filters.status);
 if(filters.category) add('c.slug=?',filters.category);
 if(filters.search) add(`(p.title || ' ' || p.content || ' ' || array_to_string(p.tags,' ')) ILIKE ?`,'%'+filters.search+'%');
 if(filters.tag) add('?=ANY(p.tags)',filters.tag);
 if(filters.featured) conditions.push('p.is_featured=true');
 if(filters.favorite) add('EXISTS(SELECT 1 FROM favorites f WHERE f.post_id=p.id AND f.user_id=?)',userId);
 if(filters.related) { add('p.id<>?::uuid',filters.related.id); values.push(filters.related.category,filters.related.tags); conditions.push('(c.slug=$'+(values.length-1)+' OR p.tags && $'+values.length+'::text[])'); }
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const total=Number((await query('SELECT count(*) FROM ('+select+where+') s',values)).rows[0].count);
 const page=Math.max(1,parseInt(filters.page,10)||1),limit=Math.min(100,Math.max(1,parseInt(filters.limit,10)||10));
 const order=filters.trending?'p.views DESC, "likesCount" DESC, p.id':filters.admin?'p.created_at DESC,p.id':'p.published_at DESC,p.id';
 const data=(await query(select+where+' ORDER BY '+order+' LIMIT $'+(values.length+1)+' OFFSET $'+(values.length+2),[...values,limit,(page-1)*limit])).rows;
 return {data,total,count:data.length,totalPages:Math.ceil(total/limit),currentPage:page};
};
exports.get = async (value,userId=null,bySlug=false,published=false) => (await query(select+' WHERE '+(bySlug?'p.slug':'p.id::text')+'=$2'+(published?" AND p.status='published'":''),[userId,value])).rows[0];
exports.create = async (data,author) => {
 const id=randomUUID(); const slug=data.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')+'-'+id.slice(0,8);
 await query(`INSERT INTO posts(id,title,slug,content,summary,category_id,author_id,tags,image,status,is_featured,published_at)
 VALUES($1,$2,$3,$4,$5,(SELECT id FROM categories WHERE slug=$6),$7,$8,$9,$10,$11,CASE WHEN $10='published' THEN now() END)`,[id,data.title,slug,data.content,data.summary||'',data.category,author,data.tags||[],data.image||'',data.status||'draft',data.isFeatured||false]);
 return exports.get(id);
};
exports.update = async (id,data) => {
 const columns={title:'title',content:'content',summary:'summary',tags:'tags',image:'image',status:'status',isFeatured:'is_featured'};
 const values=[id],sets=['updated_at=now()'];
 for(const [key,column] of Object.entries(columns)) if(data[key]!==undefined){values.push(data[key]);sets.push(column+'=$'+values.length);}
 if(data.category!==undefined){values.push(data.category);sets.push('category_id=(SELECT id FROM categories WHERE slug=$'+values.length+')');}
 if(data.status==='published')sets.push("published_at=CASE WHEN status <> 'published' THEN now() ELSE COALESCE(published_at,now()) END");
 await query('UPDATE posts SET '+sets.join(',')+' WHERE id=$1',values);return exports.get(id);
};
exports.remove = async id => (await query('DELETE FROM posts WHERE id=$1 RETURNING id',[id])).rowCount;
exports.view = async id => query('UPDATE posts SET views=views+1 WHERE id=$1',[id]);
// Serialize toggles per resource. The lock and both writes use the same connection.
exports.toggle = async (id,userId,favorite=false) => transaction(async client=>{
 const post=(await client.query("SELECT id FROM posts WHERE id=$1 AND status='published' FOR UPDATE",[id])).rows[0];
 if(!post)return null;
 const table=favorite?'favorites':'post_likes';
 const deleted=await client.query('DELETE FROM '+table+' WHERE post_id=$1 AND user_id=$2 RETURNING post_id',[id,userId]);
 if(!deleted.rowCount)await client.query('INSERT INTO '+table+'(post_id,user_id) VALUES($1,$2)',[id,userId]);
 const likesCount=Number((await client.query('SELECT count(*) FROM post_likes WHERE post_id=$1',[id])).rows[0].count);
 return favorite?{isFavorited:!deleted.rowCount}:{isLiked:!deleted.rowCount,likesCount};
});
exports.stats = async()=> {
 const row=(await query(`SELECT count(*)::int AS "totalNews", count(*) FILTER(WHERE status='published')::int AS "publishedNews", count(*) FILTER(WHERE status='draft')::int AS "draftNews", count(*) FILTER(WHERE is_featured)::int AS "featuredNews", COALESCE(sum(views),0)::int AS "totalViews" FROM posts`)).rows[0];
 const totalLikes=Number((await query('SELECT count(*) FROM post_likes')).rows[0].count);
 const pendingComments=Number((await query("SELECT count(*) FROM comments WHERE status='pending'")).rows[0].count);
 const newsByCategory=(await query('SELECT c.slug AS "_id",c.name,count(p.id)::int AS count FROM categories c LEFT JOIN posts p ON p.category_id=c.id GROUP BY c.id ORDER BY count DESC')).rows;
 const recentNews=(await exports.list({admin:true,limit:5})).data;
 return {...row,engagement:{totalViews:row.totalViews,totalLikes},newsByCategory,recentNews,pendingComments};
};
