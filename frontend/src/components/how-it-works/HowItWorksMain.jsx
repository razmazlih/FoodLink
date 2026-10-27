import './HowItWorksMain.css';
import { useTranslation } from 'react-i18next';

function HowItWorksMain() {
    const { t } = useTranslation();

    return (
        <div className="how-it-works-container">
            <h1 className="how-it-works-title">{t('howItWorksTitle')}</h1>
            <div className="how-it-works-content">
                <p className="intro-text">{t('howItWorksIntro')}</p>
                <ol className="how-it-works-steps">
                    <li className="step-item">
                        <strong>{t('userManagementTitle')}:</strong> {t('userManagementDesc')}
                        <br />
                        {t('links')}:
                        <a
                            href="https://userbase-xqd2.onrender.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="service-link"
                        >
                            {t('documentation')}
                        </a>{' '}
                        |
                        <a
                            href="https://github.com/razmazlih/UserBase"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="service-link"
                        >
                            GitHub
                        </a>
                    </li>
                    <li className="step-item">
                        <strong>{t('restaurantManagementTitle')}:</strong> {t('restaurantManagementDesc')}
                        <br />
                        {t('links')}:
                        <a
                            href="https://dishboard.onrender.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="service-link"
                        >
                            {t('documentation')}
                        </a>{' '}
                        |
                        <a
                            href="https://github.com/razmazlih/DishBoard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="service-link"
                        >
                            GitHub
                        </a>
                    </li>
                    <li className="step-item">
                        <strong>{t('orderManagementTitle')}:</strong> {t('orderManagementDesc')}
                        <br />
                        {t('links')}:
                        <a
                            href="https://orderline.onrender.com/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="service-link"
                        >
                            {t('documentation')}
                        </a>{' '}
                        |
                        <a
                            href="https://github.com/razmazlih/OrderLine"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="service-link"
                        >
                            GitHub
                        </a>
                    </li>
                    <li className="step-item">
                        <strong>{t('realTimeUpdatesTitle')}:</strong> {t('realTimeUpdatesDesc')}
                    </li>
                    <li className="step-item">
                        <strong>{t('paymentsTitle')}:</strong> {t('paymentsDesc')}
                    </li>
                    <li className="step-item">
                        <strong>{t('learningTitle')}:</strong> {t('learningDesc')}
                    </li>
                </ol>
            </div>
        </div>
    );
}

export default HowItWorksMain;