import FirstContent from './FirstContent';
import TemplateContent from './TemplateContent';
import { useTranslation } from 'react-i18next';
import './HomeMain.css';

function HomeMain() {
    const { t } = useTranslation();

    const myItems = [
        {
            topic: t('restaurantDiscovery'),
            content: t('exploreRestaurants'),
        },
        {
            topic: t('orderTracking'),
            content: t('stayUpdated'),
        },
        {
            topic: t('menuBrowsing'),
            content: t('viewMenus'),
        },
    ];

    const contentToRender = [
        {
            topHeader: <h3 className="first-content-h3">{t('discoverFoodLink')}</h3>,
            mainHeader: <h2 className="first-content-h2">{t('yourGateway')}</h2>,
            paragraph: (
                <p className="first-content-p">
                    {t('foodLinkIntro')}
                </p>
            ),
            button: t('aboutProject'),
            link: '/about'
        },
        {
            topHeader: <h3 className="first-content-h3">{t('deliciousDeliveries')}</h3>,
            mainHeader: <h2 className="first-content-h2">{t('orderFromBest')}</h2>,
            paragraph: myItems.map((item, index) => (
                <li className="first-content-li" key={index}>
                    <strong>{item.topic}:</strong> {item.content}
                </li>
            )),
        },
    ];

    const mapItems = contentToRender.map((content, index) => (
        <TemplateContent
            key={index}
            topHeader={content.topHeader}
            mainHeader={content.mainHeader}
            paragraph={content.paragraph}
            button={content.button}
        />
    ));

    return (
        <div className="home-main">
            <FirstContent />
            {mapItems}
        </div>
    );
}

export default HomeMain;