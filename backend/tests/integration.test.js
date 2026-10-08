const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const enabled=process.env.NEWSROOM_INTEGRATION==='1';
let server,base,pool,User;
async function request(url,method='GET',body,token){
 const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,...await res.json()};
}
before(async()=>{if(!enabled)return;assert.match(process.env.DATABASE_URL,/\/newsroom_test(?:_[a-f0-9]+)?$/);pool=require('../config/db').pool;User=require('../models/User');await require('../db/migrate')();server=require('../server').app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();});
test('PostgreSQL CMS: auth, publication lifecycle, moderation, engagement, categories', {skip:!enabled}, async()=>{
 const {runSetup}=require('../scripts/setupAdmin');
 const {createInitialAdmin}=require('../services/adminSetup');
 const {terminalFixture}=require('./helpers/terminal');
 const password='editor-test-passphrase';
 const tty=terminalFixture(['Редактор',' EDITOR@test.local ',password,password]);
 const createdAdmin=await runSetup({input:tty.input,output:tty.output});
 assert.equal(createdAdmin.role,'admin');assert.equal(createdAdmin.email,'editor@test.local');
 assert.equal(tty.input.isRaw,false);assert.ok(!tty.state.visible.includes(password));
 const stored=await User.findByEmail('editor@test.local');assert.notEqual(stored.password,password);assert.match(stored.password,/^\$2[aby]\$12\$/);assert.equal(await require('bcryptjs').compare(password,stored.password),true);
 const beforeCount=(await pool.query('SELECT count(*)::int AS count FROM users')).rows[0].count;
 const deniedTTY=terminalFixture(['Другой','other@test.local',password,password]);
 await assert.rejects(runSetup({input:deniedTTY.input,output:deniedTTY.output}),{code:'ADMIN_EXISTS'});assert.equal(deniedTTY.state.prompts,0);
 const {execFile}=require('node:child_process');
 const cli=await new Promise(resolve=>execFile(process.execPath,['scripts/setupAdmin.js'],{cwd:require('path').join(__dirname,'..'),env:process.env,windowsHide:true,timeout:5000},(error,stdout,stderr)=>resolve({code:error?.code,stdout,stderr})));
 assert.equal(cli.code,1);assert.match(cli.stderr,/Администратор уже существует/);assert.ok(!cli.stdout.includes('Пароль'));
 await assert.rejects(createInitialAdmin({name:'Другой',email:'other@test.local',password,confirmation:password}),{code:'ADMIN_EXISTS'});
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM users')).rows[0].count,beforeCount);
 const adminLogin=await request('/api/auth/login','POST',{email:'editor@test.local',password:'editor-test-passphrase'});assert.equal(adminLogin.status,200);assert.equal(adminLogin.data.role,'admin');assert.equal(adminLogin.data.password,undefined);
 const admin=adminLogin.data.token;
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
 // Every administrator endpoint rejects anonymous and ordinary users.
 for(const [route,method,body] of [
  ['/api/admin/stats','GET'],['/api/admin/news','GET'],['/api/admin/news','POST',{}],
  ['/api/admin/news/'+second.id,'GET'],['/api/admin/news/'+second.id,'PUT',{}],['/api/admin/news/'+second.id,'DELETE'],
  ['/api/admin/news/'+second.id+'/featured','PATCH'],['/api/admin/categories','GET'],['/api/admin/categories','POST',{}],
  ['/api/admin/categories/00000000-0000-4000-a000-000000000000','DELETE'],['/api/admin/comments','GET'],
  ['/api/admin/comments/00000000-0000-4000-a000-000000000000/status','PATCH',{}],['/api/admin/comments/00000000-0000-4000-a000-000000000000','DELETE'],
  ['/api/admin/upload','POST'],['/api/auth/register-admin','POST',{}]
 ]){assert.equal((await request(route,method,body)).status,401,route);assert.equal((await request(route,method,body,reader)).status,403,route);}
 const jwt=require('jsonwebtoken');
 const forgedRole=jwt.sign({id:registered.data.id,role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'});
 assert.equal((await request('/api/admin/stats','GET',undefined,forgedRole)).status,403);
 assert.equal((await request('/api/auth/register-admin','POST',{name:'Дополнительный',email:'additional@test.local',password:'short'},admin)).status,400);
 const invalid=jwt.sign({id:createdAdmin.id},'wrong-secret',{expiresIn:'1h'});const expired=jwt.sign({id:createdAdmin.id},process.env.JWT_SECRET,{expiresIn:-1});
 assert.equal((await request('/api/admin/stats','GET',undefined,invalid)).status,401);assert.equal((await request('/api/admin/stats','GET',undefined,expired)).status,401);
 // Independent logins must produce distinct tokens even in the same second.
 const otherAdmin=(await request('/api/auth/login','POST',{email:'editor@test.local',password:'editor-test-passphrase'})).data.token;assert.notEqual(otherAdmin,admin);
 assert.equal((await request('/api/auth/logout','POST',{},admin)).status,200);
 assert.equal((await request('/api/admin/stats','GET',undefined,admin)).status,401);assert.equal((await request('/api/auth/me','GET',undefined,admin)).status,401);
 assert.equal((await request('/api/admin/stats','GET',undefined,otherAdmin)).status,200);
 const revoked=(await pool.query('SELECT token_hash FROM revoked_tokens')).rows[0];assert.match(revoked.token_hash,/^[0-9a-f]{64}$/);assert.notEqual(revoked.token_hash,admin);
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

test('first-time setup rejects occupied email and concurrent commands produce only one administrator', {skip:!enabled}, async()=>{
 const {Pool}=require('pg');const {createInitialAdmin}=require('../services/adminSetup');
 // Use an independent database for this test; never truncate users or delete fixtures.
 const isolated=new Pool({connectionString:process.env.DATABASE_URL});
 const {randomUUID}=require('crypto');
 const database='admin_setup_'+randomUUID().replaceAll('-','');
 await isolated.query('CREATE DATABASE '+database);
 const adminPool=require('../config/db').pool;
 const originalConnect=adminPool.connect.bind(adminPool);
 const setupPool=new Pool({connectionString:process.env.DATABASE_URL.replace(/\/newsroom_test(?:_[a-f0-9]+)?$/,'/'+database)});
 try {
  const schema=await require('fs/promises').readFile(require('path').join(__dirname,'../db/schema.sql'),'utf8');await setupPool.query(schema);
  await setupPool.query('INSERT INTO users(id,name,email,password,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),'Читатель','occupied@test.local','test-only-unused-hash','user']);
  adminPool.connect=setupPool.connect.bind(setupPool);
  const credentials={name:'Редактор',email:'occupied@test.local',password:'race-test-passphrase',confirmation:'race-test-passphrase'};
  await assert.rejects(createInitialAdmin(credentials),{code:'EMAIL_EXISTS'});
  const results=await Promise.allSettled([createInitialAdmin({...credentials,email:'first@test.local'}),createInitialAdmin({...credentials,email:'second@test.local'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'ADMIN_EXISTS');
  assert.equal((await setupPool.query("SELECT count(*)::int AS count FROM users WHERE role='admin'")).rows[0].count,1);
  assert.equal((await setupPool.query("SELECT count(*)::int AS count FROM users WHERE role='user'")).rows[0].count,1);
 }finally{adminPool.connect=originalConnect;await setupPool.end();await isolated.end();}
});

test('user submissions: immutable authorship, review, rejection/resubmission and safe published revisions', {skip:!enabled}, async()=>{
 const authorRegistration=await request('/api/auth/register','POST',{name:'Алия',email:'aliya@workflow.test',password:'author-test-passphrase',role:'admin'});
 assert.equal(authorRegistration.status,201);assert.equal(authorRegistration.data.role,'user');const authorId=authorRegistration.data.id;
 const userLogin=await request('/api/auth/login','POST',{email:'aliya@workflow.test',password:'author-test-passphrase'});assert.equal(userLogin.status,200);const user=userLogin.data.token;
 const other=(await request('/api/auth/register','POST',{name:'Другой автор',email:'other@workflow.test',password:'other-test-passphrase'})).data.token;
 const admin=(await request('/api/auth/login','POST',{email:'editor@test.local',password:'editor-test-passphrase'})).data.token;
 const adminId=(await request('/api/auth/me','GET',undefined,admin)).data.id;
 const material={title:'Новые технологии в Казахстане',summary:'Новость от Алии',content:'<p>Исходный текст автора</p><script>alert(1)</script>',category:'technology',image:''};
 assert.equal((await request('/api/my/posts','POST',material)).status,401);
 for(const field of [{status:'published'},{author_user_id:adminId},{author:adminId},{reviewed_by_admin_id:adminId},{isFeatured:true}])assert.equal((await request('/api/my/posts','POST',{...material,...field},user)).status,400);
 assert.equal((await request('/api/my/posts','POST',{...material,category:'missing'},user)).status,400);
 assert.equal((await request('/api/my/posts','POST',{...material,title:'x'.repeat(201)},user)).status,400);
 const submitted=await request('/api/my/posts','POST',material,user);assert.equal(submitted.status,201);const article=submitted.data;
 assert.equal(article.status,'PENDING_REVIEW');assert.equal(article.author.name,'Алия');assert.equal(article.authorUserId,authorId);assert.equal(article.originalSubmission.authorUserId,authorId);assert.doesNotMatch(article.content,/<script>/);
 const firstRevision=article.revisionId;
 assert.equal((await request('/api/news/'+article.slug)).status,404);
 assert.ok(!(await request('/api/posts/latest')).data.some(p=>p.id===article.id));
 assert.equal((await request('/api/my/posts/'+article.id,'GET',undefined,other)).status,404);
 assert.equal((await request('/api/my/posts/'+article.id,'PUT',{title:'Чужая правка'},other)).status,404);
 assert.equal((await request('/api/my/posts/'+article.id+'/submit','POST',{},other)).status,404);
 assert.equal((await request('/api/my/posts/'+article.id,'PUT',{title:'Правка во время проверки'},user)).status,409);
 assert.equal((await request('/api/my/posts/'+article.id+'/submit','POST',{status:'published'},user)).status,400);
 assert.equal((await request('/api/admin/submissions','GET')).status,401);
 assert.equal((await request('/api/admin/submissions','GET',undefined,user)).status,403);
 assert.equal((await request('/api/admin/submissions/'+firstRevision,'PUT',{title:'Обход'},user)).status,403);
 assert.equal((await request('/api/admin/submissions/'+firstRevision+'/decision','PATCH',{decision:'approve'},user)).status,403);
 assert.equal((await request('/api/admin/news/'+article.id,'PUT',{status:'published'},user)).status,403);
 const queue=await request('/api/admin/submissions','GET',undefined,admin);assert.ok(queue.data.some(r=>r.id===firstRevision));
 const original=(await request('/api/admin/submissions/'+firstRevision,'GET',undefined,admin)).data.originalSubmission;
 assert.equal(original.title,material.title);assert.equal(original.content,'<p>Исходный текст автора</p>');
 assert.equal((await request('/api/admin/submissions/'+firstRevision,'PUT',{author_user_id:adminId},admin)).status,400);
 const edits={title:'Новые технологии: редакционная версия',summary:'Описание после проверки',content:'<p>Проверенный текст</p>',category:'science',image:'/uploads/test-cover.png'};
 const edited=await request('/api/admin/submissions/'+firstRevision,'PUT',edits,admin);assert.equal(edited.status,200);assert.deepEqual(edited.data.originalSubmission,original);
 assert.equal((await request('/api/news/'+article.slug)).status,404);
 assert.equal((await request('/api/admin/submissions/'+firstRevision+'/decision','PATCH',{decision:'approve',changes:{author_user_id:adminId}},admin)).status,400);
 const approved=await request('/api/admin/submissions/'+firstRevision+'/decision','PATCH',{decision:'approve',changes:edits},admin);assert.equal(approved.status,200);assert.equal(approved.data.reviewedByAdminId,adminId);
 const publicArticle=(await request('/api/news/'+article.slug)).data;assert.equal(publicArticle.title,edits.title);assert.equal(publicArticle.content,edits.content);assert.equal(publicArticle.author.name,'Алия');assert.equal(publicArticle.author._id,authorId);assert.equal(publicArticle.authorUserId,authorId);assert.equal(publicArticle.reviewedByAdminId,adminId);
 assert.ok((await request('/api/posts/latest')).data.some(p=>p.id===article.id));
 assert.equal((await request('/api/admin/submissions/'+firstRevision+'/decision','PATCH',{decision:'reject'},admin)).status,409);
 // Database guard protects authorship independently of controller whitelists.
 await assert.rejects(pool.query('UPDATE posts SET author_id=$2 WHERE id=$1',[article.id,adminId]),error=>error.code==='23514');
 await assert.rejects(pool.query('UPDATE post_revisions SET original_submission=$2 WHERE id=$1',[firstRevision,{}]),error=>error.code==='23514');
 // Editing a published article creates a private draft; the live version stays unchanged.
 const changed=await request('/api/my/posts/'+article.id,'PUT',{title:'Новая версия автора',content:'<p>Новые сведения</p>'},user);assert.equal(changed.status,200);assert.equal(changed.data.status,'draft');assert.equal(changed.data.hasPublishedVersion,true);assert.notEqual(changed.data.revisionId,firstRevision);
 assert.equal((await request('/api/news/'+article.slug)).data.content,edits.content);
 assert.equal((await request('/api/my/posts/'+article.id,'PUT',{status:'published'},user)).status,400);
 const reviewedAgain=await request('/api/my/posts/'+article.id+'/submit','POST',{},user);assert.equal(reviewedAgain.data.status,'PENDING_REVIEW');const secondRevision=reviewedAgain.data.revisionId;
 assert.equal((await request('/api/admin/submissions/'+secondRevision+'/decision','PATCH',{decision:'reject',reason:'Пожалуйста, добавьте проверяемый источник'},admin)).status,200);
 assert.equal((await request('/api/my/posts/'+article.id,'GET',undefined,user)).data.status,'rejected');assert.equal((await request('/api/news/'+article.slug)).data.content,edits.content);
 assert.equal((await request('/api/my/posts/'+article.id,'PUT',{content:'<p>Новые сведения со ссылкой на источник</p>'},user)).data.status,'draft');
 const resubmitted=(await request('/api/my/posts/'+article.id+'/submit','POST',{},user)).data;assert.equal(resubmitted.status,'PENDING_REVIEW');assert.notEqual(resubmitted.revisionId,secondRevision);
 assert.equal((await request('/api/admin/submissions/'+secondRevision,'GET',undefined,admin)).data.rejectionReason,'Пожалуйста, добавьте проверяемый источник');
 // Compatibility publishing route also reviews the active version and never changes the author.
 const legacyPublish=await request('/api/admin/news/'+article.id,'PUT',{status:'published',title:'Финальное название'},admin);assert.equal(legacyPublish.status,200);
 const final=(await request('/api/news/'+article.slug)).data;assert.equal(final.title,'Финальное название');assert.match(final.content,/со ссылкой/);assert.equal(final.author.name,'Алия');
 assert.equal((await request('/api/admin/submissions/'+resubmitted.revisionId,'GET',undefined,admin)).data.reviewedByAdminId,adminId);
 // Rejected first submissions remain private, can be resubmitted unchanged, and accept no arbitrary status.
 const rejected=(await request('/api/my/posts','POST',{...material,title:'Ещё одна новость'},user)).data;
 await request('/api/admin/submissions/'+rejected.revisionId+'/decision','PATCH',{decision:'reject'},admin);
 assert.equal((await request('/api/news/'+rejected.slug)).status,404);
 const retry=(await request('/api/my/posts/'+rejected.id+'/submit','POST',{},user)).data;assert.equal(retry.status,'PENDING_REVIEW');assert.notEqual(retry.revisionId,rejected.revisionId);
 const draft=(await request('/api/my/posts','POST',{...material,title:'Мой черновик',intent:'draft'},user)).data;assert.equal(draft.status,'draft');
 assert.equal((await request('/api/admin/news/'+draft.id,'PUT',{status:'published'},admin)).status,409);
 assert.equal((await request('/api/my/posts/'+draft.id,'PUT',{title:'Обновлённый черновик'},user)).status,200);
 assert.equal((await request('/api/my/posts/'+draft.id+'/submit','POST',{},user)).data.status,'PENDING_REVIEW');
 assert.equal((await request('/api/my/posts?status=PENDING_REVIEW','GET',undefined,user)).total,2);
 assert.equal((await request('/api/my/posts','GET',undefined,other)).total,0);
 // Concurrent moderation can have only one final decision.
 const decisions=await Promise.all([request('/api/admin/submissions/'+retry.revisionId+'/decision','PATCH',{decision:'approve'},admin),request('/api/admin/submissions/'+retry.revisionId+'/decision','PATCH',{decision:'reject'},admin)]);
 assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);
 const counts=(await pool.query('SELECT author_user_id,author_id FROM posts WHERE id=$1',[article.id])).rows[0];assert.equal(counts.author_user_id,authorId);assert.equal(counts.author_id,authorId);
 await require('../db/migrate')();assert.equal((await request('/api/news/'+article.slug)).data.author.name,'Алия');
});

test('additive submission migration preserves pre-existing PostgreSQL posts, authors and comments', {skip:!enabled}, async()=>{
 const {Pool}=require('pg'),{randomUUID}=require('crypto');const database='submission_upgrade_'+randomUUID().replaceAll('-','');await pool.query('CREATE DATABASE '+database);
 const db=new Pool({connectionString:process.env.DATABASE_URL.replace(/\/newsroom_test(?:_[a-f0-9]+)?$/,'/'+database)});
 try {
  const fs=require('fs/promises'),path=require('path');await db.query(await fs.readFile(path.join(__dirname,'../db/schema.sql'),'utf8'));
  const user=randomUUID(),category=randomUUID(),post=randomUUID(),comment=randomUUID();
  await db.query('INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4)',[user,'Старый автор','old@upgrade.test','existing-hash']);
  await db.query('INSERT INTO categories(id,slug,name) VALUES($1,$2,$3)',[category,'existing','Существующая категория']);
  await db.query("INSERT INTO posts(id,title,slug,content,category_id,author_id,status,published_at,views) VALUES($1,'Существующая новость','existing-slug','Исходный текст',$2,$3,'published',now(),17)",[post,category,user]);
  await db.query("INSERT INTO comments(id,content,post_id,user_id,status) VALUES($1,'Старый комментарий',$2,$3,'approved')",[comment,post,user]);
  const before=(await db.query('SELECT * FROM posts WHERE id=$1',[post])).rows[0];
  await db.query(await fs.readFile(path.join(__dirname,'../db/migrations/002_article_submissions.sql'),'utf8'));
  const after=(await db.query('SELECT * FROM posts WHERE id=$1',[post])).rows[0];for(const key of Object.keys(before))assert.deepEqual(after[key],before[key]);assert.equal(after.author_user_id,user);assert.equal(after.reviewed_by_admin_id,null);
  assert.equal((await db.query('SELECT content FROM comments WHERE id=$1',[comment])).rows[0].content,'Старый комментарий');assert.equal((await db.query('SELECT password FROM users WHERE id=$1',[user])).rows[0].password,'existing-hash');
 }finally{await db.end();}
});

test('demonstration seed is repeatable and preserves all existing posts and authors', {skip:!enabled}, async()=>{
 const baseline=(await pool.query('SELECT * FROM posts ORDER BY id')).rows;
 const seed=require('../seedData');
 const previous=process.env.ADMIN_EMAIL;delete process.env.ADMIN_EMAIL;
 try{await seed();await seed();}finally{if(previous!==undefined)process.env.ADMIN_EMAIL=previous;}
 const after=(await pool.query('SELECT * FROM posts ORDER BY id')).rows;
 assert.equal(after.length,baseline.length+6);
 for(const post of baseline)assert.deepEqual(after.find(row=>row.id===post.id),post);
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM categories')).rows[0].count,9);
});
