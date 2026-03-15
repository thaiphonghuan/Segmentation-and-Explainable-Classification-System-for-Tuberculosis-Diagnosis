import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => (location.pathname === path ? 'nav-link active' : 'nav-link');

  return (
    <header className="navbar">
      <div className="navbar-left">
        <span className="navbar-logo">AI Hỗ trợ chẩn đoán ảnh y tế</span>
      </div>
      <nav className="navbar-right">
        {isAuthenticated ? (
          <>
            <Link className={isActive('/segmentation')} to="/segmentation">
              Segmentation
            </Link>
            <Link className={isActive('/classification')} to="/classification">
              Classification + XAI
            </Link>
            <span className="navbar-user">Xin chào, {user?.fullName}</span>
            <button className="btn btn-outline" onClick={handleLogout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link className={isActive('/login')} to="/login">
              Đăng nhập
            </Link>
            <Link className={isActive('/register')} to="/register">
              Đăng ký
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

