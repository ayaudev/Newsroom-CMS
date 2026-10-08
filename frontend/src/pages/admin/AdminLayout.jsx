import { useState } from 'react';
import { toast } from 'react-toastify';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { FiHome, FiFileText, FiPlusCircle, FiSettings, FiArrowLeft, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const AdminLayout = () => {
  const { isAdmin, user, loading, logout } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); }
    catch { toast.error('Не удалось завершить сеанс. Повторите попытку.'); }
    finally { setLoggingOut(false); }
  };

  if (loading) return <div className="p-8">Загрузка...</div>;
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { to: '/admin', icon: FiHome, label: "Обзор редакции", end: true },
    { to: '/admin/news', icon: FiFileText, label: "Публикации" },
    { to: '/admin/news/create', icon: FiPlusCircle, label: "Новая публикация" },
    { to: '/admin/comments', icon: FiFileText, label: 'Модерация' },
    { to: '/admin/categories', icon: FiSettings, label: 'Категории' }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-gray-900 md:min-h-screen md:fixed">
          <div className="p-6">
            <h2 className="text-white text-xl font-bold">Newsroom CMS</h2>
            <p className="text-gray-400 text-sm mt-1">Здравствуйте, {user?.name}</p>
          </div>

          <nav className="mt-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${
                    isActive ? 'bg-gray-800 text-white border-l-4 border-primary-500' : ''
                  }`
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="md:absolute bottom-0 left-0 right-0 p-6">
            <NavLink
              to="/"
              className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
            >
              <FiArrowLeft size={20} />
              Перейти на сайт
            </NavLink>
            <button disabled={loggingOut} onClick={handleLogout} className="flex items-center gap-3 text-gray-400 hover:text-white mt-4"><FiLogOut size={20} />{loggingOut ? 'Выход...' : 'Выйти'}</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="md:ml-64 flex-1 min-w-0 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
