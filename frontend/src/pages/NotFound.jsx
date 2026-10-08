import { Link } from 'react-router-dom';
import { FiHome, FiArrowLeft } from 'react-icons/fi';

const NotFound = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-600">404</h1>
        <h2 className="text-3xl font-bold text-gray-800 mt-4">Страница не найдена</h2>
        <p className="text-gray-600 mt-4 max-w-md">
          Эта страница не существует или была перемещена.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <FiArrowLeft />
            Назад
          </button>
          <Link
            to="/"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <FiHome />
            Главная
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
