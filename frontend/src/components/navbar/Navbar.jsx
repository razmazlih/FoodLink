import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import { useTranslation } from 'react-i18next';
import CartNavbar from '../cart/CartNavbar';
import './Navbar.css';

const Navbar = ({ changeLanguage }) => {
    const { isLoggedIn, handleLogout } = useContext(AuthContext);
    const { showing, setShowing } = useContext(CartContext);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { t, i18n } = useTranslation();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const toggleLanguage = () => {
        const newLanguage = i18n.language === 'en' ? 'he' : 'en';
        changeLanguage(newLanguage);
        setIsMenuOpen(false);
    };

    return (
        <>
            <nav className="navbar" aria-label={t('mainNavigation')}>
                <div className="navbar-header">
                    <Link to="/" className="navbar-title" onClick={closeMenu}>FoodLink<span aria-hidden="true">✳</span></Link>
                    
                    {/* כפתור שינוי שפה חיצוני - רק במסכים גדולים */}
                    {!isMobile && (
                        <div className="language-selector">
                            <button onClick={toggleLanguage}>
                                {i18n.language === 'en' ? '🇮🇱 עברית' : '🇺🇸 English'}
                            </button>
                        </div>
                    )}

                    <button className="navbar-toggle" onClick={toggleMenu} aria-label={t('toggleMenu')} aria-expanded={isMenuOpen} aria-controls="customer-navigation">
                        ☰
                    </button>
                </div>
                <ul id="customer-navigation" className={`navbar-list ${isMenuOpen ? 'open' : ''}`}>
                    {[
                        { name: t('home'), link: '/' },
                        { name: t('about'), link: '/about' },
                        { name: t('howItWorks'), link: '/how-it-works' },
                        { name: t('restaurants'), link: '/restaurants' },
                    ].map((item, index) => (
                        <li key={index} className="navbar-item">
                            <NavLink to={item.link} end={item.link === '/'} className="navbar-link" onClick={closeMenu}>
                                {item.name}
                            </NavLink>
                        </li>
                    ))}

                    {isLoggedIn ? (
                        <>
                            <li className="navbar-item">
                                <Link to={'/my-orders'} className="navbar-link" onClick={closeMenu}>
                                    {t('myOrders')}
                                </Link>
                            </li>
                            <li className="navbar-item"><Link to="/my-addresses" className="navbar-link" onClick={closeMenu}>{t('myAddresses')}</Link>
                            </li>
                            <li className="navbar-item">
                                <button type="button" className="navbar-link" aria-expanded={showing} onClick={() => { setShowing(!showing); closeMenu(); }}>
                                    {t('myCart')}
                                </button>
                            </li>
                            <li className="navbar-item">
                                <Link to="/login" className="navbar-link" onClick={() => { handleLogout(); closeMenu(); }}>
                                    {t('logout')}
                                </Link>
                            </li>
                        </>
                    ) : (
                        <li className="navbar-item">
                            <Link to={'/login'} className="navbar-link" onClick={closeMenu}>
                                {t('login')}
                            </Link>
                        </li>
                    )}

                    {/* כפתור שינוי שפה פנימי - רק במסכים קטנים כשהתפריט פתוח */}
                    {isMobile && isMenuOpen && (
                        <li className="language-selector">
                            <button onClick={toggleLanguage}>
                                {i18n.language === 'en' ? '🇮🇱 עברית' : '🇺🇸 English'}
                            </button>
                        </li>
                    )}
                </ul>
                {showing && <CartNavbar />}
            </nav>
            <div className={`navbar-space ${isMenuOpen && 'active'} ${isLoggedIn && 'login'}`}></div>
        </>
    );
};

export default Navbar;