const Category = require('../models/Category');
const clean = require('./content');
const bad = message => Object.assign(new Error(message), {status:400});
const fields = ['title','summary','content','category','image','tags'];
async function preparePostInput(body, {partial=false, user=false} = {}) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Проверьте поля публикации');
 const allowed = user ? fields : [...fields,'status','isFeatured'];
 if (Object.keys(body).some(key => !allowed.includes(key))) throw bad('Переданы недопустимые поля публикации');
 const data = {...body};
 for (const [key,max] of [['title',200],['content',100000],['summary',500]]) {
  if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > max || (key !== 'summary' && !data[key].trim()))) throw bad('Проверьте название, текст и краткое описание');
  if (!partial && key !== 'summary' && data[key] === undefined) throw bad('Название и текст обязательны');
 }
 if (data.title !== undefined) data.title = data.title.trim();
 if (data.content !== undefined) {
  data.content = clean(data.content);
  if (!data.content.replace(/<[^>]*>/g,'').trim()) throw bad('Текст публикации пуст');
 }
 if (data.category !== undefined || !partial) {
  if (typeof data.category !== 'string' || !(await Category.list()).some(c => c.slug === data.category)) throw bad('Выберите существующую категорию');
 }
 if (data.image !== undefined && (typeof data.image !== 'string' || data.image.length > 2000 || (data.image && !/^(https?:\/\/|\/uploads\/)/i.test(data.image)))) throw bad('Укажите ссылку на изображение');
 if (data.tags !== undefined) {
  if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
  if (!Array.isArray(data.tags) || data.tags.length > 30 || data.tags.some(t => typeof t !== 'string' || t.length > 80)) throw bad('Проверьте теги');
 }
 if (!user && data.status !== undefined && !['draft','published','archived','rejected'].includes(data.status)) throw bad('Недопустимый статус публикации');
 if (!user && data.isFeatured !== undefined && typeof data.isFeatured !== 'boolean') throw bad('Недопустимое значение избранной публикации');
 return data;
}
module.exports = {preparePostInput, fields, bad};
