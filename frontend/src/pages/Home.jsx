import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { newsAPI } from '../services/api';
import NewsCard from '../components/NewsCard';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';

const Home = () => {
  const [searchParams] = useSearchParams();
  const [featuredNews, setFeaturedNews] = useState([]);
  const [latestNews, setLatestNews] = useState([]);
  const [trendingNews, setTrendingNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const searchQuery = searchParams.get('search');

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError('');
        
        if (searchQuery) {
          // Search mode
          const res = await newsAPI.getAll({ search: searchQuery, limit: 20 });
          setLatestNews(res.data.data);
          setFeaturedNews([]);
          setTrendingNews([]);
        } else {
          // Normal mode
          const [featuredRes, latestRes, trendingRes] = await Promise.all([
            newsAPI.getFeatured(3),
            newsAPI.getLatest({ limit: 9 }),
            newsAPI.getTrending(5)
          ]);

          setFeaturedNews(featuredRes.data.data);
          setLatestNews(latestRes.data.data);
          setTrendingNews(trendingRes.data.data);
        }
      } catch (error) {
        setError('Не удалось загрузить публикации. Проверьте подключение и повторите попытку.');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [searchQuery]);

  if (loading) return <Loading />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {error && <div role="alert" className="bg-red-50 border border-red-100 rounded-xl p-6 mb-8">{error} <button onClick={() => window.location.reload()} className="underline ml-2">Повторить</button></div>}
      {!searchQuery && <section className="editorial-hero mb-10"><div className="relative z-10 max-w-2xl"><p className="uppercase text-xs tracking-widest font-semibold text-primary-300 mb-4">Новости · Наука · Жизнь кампуса</p><h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">Истории, которые<br/>объединяют университет.</h1><p className="text-slate-300 mt-5 text-base md:text-lg max-w-lg">Открытия, люди и события нашего сообщества. Будьте в курсе того, что происходит рядом.</p><Link to="/category/local" className="inline-flex mt-6 bg-white text-gray-900 px-5 py-3 rounded-lg text-sm font-semibold">Жизнь кампуса →</Link></div><div className="hero-orbit" aria-hidden="true"/></section>}
      {searchQuery ? (
        <>
          <h1 className="text-2xl font-bold mb-6">
            Результаты поиска: «{searchQuery}»
          </h1>
          {latestNews.length === 0 ? (
            <p className="text-gray-600">По вашему запросу ничего не найдено.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestNews.map((news) => (
                <NewsCard key={news._id} news={news} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Featured Section */}
          {featuredNews.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Главное сегодня</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {featuredNews[0] && (
                  <NewsCard news={featuredNews[0]} variant="featured" />
                )}
                <div className="space-y-4">
                  {featuredNews.slice(1).map((news) => (
                    <NewsCard key={news._id} news={news} variant="horizontal" />
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Latest News */}
            <section className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6">Последние публикации</h2>
              {latestNews.length === 0 && !error && <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">Публикации появятся здесь после проверки редакцией.</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {latestNews.map((news) => (
                  <NewsCard key={news._id} news={news} />
                ))}
              </div>
            </section>

            {/* Trending Sidebar */}
            <aside>
              <h2 className="text-2xl font-bold mb-6">Самое читаемое</h2>
              <div className="space-y-4">
                {trendingNews.map((news, index) => (
                  <div key={news._id} className="flex gap-4">
                    <span className="text-3xl font-bold text-gray-300">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <NewsCard news={news} variant="horizontal" />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
