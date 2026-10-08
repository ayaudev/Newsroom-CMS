export const categoryLabels = {politics:'Политика',business:'Экономика',technology:'Технологии',sports:'Спорт',entertainment:'Культура',health:'Здоровье',science:'Наука',world:'Мир',local:'Кампус'};
export const categoryLabel = value => categoryLabels[value] || value;
export const statusLabel = value => ({draft:'Черновик',published:'Опубликовано',archived:'В архиве',pending:'На проверке',approved:'Одобрен',rejected:'Отклонён'}[value] || value);
