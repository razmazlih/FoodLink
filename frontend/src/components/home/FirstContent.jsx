import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './FirstContent.css';

function FirstContent() {
    const { t } = useTranslation();
    return (
        <section className="first-content">
            <div className="hero-copy">
                <span className="hero-eyebrow"><span aria-hidden="true">✳</span> {t('heroEyebrow')}</span>
                <h1>{t('heroTitle')}</h1>
                <p>{t('hotFreshReady')}</p>
                <div className="hero-actions">
                    <Link className="hero-primary" to="/restaurants">{t('orderNow')} <span aria-hidden="true">↗</span></Link>
                    <Link className="hero-secondary" to="/how-it-works">{t('howItWorks')}</Link>
                </div>
                <div className="hero-note"><span aria-hidden="true">●</span> {t('heroNote')}</div>
            </div>
            <div className="hero-visual" aria-hidden="true">
                <div className="hero-orbit" />
                <div className="hero-photo" />
                <div className="hero-sticker">Food<br /><strong>mood.</strong><span>✳</span></div>
                <div className="hero-caption"><span>↗</span><div><strong>{t('heroCaption')}</strong><small>{t('heroCaptionSmall')}</small></div></div>
            </div>
        </section>
    );
}
export default FirstContent;
