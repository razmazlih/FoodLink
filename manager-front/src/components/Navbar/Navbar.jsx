import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { AuthContext } from '../../context/AuthContext';

function Navbar() {
  const { auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/dashboard">Admin Panel</Link>
      </div>
      <ul className="navbar-links">
        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link to="/users">Users</Link>
        </li>
        <li>
          <Link to="/restaurants">Restaurants</Link>
        </li>
        <li>
          <Link to="/orders">Orders</Link>
        </li>
      </ul>
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