import { useNavigate } from 'react-router-dom';
import './TemplateContent.css';

function TemplateContent({ topHeader, mainHeader, paragraph, button }) {
    const navigate = useNavigate();

    const buttonTag = button ? <button onClick={() => navigate('/about')}>{button}</button> : null;

    return (
        <div className="template-content">
            {topHeader}
            {mainHeader}
            {paragraph}
            {buttonTag}
        </div>
    );
}

export default TemplateContent;