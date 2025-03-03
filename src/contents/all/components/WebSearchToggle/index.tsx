import React from 'react';
import { Switch, Tooltip } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import storage from '@/utils/storage';
import { useLanguage } from '@/contexts/LanguageContext';

const WebSearchToggle: React.FC = () => {
    const [enabled, setEnabled] = React.useState(false);
    const { t } = useLanguage();

    React.useEffect(() => {
        const loadSetting = async () => {
            const webSearchEnabled = await storage.getWebSearchEnabled();
            setEnabled(webSearchEnabled ?? false);
        };

        loadSetting();
    }, []);

    const handleToggle = async (checked: boolean) => {
        setEnabled(checked);
        await storage.setWebSearchEnabled(checked);
    };

    return (
        <Tooltip title={t('webSearchTooltip' as any)}>
            <div className="web-search-toggle" style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 14px',
                background: '#fff',
                border: '1px solid rgb(229 231 235 / 50%)',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgb(0 0 0 / 5%), 0 1px 2px rgb(0 0 0 / 3%)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
            }}>
                <GlobalOutlined style={{ marginRight: 8, color: enabled ? '#4776e6' : '#4b5563' }} />
                <span style={{ fontSize: '13px', color: '#4b5563', marginRight: '8px' }}>
                    {t('webSearch' as any)}
                </span>
                <Switch
                    size="small"
                    checked={enabled}
                    onChange={handleToggle}
                    checkedChildren={t('on' as any)}
                    unCheckedChildren={t('off' as any)}
                />
            </div>
        </Tooltip>
    );
};

export default WebSearchToggle;
