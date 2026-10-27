import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeMain from './components/home/HomeMain';
import Navbar from './components/navbar/Navbar';
import RestaurantsMain from './components/restaurants/RestaurantsMain';
import MenuMain from './components/menu/MenuMain';
import Login from './components/users/Login';
import { AuthProvider } from './context/AuthContext';
import Register from './components/users/Register';
import AboutMain from './components/about/AboutMain';
import HowItWorksMain from './components/how-it-works/HowItWorksMain';
import { CartContextProvider } from './context/CartContext';
import Orders from './components/orders/Orders';
import OrderCheckoutMain from './components/checkout/OrderCheckoutMain';
import './i18n';
import { useEffect } from 'react';
import OrderDetailsMain from './components/order-detail/OrderDetailsMain';

function App() {
    const { i18n } = useTranslation();

    useEffect(() => {
        const savedLanguage = localStorage.getItem('language') || 'en';
        i18n.changeLanguage(savedLanguage);
        document.documentElement.lang = savedLanguage;
        document.documentElement.dir = savedLanguage === 'he' ? 'rtl' : 'ltr';
    }, [i18n]);

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        document.documentElement.lang = lng;
        document.documentElement.dir = lng === 'he' ? 'rtl' : 'ltr';
        localStorage.setItem('language', lng);
    };

    return (
        <Router>
            <AuthProvider>
                <CartContextProvider>
                    <Navbar changeLanguage={changeLanguage} />
                    <Routes>
                        <Route path="/" element={<HomeMain />} />
                        <Route
                            path="/restaurants"
                            element={<RestaurantsMain />}
                        />
                        <Route
                            path="/restaurants/:restaurantId"
                            element={<MenuMain />}
                        />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/about" element={<AboutMain />} />
                        <Route
                            path="/how-it-works"
                            element={<HowItWorksMain />}
                        />
                        <Route path="/my-orders" element={<Orders />} />
                        <Route
                            path="/my-orders/checkout/:orderId"
                            element={<OrderCheckoutMain />}
                        />
                        <Route path="/order-details/:orderId" element={<OrderDetailsMain />} />
                    </Routes>
                </CartContextProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
