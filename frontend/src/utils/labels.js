export const categoryLabels = {politics:'Политика',business:'Экономика',technology:'Технологии',sports:'Спорт',entertainment:'Культура',health:'Здоровье',science:'Наука',world:'Мир',local:'Кампус'};
export const categoryLabel = value => categoryLabels[value] || value;
export const statusLabel = value => ({draft:'Черновик',PENDING_REVIEW:'На проверке',published:'Опубликовано',archived:'В архиве',pending:'На проверке',approved:'Одобрен',rejected:'Отклонено'}[value] || value);
