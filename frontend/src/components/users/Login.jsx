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

    const handleSubmit = () => {
        setError('');
        userCredentials({
            username: username.toLowerCase(),
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

    const handlePressEnter = (event) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <div className="login-container">
            <h1 className="login-title">{t('login')}</h1>
            <div className="login-form">
                <input
                    className="login-input"
                    type="text"
                    placeholder={t('username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handlePressEnter}
                />
                <input
                    className="login-input"
                    type="password"
                    placeholder={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handlePressEnter}
                />
                <button className="login-button" onClick={handleSubmit}>
                    {t('login')}
                </button>
                {error && <div className="error-message-login">{error}</div>}
                <p className="login-text">
                    {t('noAccount')}{' '}
                    <Link to="/register" className="login-link">
                        {t('register')}
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Login;