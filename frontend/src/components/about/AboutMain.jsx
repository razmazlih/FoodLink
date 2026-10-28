import './AboutMain.css';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function AboutMain() {
    const { t } = useTranslation();
    return (
        <div className="about-container">
            <header className="info-page-hero"><span className="section-eyebrow">{t('discoverFoodLink')}</span><h1 className="about-title">{t('aboutTitle')} FoodLink</h1><p>{t('aboutPageLead')}</p><Link className="info-primary-link" to="/restaurants">{t('orderNow')} <span aria-hidden="true">↗</span></Link><span className="info-hero-art" aria-hidden="true">✳</span></header>
            <div className="about-story-grid">
                <section className="info-story-card"><span className="section-eyebrow">{t('aboutStoryTitle')}</span><h2>{t('aboutStoryHeading')}</h2><p className="about-text">{t('aboutIntro')}<span className="highlight">Django</span> {t('and')}<span className="highlight"> FastAPI</span>, {t('aboutWebsocket')}<span className="highlight">WebSocket</span> {t('forRealTimeUpdates')}.</p><p className="about-text">{t('aboutServices')}<span className="highlight">{t('userManagement')}</span>, <span className="highlight">{t('restaurantManagement')}</span>, {t('and')}<span className="highlight">{t('orderManagement')}</span>. {t('aboutGoal')}</p></section>
                <section className="info-feature-card"><span className="section-eyebrow">{t('aboutFeatures')}</span><h2>{t('aboutFeaturesHeading')}</h2><ul className="features-list">{['featureUserRegistration','featureViewingMenus','featureTrackingOrders','featureMonitoringStatus'].map((key, index) => <li key={key}><span aria-hidden="true">0{index + 1}</span>{t(key)}</li>)}</ul></section>
            </div>
            <section className="about-learning-card"><div><span className="section-eyebrow">{t('learningTitle')}</span><h2>{t('aboutLearningHeading')}</h2></div><div><p className="about-text">{t('aboutLearning')}<span className="highlight">PostgreSQL</span> {t('aboutDatabases')}.</p><p className="about-text">{t('aboutDesign')}</p><p className="about-text">{t('aboutChallenges')}</p><p className="about-project-note"><span aria-hidden="true">ⓘ</span>{t('aboutPersonalUse')}</p></div></section>
        </div>
    );
}
export default AboutMain;
