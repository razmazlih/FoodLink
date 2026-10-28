import Feedback from './components/Feedback/Feedback';
import React, { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import RestaurantsPage from './pages/RestaurantsPage';
import OrdersPage from './pages/OrdersPage';
import Navbar from './components/Navbar/Navbar';
import OrderDetails from './components/Orders/OrderDetails';
import RestaurantDetails from './components/Restaurants/RestaurantDetails';
import RestaurantForm from './components/Restaurants/RestaurantForm';

function Protected({ children, admin = false }) {
  const { auth } = useContext(AuthContext);
  if (!auth.user) return <Navigate to="/" replace />;
  if (admin && auth.user.role !== 'admin') return <Navigate to="/restaurants" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <a className="skip-link" href="#main-content">Skip to workspace</a>
      <Navbar />
      <Feedback />
      <main className="management-main" id="main-content">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<Protected admin><DashboardPage /></Protected>} />
        <Route path="/users" element={<Protected admin><UsersPage /></Protected>} />
        <Route path="/restaurants" element={<Protected><RestaurantsPage /></Protected>} />
        <Route path="/restaurants/:restaurantId" element={<Protected><RestaurantDetails /></Protected>} />
        <Route path="/restaurants/create" element={<Protected><RestaurantForm /></Protected>} />
        <Route path="/orders/:orderId" element={<Protected><OrderDetails /></Protected>} />
        <Route path="/orders" element={<Protected><OrdersPage /></Protected>} />
      </Routes>
      </main>
    </Router>
  );
}

export default App;