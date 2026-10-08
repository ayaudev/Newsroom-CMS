const {test}=require('node:test');
const assert=require('node:assert/strict');
const clean=require('../utils/content');
test('retains article formatting and removes executable HTML',()=>{
 const html=clean('<h2>Наука</h2><p><strong>Текст</strong><a href="javascript:alert(1)">ссылка</a><img src="https://example.com/a.jpg" onerror="alert(1)"></p><script>alert(1)</script>');
 assert.match(html,/<h2>Наука<\/h2>/);assert.match(html,/<strong>Текст<\/strong>/);assert.doesNotMatch(html,/javascript:|onerror|<script>/);
});
