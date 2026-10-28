import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { userCredentials } from '../../services/Userbase/api';
import './Login.css';

function Login() {
    const { t } = useTranslation();
    const { handleLogin } = useContext(AuthContext);
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (event) => {
        event.preventDefault();
        setError('');
        userCredentials({
            email: username.trim().toLowerCase(),
            password,
        })
            .then((response) => {
                handleLogin(response);
                navigate('/restaurants');
            })
            .catch(() => {
                setError(t('invalidCredentials'));
            });
    };

    return (
        <div className="login-container">
            <span className="auth-mark" aria-hidden="true">✳</span>
            <span className="section-eyebrow">{t('welcomeBack')}</span>
            <h1 className="login-title">{t('login')}</h1>
            <p className="auth-description">{t('loginLead')}</p>
            <form className="login-form" onSubmit={handleSubmit}>
                <label htmlFor="login-email">{t('email')}</label>
                <input id="login-email" name="email" autoComplete="email"
                    className="login-input"
                    type="email"
                    placeholder={t('email')} aria-label={t('email')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <label htmlFor="login-password">{t('password')}</label>
                <input id="login-password" name="password" autoComplete="current-password"
                    className="login-input"
                    type="password"
                    placeholder={t('password')} aria-label={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button className="login-button" type="submit">
                    {t('login')}
                </button>
                {error && <div className="error-message-login" role="alert">{error}</div>}
                <p className="login-text">
                    {t('noAccount')}{' '}
                    <Link to="/register" className="login-link">
                        {t('register')}
                    </Link>
                </p>
            </form>
        </div>
    );
}

export default Login;