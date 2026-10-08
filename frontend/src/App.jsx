import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// User Pages
import Home from './pages/Home';
import NewsDetail from './pages/NewsDetail';
import Category from './pages/Category';
import Favorites from './pages/Favorites';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import NewsList from './pages/admin/NewsList';
import NewsForm from './pages/admin/NewsForm';

import Moderation from './pages/admin/Moderation';
import Categories from './pages/admin/Categories';

import MyPublications from './pages/MyPublications';
import SubmitArticle from './pages/SubmitArticle';
import SubmissionList from './pages/admin/SubmissionList';
import SubmissionReview from './pages/admin/SubmissionReview';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="submissions" element={<SubmissionList />} />
            <Route path="submissions/:id" element={<SubmissionReview />} />
            <Route path="comments" element={<Moderation />} />
            <Route path="categories" element={<Categories />} />
            <Route path="news" element={<NewsList />} />
            <Route path="news/create" element={<NewsForm />} />
            <Route path="news/:id" element={<NewsForm />} />
          </Route>

          {/* User Routes */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex flex-col bg-gray-50">
                <Navbar />
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/news/:slug" element={<NewsDetail />} />
                    <Route path="/category/:category" element={<Category />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/my/posts" element={<MyPublications />} />
                    <Route path="/my/posts/create" element={<SubmitArticle />} />
                    <Route path="/my/posts/:id" element={<SubmitArticle />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            }
          />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
