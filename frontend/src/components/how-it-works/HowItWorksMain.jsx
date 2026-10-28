import './HowItWorksMain.css';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const services = [
    { title: 'userManagementTitle', description: 'userManagementDesc', icon: '01', docs: 'https://userbase-xqd2.onrender.com', github: 'https://github.com/razmazlih/UserBase' },
    { title: 'restaurantManagementTitle', description: 'restaurantManagementDesc', icon: '02', docs: 'https://dishboard.onrender.com', github: 'https://github.com/razmazlih/DishBoard' },
    { title: 'orderManagementTitle', description: 'orderManagementDesc', icon: '03', docs: 'https://orderline.onrender.com/docs', github: 'https://github.com/razmazlih/OrderLine' },
    { title: 'realTimeUpdatesTitle', description: 'realTimeUpdatesDesc', icon: '04' },
    { title: 'paymentsTitle', description: 'paymentsDesc', icon: '05' },
    { title: 'learningTitle', description: 'learningDesc', icon: '06' },
];
function HowItWorksMain() {
    const { t } = useTranslation();
    return (
        <div className="how-it-works-container">
            <header className="info-page-hero"><span className="section-eyebrow">{t('heroEyebrow')}</span><h1 className="how-it-works-title">{t('howItWorksTitle')}</h1><p>{t('howItWorksIntro')}</p><Link className="info-primary-link" to="/restaurants">{t('restaurants')} <span aria-hidden="true">↗</span></Link><span className="info-hero-art" aria-hidden="true">↗</span></header>
            <ol className="how-it-works-steps">{services.map(service => <li className="step-item" key={service.title}><span className="step-number" aria-hidden="true">{service.icon}</span><h2>{t(service.title)}</h2><p>{t(service.description)}</p>{service.docs && <div className="service-links"><span>{t('links')}</span><a href={service.docs} target="_blank" rel="noopener noreferrer" className="service-link">{t('documentation')} <span aria-hidden="true">↗</span></a><a href={service.github} target="_blank" rel="noopener noreferrer" className="service-link">GitHub <span aria-hidden="true">↗</span></a></div>}</li>)}</ol>
        </div>
    );
}
export default HowItWorksMain;
