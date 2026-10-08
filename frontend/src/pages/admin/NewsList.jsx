import { ru } from 'date-fns/locale';
import { categoryLabel, statusLabel } from '../../utils/labels';
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiStar, FiEye } from 'react-icons/fi';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';
import Loading from '../../components/Loading';

const NewsList = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState({ status: searchParams.get('status') || '', category: '' });
  const [categories, setCategories] = useState([]);
  useEffect(() => { adminAPI.getCategories().then(r => setCategories(r.data.data)).catch(() => toast.error('Не удалось загрузить категории')); }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        ...(filter.status && { status: filter.status }),
        ...(filter.category && { category: filter.category })
      };
      const res = await adminAPI.getNews(params);
      setNews(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error("Не удалось загрузить публикации");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [page, filter]);

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить эту публикацию?")) return;

    try {
      await adminAPI.deleteNews(id);
      toast.success("Публикация удалена");
      fetchNews();
    } catch (error) {
      toast.error("Не удалось удалить публикацию");
    }
  };

  const handleToggleFeatured = async (id) => {
    try {
      await adminAPI.toggleFeatured(id);
      toast.success("Приоритет публикации изменён");
      fetchNews();
    } catch (error) {
      toast.error("Не удалось изменить приоритет публикации");
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Управление публикациями</h1>
        <Link
          to="/admin/news/create"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700"
        >
          <FiPlus /> Новая публикация
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap gap-4">
        <select
          value={filter.status}
          onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:border-primary-500"
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="published">Опубликовано</option>
          <option value="archived">В архиве</option>
        </select>

        <select
          value={filter.category}
          onChange={(e) => { setFilter({ ...filter, category: e.target.value }); setPage(1); }}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:border-primary-500"
        >
          <option value="">Все категории</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug} className="capitalize">
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : news.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-gray-600">Публикации не найдены.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Просмотры</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {news.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">{item.title}</p>
                          {item.isFeatured && (
                            <span className="text-xs text-yellow-600 flex items-center gap-1">
                              <FiStar size={10} /> Главное
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 capitalize text-gray-600">{item.categoryName || categoryLabel(item.category)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'published' ? 'bg-green-100 text-green-700' :
                        item.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="flex items-center gap-1">
                        <FiEye size={14} /> {item.views}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {format(new Date(item.createdAt), 'd MMM yyyy', {locale:ru})}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleFeatured(item._id)}
                          className={`p-2 rounded-lg transition-colors ${
                            item.isFeatured ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={item.isFeatured ? "Убрать из главного" : "Добавить в главное"}
                        >
                          <FiStar size={16} />
                        </button>
                        <Link
                          to={`/admin/news/${item._id}`}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <FiEdit2 size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(item._id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-50"
              >
                Назад
              </button>
              <span className="px-4 py-2">
                Страница {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded-lg disabled:opacity-50"
              >
                Далее
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NewsList;
