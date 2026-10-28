import React, { useContext } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { AuthContext } from '../../context/AuthContext';

function Navbar() {
  const { auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="navbar" aria-label="Management navigation">
      <div className="navbar-logo">
        <Link to={auth.user ? (auth.user.role === 'admin' ? '/dashboard' : '/restaurants') : '/'}><span className="brand-symbol" aria-hidden="true">f.</span> FoodLink <span className="brand-label">MANAGE</span></Link>
      </div>
      {auth.user && <ul className="navbar-links">
        {auth.user?.role === 'admin' && <>
          <li><NavLink to="/dashboard">Dashboard</NavLink></li>
          <li><NavLink to="/users">Users</NavLink></li>
        </>}
        <li>
          <NavLink to="/restaurants">Restaurants</NavLink>
        </li>
        <li>
          <NavLink to="/orders">Orders</NavLink>
        </li>
      </ul>}
      <div className="navbar-auth">
        {auth.user ? (
          <>
            <span className="navbar-username">Hello, {auth.user.name}</span>
            <button onClick={handleLogout} className="navbar-logout">
              Logout
            </button>
          </>
        ) : (
          <Link to="/">Login</Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;