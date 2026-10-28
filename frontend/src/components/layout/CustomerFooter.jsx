import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function CustomerFooter() {
    const { t } = useTranslation();
    return <footer className="customer-footer shared-customer-footer"><div><Link className="footer-brand" to="/">FoodLink<span aria-hidden="true">✳</span></Link><p>{t('heroNote')}</p></div><nav aria-label={t('footerNavigation')}><Link to="/restaurants">{t('restaurants')}</Link><Link to="/how-it-works">{t('howItWorks')}</Link><Link to="/about">{t('aboutProject')}</Link></nav><span className="footer-signoff">{t('heroEyebrow')}</span></footer>;
}
export default CustomerFooter;
