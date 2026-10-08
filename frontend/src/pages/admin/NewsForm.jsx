import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';
import Loading from '../../components/Loading';

const NewsForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    category: 'technology',
    tags: '',
    image: '',
    status: 'draft',
    isFeatured: false
  });

  const [categories, setCategories] = useState([]);
  useEffect(() => { adminAPI.getCategories().then(res => setCategories(res.data.data)).catch(() => toast.error('Не удалось загрузить категории')); }, []);

  useEffect(() => {
    if (isEditing) {
      const fetchNews = async () => {
        try {
          const res = await adminAPI.getNewsById(id);
          const news = res.data.data;
          if(news.status === 'PENDING_REVIEW' && news.revisionId){navigate('/admin/submissions/'+news.revisionId);return;}
          setFormData({
            title: news.title,
            content: news.content,
            summary: news.summary || '',
            category: news.category,
            tags: news.tags?.join(', ') || '',
            image: news.image || '',
            status: news.status,
            isFeatured: news.isFeatured
          });
        } catch (error) {
          toast.error("Не удалось загрузить публикацию");
          navigate('/admin/news');
        } finally {
          setLoading(false);
        }
      };

      fetchNews();
    }
  }, [id, isEditing, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const requestedStatus = e.nativeEvent.submitter?.value;
    const payload = { ...formData, ...(requestedStatus && {status:requestedStatus}) };

    try {
      if (isEditing) {
        await adminAPI.updateNews(id, payload);
        toast.success("Публикация обновлена");
      } else {
        await adminAPI.createNews(payload);
        toast.success("Публикация создана");
      }
      navigate('/admin/news');
    } catch (error) {
      toast.error(error.response?.data?.message || "Не удалось сохранить публикацию");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataImage = new FormData();
    formDataImage.append('image', file);

    try {
      const res = await adminAPI.uploadImage(formDataImage);
      setFormData({ ...formData, image: res.data.data.path });
      toast.success("Изображение загружено");
    } catch (error) {
      toast.error("Не удалось загрузить изображение");
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? "Редактирование публикации" : "Новая публикация"}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md">
        {/* Title */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            maxLength={200}
            value={formData.title}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            required
          />
        </div>

        {/* Summary */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Краткое описание
          </label>
          <textarea
            name="summary"
            maxLength={500}
            value={formData.summary}
            onChange={handleChange}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            placeholder="Краткое описание публикации..."
          />
        </div>

        {/* Content */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Текст <span className="text-red-500">*</span>
          </label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows={10}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            required
            placeholder="Текст публикации (поддерживается безопасный HTML)..."
          />
        </div>

        {/* Category & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Категория <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug} className="capitalize">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Статус
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            >
              <option value="draft">Черновик</option>
              <option value="published">Опубликовано</option>
              <option value="archived">В архиве</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Теги
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
            placeholder="Теги через запятую: университет, наука, студенты"
          />
        </div>

        {/* Image */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            Обложка
          </label>
          <div className="flex gap-4 items-start">
            <input
              type="text"
              name="image"
              value={formData.image}
              onChange={handleChange}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="Ссылка на изображение или загрузка"
            />
            <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200">
              Загрузить
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
          {formData.image && (
            <img
              src={formData.image}
              alt="Предпросмотр"
              className="mt-2 max-h-40 rounded-lg"
            />
          )}
        </div>

        {/* Featured */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isFeatured"
              checked={formData.isFeatured}
              onChange={handleChange}
              className="w-5 h-5 text-primary-600 rounded"
            />
            <span className="text-gray-700 font-medium">Показывать в разделе «Главное»</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Сохранение..." : isEditing ? "Сохранить изменения" : "Создать публикацию"}
          </button>
          <button type="submit" value="draft" disabled={submitting} className="px-6 py-2 border border-gray-300 rounded-lg">Сохранить черновик</button>
          <button type="submit" value="published" disabled={submitting} className="px-6 py-2 bg-gray-900 text-white rounded-lg">Опубликовать</button>
          <button
            type="button"
            onClick={() => navigate('/admin/news')}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewsForm;
