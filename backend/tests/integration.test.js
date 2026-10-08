const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const enabled=process.env.NEWSROOM_INTEGRATION==='1';
let server,base,pool,User;
async function request(url,method='GET',body,token){
 const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,...await res.json()};
}
before(async()=>{if(!enabled)return;assert.match(process.env.DATABASE_URL,/\/newsroom_test$/);pool=require('../config/db').pool;User=require('../models/User');await require('../db/migrate')();server=require('../server').app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();});
test('PostgreSQL CMS: auth, publication lifecycle, moderation, engagement, categories', {skip:!enabled}, async()=>{
 await User.create({name:'Редактор',email:'editor@test.local',password:'editor-password',role:'admin'});
 const admin=(await request('/api/auth/login','POST',{email:'editor@test.local',password:'editor-password'})).data.token;
 const registered=await request('/api/auth/register','POST',{name:'Читатель',email:'reader@test.local',password:'reader-password',role:'admin'});assert.equal(registered.status,201);assert.equal(registered.data.role,'user');const reader=registered.data.token;
 assert.equal((await request('/api/auth/login','POST',{email:'reader@test.local',password:'bad'})).status,401);
 assert.equal((await request('/api/admin/stats')).status,401);assert.equal((await request('/api/admin/stats','GET',undefined,reader)).status,403);
 const created=await request('/api/admin/news','POST',{title:'Первый материал',content:'<p>Безопасный текст</p><script>alert(1)</script>',category:'science',tags:'кампус, наука'},admin);assert.equal(created.status,201);const draft=created.data;assert.equal(draft.status,'draft');assert.doesNotMatch(draft.content,/<script>/);
 assert.match(draft.slug,/первый-материал/);
 assert.equal((await request('/api/posts/latest')).total,0);assert.equal((await request('/api/news/'+draft.slug)).status,404);assert.equal((await request('/api/news/'+draft.id+'/comments','POST',{content:'Скрытый'},reader)).status,404);
 assert.equal((await request('/api/admin/news/'+draft.id,'PUT',{status:'invalid'},admin)).status,400);
 const published=await request('/api/admin/news/'+draft.id,'PUT',{status:'published'},admin);assert.ok(published.data.publishedAt);assert.equal((await request('/api/posts/latest')).data[0].id,draft.id);
 const second=(await request('/api/admin/news','POST',{title:'Второй материал',content:'Текст',category:'science',status:'published'},admin)).data;
 const latest=await request('/api/posts/latest');assert.equal(latest.data[0].id,second.id);assert.equal(latest.total,2);
 assert.equal((await request('/api/news?search='+encodeURIComponent('Первый'))).total,1);assert.equal((await request('/api/news?tag='+encodeURIComponent('кампус'))).total,1);
 assert.equal((await request('/api/news?search='+encodeURIComponent("' OR 1=1 --"))).total,0);
 assert.equal((await request('/api/news/category/science')).total,2);assert.equal((await request('/api/news/'+draft.id+'/related')).data[0].id,second.id);
 assert.equal((await request('/api/news/'+draft.id+'/like','POST',{},reader)).isLiked,true);assert.equal((await request('/api/news/'+draft.id+'/like','POST',{},reader)).isLiked,false);
 assert.equal((await request('/api/news/'+draft.id+'/favorite','POST',{},reader)).isFavorited,true);assert.equal((await request('/api/news/user/favorites','GET',undefined,reader)).total,1);
 const comment=(await request('/api/news/'+draft.id+'/comments','POST',{content:'Комментарий',status:'approved'},reader)).data;assert.equal(comment.status,'pending');assert.equal((await request('/api/news/'+draft.id+'/comments')).total,0);
 assert.equal((await request('/api/admin/comments?status=pending','GET',undefined,admin)).total,1);
 assert.equal((await request('/api/admin/comments/'+comment.id+'/status','PATCH',{status:'approved'},reader)).status,403);
 await request('/api/admin/comments/'+comment.id+'/status','PATCH',{status:'approved'},admin);assert.equal((await request('/api/news/'+draft.id+'/comments')).total,1);
 const detail=await request('/api/news/'+draft.slug,'GET',undefined,reader);assert.equal(detail.data.isFavorited,true);assert.ok(detail.data.views>=1);
 const reply=(await request('/api/news/'+draft.id+'/comments','POST',{content:'Ответ',parentCommentId:comment.id},reader)).data;
 await request('/api/admin/comments/'+reply.id+'/status','PATCH',{status:'approved'},admin);assert.equal((await request('/api/news/'+draft.id+'/comments')).data[0].replies.length,1);
 assert.equal((await request('/api/news/'+second.id+'/comments','POST',{content:'Чужой ответ',parentCommentId:comment.id},reader)).status,400);
 assert.equal((await request('/api/comments/'+comment.id+'/like','POST',{},reader)).likesCount,1);
 const edited=await request('/api/comments/'+comment.id,'PUT',{content:'Новая версия'},reader);assert.equal(edited.data.status,'pending');assert.equal((await request('/api/news/'+draft.id+'/comments')).total,0);
 await request('/api/admin/comments/'+comment.id+'/status','PATCH',{status:'rejected'},admin);assert.equal((await request('/api/admin/comments?status=rejected','GET',undefined,admin)).total,1);
 assert.equal((await request('/api/comments/'+comment.id+'/like','POST',{},reader)).status,404);
 const custom=(await request('/api/admin/categories','POST',{name:'Студенческая жизнь',slug:'student-life'},admin)).data;
 assert.ok((await request('/api/categories')).data.some(c=>c.id===custom.id));await request('/api/admin/news/'+draft.id,'PUT',{category:'student-life'},admin);
 assert.equal((await request('/api/admin/categories/'+custom.id,'DELETE',undefined,admin)).status,400);
 await request('/api/admin/news/'+draft.id,'PUT',{status:'draft'},admin);assert.equal((await request('/api/posts/latest')).total,1);assert.equal((await request('/api/news/user/favorites','GET',undefined,reader)).total,0);
 const republished=(await request('/api/admin/news/'+draft.id,'PUT',{status:'published'},admin)).data;assert.ok(new Date(republished.publishedAt)>=new Date(published.data.publishedAt));assert.equal((await request('/api/posts/latest')).data[0].id,draft.id);
 assert.equal((await request('/api/auth/profile','PUT',{name:'Обновлённое имя'},reader)).data.name,'Обновлённое имя');assert.equal((await request('/api/auth/me','GET',undefined,reader)).data.favorites[0]._id,draft.id);
 assert.equal((await request('/api/auth/password','PUT',{currentPassword:'reader-password',newPassword:'changed-password'},reader)).status,200);assert.equal((await request('/api/auth/login','POST',{email:'reader@test.local',password:'changed-password'})).status,200);
 assert.equal((await request('/api/admin/stats','GET',undefined,admin)).data.totalNews,2);
 await request('/api/admin/news/'+draft.id,'DELETE',undefined,admin);assert.equal((await request('/api/admin/comments','GET',undefined,admin)).total,0);
 assert.equal((await request('/api/admin/categories/'+custom.id,'DELETE',undefined,admin)).status,200);
 // Exercise original multipart upload without leaving test files in uploads.
 const form=new FormData();form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X8AAAAASUVORK5CYII=','base64')],{type:'image/png'}),'fixture.png');
 const uploadResponse=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Authorization:'Bearer '+admin},body:form});assert.equal(uploadResponse.status,200);const uploaded=(await uploadResponse.json()).data;
 assert.match(uploaded.filename,/^image-[0-9]+-[0-9]+\.png$/);
 try{assert.equal((await fetch(base+uploaded.path)).status,200);}finally{await require('fs/promises').unlink(require('path').join(__dirname,'../uploads',uploaded.filename));}
 assert.equal((await request('/api/health')).status,200);
});

