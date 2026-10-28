import { Link } from 'react-router-dom';
import FirstContent from './FirstContent';
import { useTranslation } from 'react-i18next';
import './HomeMain.css';

function HomeMain() {
    const { t } = useTranslation();
    const features = [
        { icon: '↗', title: 'restaurantDiscovery', text: 'exploreRestaurants' },
        { icon: '≋', title: 'menuBrowsing', text: 'viewMenus' },
        { icon: '◷', title: 'orderTracking', text: 'stayUpdated' },
    ];
    return (
        <div className="home-main">
            <FirstContent />
            <section className="home-discover">
                <div className="home-section-heading"><div><span className="section-eyebrow">{t('discoverFoodLink')}</span><h2>{t('yourGateway')}</h2></div><Link to="/restaurants">{t('restaurants')} <span aria-hidden="true">↗</span></Link></div>
                <p className="home-intro">{t('foodLinkIntro')}</p>
                <div className="home-feature-grid">{features.map((feature, index) => <article className="home-feature" key={feature.title}><div className="feature-top"><span className="feature-icon" aria-hidden="true">{feature.icon}</span><span className="feature-number">0{index + 1}</span></div><h3>{t(feature.title)}</h3><p>{t(feature.text)}</p></article>)}</div>
            </section>
            <section className="home-bottom-banner"><div><span className="section-eyebrow">{t('heroCaptionSmall')}</span><h2>{t('orderFromBest')}</h2></div><Link to="/restaurants">{t('orderNow')} <span aria-hidden="true">↗</span></Link></section>
        </div>
    );
}
export default HomeMain;
