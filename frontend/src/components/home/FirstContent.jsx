import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import './FirstContent.css';

function FirstContent() {
    const { t } = useTranslation();

    return (
        <div className="first-content">
            <h2 className="first-content-h2">{t('deliciousDeliveries')}</h2>
            <p className="first-content-p">{t('hotFreshReady')}</p>
            <div>
                <Link to={'/restaurants'}>
                    <button className="first-content-button">{t('orderNow')}</button>
                </Link>
                <Link to={'/how-it-works'}>
                    <button className="first-content-button">{t('ourServices')}</button>
                </Link>
            </div>
        </div>
    );
}

export default FirstContent;