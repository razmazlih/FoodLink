import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { registerUser } from '../../services/Userbase/api';
import './Register.css';

function Register() {
    const { t } = useTranslation();
    const { handleLogin } = useContext(AuthContext);
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [city, setCity] = useState('');
    const [streetName, setStreetName] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [errors, setErrors] = useState({}); // שמירת שגיאות לכל שדה

    const handleSubmit = (event) => {
        event.preventDefault();
        setErrors({});
        registerUser({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password,
            phone_number: phoneNumber,
            city,
            street_name: streetName,
            house_number: houseNumber,
        })
            .then((user) => {
                handleLogin(user);
                navigate('/restaurants');
            })
            .catch((error) => {
                if (error.response && error.response.data) {
                    setErrors(error.response.data);
                } else {
                    setErrors({ general: t('registrationError') });
                }
                console.error('Error registering user:', error);
            });
    };

    return (
        <div className="register-container">
            <span className="auth-mark" aria-hidden="true">✳</span>
            <span className="section-eyebrow">{t('joinFoodLink')}</span>
            <h1 className="register-title">{t('register')}</h1>
            <p className="auth-description">{t('registerLead')}</p>
            <form className="register-form" onSubmit={handleSubmit}>
                <label htmlFor="register-username">{t('username')}</label>
                <input id="register-username" name="username" autoComplete="nickname"
                    className={`register-input ${errors.username ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('username')} aria-label={t('username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                {errors.username && <div className="error-message">{t(errors.username[0])}</div>}

                <label htmlFor="register-email">{t('email')}</label>
                <input id="register-email" name="email" autoComplete="email" className={`register-input ${errors.email ? 'input-error' : ''}`}
                    type="email" placeholder={t('email')} aria-label={t('email')} value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                {errors.email && <div className="error-message">{errors.email[0]}</div>}

                <label htmlFor="register-password">{t('password')}</label>
                <input id="register-password" name="password" autoComplete="new-password"
                    className={`register-input ${errors.password ? 'input-error' : ''}`}
                    type="password"
                    placeholder={t('password')} aria-label={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                {errors.password && <div className="error-message">{t(errors.password[0])}</div>}

                <label htmlFor="register-phone_number">{t('phoneNumber')}</label>
                <input id="register-phone_number" name="phone_number" autoComplete="tel"
                    className={`register-input ${errors.phone_number ? 'input-error' : ''}`}
                    type="tel"
                    placeholder={t('phoneNumber')} aria-label={t('phoneNumber')}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
                {errors.phone_number && <div className="error-message">{t(errors.phone_number[0])}</div>}

                <label htmlFor="register-city">{t('city')}</label>
                <input id="register-city" name="city" autoComplete="address-level2"
                    className={`register-input ${errors.city ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('city')} aria-label={t('city')}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                />
                {errors.city && <div className="error-message">{t(errors.city[0])}</div>}

                <label htmlFor="register-street_name">{t('streetName')}</label>
                <input id="register-street_name" name="street_name" autoComplete="address-line1"
                    className={`register-input ${errors.street_name ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('streetName')} aria-label={t('streetName')}
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                />
                {errors.street_name && <div className="error-message">{t(errors.street_name[0])}</div>}

                <label htmlFor="register-house_number">{t('houseNumber')}</label>
                <input id="register-house_number" name="house_number" autoComplete="address-line2"
                    className={`register-input ${errors.house_number ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('houseNumber')} aria-label={t('houseNumber')}
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                />
                {errors.house_number && <div className="error-message">{t(errors.house_number[0])}</div>}

                <button className="register-button" type="submit">
                    {t('register')}
                </button>

                {errors.general && <div className="error-message error-general" role="alert">{errors.general}</div>}

                <p className="register-text">
                    {t('alreadyHaveAccount')}{' '}
                    <Link to="/login" className="register-link">
                        {t('login')}
                    </Link>
                </p>
            </form>
        </div>
    );
}

export default Register;