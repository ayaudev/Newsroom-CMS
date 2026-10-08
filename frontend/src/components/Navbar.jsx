import {Link,useNavigate} from 'react-router-dom';
import {useState,useEffect} from 'react';
import {FiMenu,FiX,FiSearch,FiUser,FiLogOut} from 'react-icons/fi';
import {useAuth} from '../context/AuthContext';
import {toast} from 'react-toastify';
import {newsAPI} from '../services/api';
export default function Navbar(){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[categories,setCategories]=useState([]);
 const {user,isAuthenticated,isAdmin,logout}=useAuth();const navigate=useNavigate();
 useEffect(()=>{newsAPI.getCategories().then(r=>setCategories(r.data.data)).catch(()=>{});},[]);
 const [loggingOut,setLoggingOut]=useState(false);
 async function handleLogout(){
  if(loggingOut)return;
  setLoggingOut(true);
  try{await logout();setOpen(false);navigate('/');}
  catch(error){toast.error('Не удалось завершить сеанс. Проверьте подключение и повторите попытку.');}
  finally{setLoggingOut(false);}
 }
 function search(e){e.preventDefault();navigate(query.trim()?'/?search='+encodeURIComponent(query.trim()):'/');setOpen(false);}
 return <header className="site-header sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-4"><div className="flex items-center justify-between gap-4 py-4"><Link to="/" className="flex items-center gap-3 shrink-0"><span className="brand-mark">N<span>.</span></span><div><strong className="text-xl tracking-tight block">Newsroom CMS</strong><span className="text-xs text-gray-500">Университетская редакция</span></div></Link><form onSubmit={search} className="hidden lg:flex relative max-w-md flex-1"><FiSearch className="absolute left-3 top-3 text-gray-400"/><input aria-label="Поиск публикаций" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск публикаций..." className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4"/></form><div className="hidden md:flex items-center gap-4 text-sm">{isAuthenticated?<><Link to="/favorites">Избранное</Link>{isAdmin&&<Link to="/admin" className="text-primary-700 font-semibold">Редакция</Link>}<Link to="/profile" className="flex gap-2 items-center"><FiUser/>{user.name}</Link><button aria-label="Выйти" disabled={loggingOut} onClick={handleLogout}><FiLogOut/></button></>:<><Link to="/login">Войти</Link><Link to="/register" className="bg-primary-600 text-white px-4 py-2 rounded-lg">Регистрация</Link></>}</div><button onClick={()=>setOpen(!open)} aria-label="Меню" aria-expanded={open} className="md:hidden p-2">{open?<FiX/>:<FiMenu/>}</button></div><nav aria-label="Категории" className="hidden md:flex gap-6 overflow-x-auto py-3 border-t border-gray-100 text-sm"><Link to="/" className="font-semibold text-primary-700">Все публикации</Link>{categories.map(c=><Link key={c.id} to={'/category/'+c.slug} className="whitespace-nowrap text-gray-600 hover:text-primary-700">{c.name}</Link>)}</nav></div>{open&&<nav className="md:hidden px-4 pb-4 border-t"><form onSubmit={search} className="flex py-3 gap-2"><input aria-label="Поиск" className="border rounded-lg px-3 py-2 min-w-0 flex-1" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск публикаций..."/><button className="px-3 bg-primary-600 text-white rounded-lg">Найти</button></form><div className="grid grid-cols-2 gap-3">{categories.map(c=><Link onClick={()=>setOpen(false)} key={c.id} to={'/category/'+c.slug}>{c.name}</Link>)}{isAuthenticated?<><Link onClick={()=>setOpen(false)} to="/profile">Мой профиль</Link><Link onClick={()=>setOpen(false)} to="/favorites">Избранное</Link>{isAdmin&&<Link onClick={()=>setOpen(false)} to="/admin">Редакция</Link>}<button className="text-left text-red-600" disabled={loggingOut} onClick={handleLogout}>Выйти</button></>:<><Link onClick={()=>setOpen(false)} to="/login">Войти</Link><Link onClick={()=>setOpen(false)} to="/register">Регистрация</Link></>}</div></nav>}</header>;
}
