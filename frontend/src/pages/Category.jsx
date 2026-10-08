import { categoryLabel } from '../utils/labels';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { newsAPI } from '../services/api';
import NewsCard from '../components/NewsCard';
import Loading from '../components/Loading';

const Category = () => {
  const { category } = useParams();
  const [news, setNews] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setPage(1); newsAPI.getCategories().then(r => setName(r.data.data.find(c => c.slug === category)?.name || categoryLabel(category))).catch(() => setName(categoryLabel(category))); }, [category]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await newsAPI.getByCategory(category, { page, limit: 12 });
        setNews(res.data.data);
        setTotalPages(res.data.totalPages);
      } catch (error) {
        setError('Не удалось загрузить публикации');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [category, page]);

  if (loading) return <Loading />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold capitalize mb-8">{name || categoryLabel(category)}</h1>

      {error && <p role="alert" className="bg-red-50 p-4 mb-4 rounded-lg">{error}</p>}
      {news.length === 0 ? (
        <p className="text-gray-600 text-center py-12">В этой категории пока нет публикаций.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <NewsCard key={item._id} news={item} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
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

export default Category;
