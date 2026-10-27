import './AboutMain.css';
import { useTranslation } from 'react-i18next';

function AboutMain() {
    const { t } = useTranslation();

    return (
        <div className="about-container">
            <h1 className="about-title">{t('aboutTitle')}</h1>
            <p className="about-text">
                {t('aboutIntro')}
                <span className="highlight">Django</span> {t('and')}
                <span className="highlight"> FastAPI</span>, {t('aboutWebsocket')}
                <span className="highlight">WebSocket</span> {t('forRealTimeUpdates')}.
            </p>
            <p className="about-text">
                {t('aboutServices')}
                <span className="highlight">{t('userManagement')}</span>,
                <span className="highlight">{t('restaurantManagement')}</span>, {t('and')}
                <span className="highlight">{t('orderManagement')}</span>. {t('aboutGoal')}
            </p>
            <p className="about-text">{t('aboutFeatures')}:</p>
            <ul className="features-list">
                <li>{t('featureUserRegistration')}</li>
                <li>{t('featureViewingMenus')}</li>
                <li>{t('featureTrackingOrders')}</li>
                <li>{t('featureMonitoringStatus')}</li>
            </ul>
            <p className="about-text">
                {t('aboutLearning')}
                <span className="highlight">PostgreSQL</span> {t('aboutDatabases')}.
            </p>
            <p className="about-text">{t('aboutDesign')}</p>
            <p className="about-text">{t('aboutChallenges')}</p>
            <p className="about-text">{t('aboutPersonalUse')}</p>
        </div>
    );
}

export default AboutMain;