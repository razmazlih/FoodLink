import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { registerUser, userCredentials } from '../../services/Userbase/api';
import './Register.css';

function Register() {
    const { t } = useTranslation();
    const { handleLogin } = useContext(AuthContext);
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [city, setCity] = useState('');
    const [streetName, setStreetName] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [errors, setErrors] = useState({}); // שמירת שגיאות לכל שדה

    const handleSubmit = () => {
        setErrors({});
        registerUser({
            username: username.toLowerCase(),
            password,
            phone_number: phoneNumber,
            city,
            street_name: streetName,
            house_number: houseNumber,
        })
            .then((userInfo) => {
                userCredentials({
                    username: userInfo.username,
                    password,
                })
                    .then((accessToken) => {
                        handleLogin(accessToken);
                        navigate('/restaurants');
                    })
                    .catch((error) => {
                        setErrors({ general: t('registrationFailed') });
                        console.error('Error in userCredentials:', error);
                    });
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
            <h1 className="register-title">{t('register')}</h1>
            <div className="register-form">
                <input
                    className={`register-input ${errors.username ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                {errors.username && <div className="error-message">{t(errors.username[0])}</div>}

                <input
                    className={`register-input ${errors.password ? 'input-error' : ''}`}
                    type="password"
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                {errors.password && <div className="error-message">{t(errors.password[0])}</div>}

                <input
                    className={`register-input ${errors.phone_number ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('phoneNumber')}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
                {errors.phone_number && <div className="error-message">{t(errors.phone_number[0])}</div>}

                <input
                    className={`register-input ${errors.city ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('city')}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                />
                {errors.city && <div className="error-message">{t(errors.city[0])}</div>}

                <input
                    className={`register-input ${errors.street_name ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('streetName')}
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                />
                {errors.street_name && <div className="error-message">{t(errors.street_name[0])}</div>}

                <input
                    className={`register-input ${errors.house_number ? 'input-error' : ''}`}
                    type="text"
                    placeholder={t('houseNumber')}
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                />
                {errors.house_number && <div className="error-message">{t(errors.house_number[0])}</div>}

                <button className="register-button" onClick={handleSubmit}>
                    {t('register')}
                </button>

                {errors.general && <div className="error-message error-general">{errors.general}</div>}

                <p className="register-text">
                    {t('alreadyHaveAccount')}{' '}
                    <Link to="/login" className="register-link">
                        {t('login')}
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Register;