test('MongoDB import preserves credentials, URLs, links, likes and favorites; bad import rolls back', {skip:!enabled}, async()=>{
 const fs=require('fs/promises'),os=require('os'),path=require('path');
 const {importMongo,uuid}=require('../db/importMongo');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'newsroom-import-test-'));
 const uid='000000000000000000000001',pid='000000000000000000000002',cid='000000000000000000000003';
 const hash=await require('bcryptjs').hash('legacy-password',10);
 const users=[{_id:{$oid:uid},name:'Прежний пользователь',email:'legacy@test.local',password:hash,favorites:[{$oid:pid}]}];
 const posts=[{_id:{$oid:pid},title:'Сохранённая статья',slug:'original-legacy-url',content:'<p>Старый текст</p><script>alert(1)</script>',category:'science',author:{$oid:uid},status:'published',publishedAt:{$date:'2025-01-01T00:00:00Z'},likes:[{$oid:uid}],views:42}];
 const comments=[{_id:{$oid:cid},news:{$oid:pid},user:{$oid:uid},content:'Старый комментарий',likes:[{$oid:uid}]}];
 for(const [file,data] of [['users.json',users],['news.json',posts],['comments.json',comments]])await fs.writeFile(path.join(folder,file),JSON.stringify(data));
 await importMongo(folder);await importMongo(folder);
 const login=await request('/api/auth/login','POST',{email:'legacy@test.local',password:'legacy-password'});assert.equal(login.status,200);
 const article=(await request('/api/news/original-legacy-url','GET',undefined,login.data.token)).data;assert.equal(article.id,uuid(pid));assert.equal(article.likesCount,1);assert.equal(article.isLiked,true);assert.equal(article.isFavorited,true);assert.equal(article.views,43);assert.doesNotMatch(article.content,/<script>/);
 assert.equal((await pool.query('SELECT status FROM comments WHERE id=$1',[uuid(cid)])).rows[0].status,'pending');
 users.push({_id:'000000000000000000000004',name:'Rollback',email:'rollback@test.local',password:hash});posts.push({_id:'000000000000000000000005',title:'Повреждённая связь',slug:'bad-import-url',content:'Текст',category:'science',author:'000000000000000000000099',status:'draft'});
 await fs.writeFile(path.join(folder,'users.json'),JSON.stringify(users));await fs.writeFile(path.join(folder,'news.json'),JSON.stringify(posts));
 await assert.rejects(importMongo(folder));assert.equal(await User.findByEmail('rollback@test.local'),undefined);
});
