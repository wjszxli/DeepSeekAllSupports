import { Form, Switch, InputNumber, Divider } from 'antd';
import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { t } from '@/locales/i18n';
import rootStore from '@/store';

interface InterfaceProps {
    form: any;
}

const Interface: React.FC<InterfaceProps> = observer(({ form }) => {
    const { settingStore } = rootStore;

    const onIsIconChange = (checked: boolean) => {
        settingStore.setIsChatBoxIcon(checked);
    };

    const onSizeChange = (field: 'width' | 'height', value: number | null) => {
        if (value && value > 0) {
            const currentSize = settingStore.getChatBoxSize();
            const newSize = { ...currentSize, [field]: value };
            settingStore.setChatBoxSize(newSize);
        }
    };

    const initData = async () => {
        const currentSize = settingStore.getChatBoxSize();
        form.setFieldsValue({
            isIcon: settingStore.isChatBoxIcon,
            useWebpageContext: settingStore.useWebpageContext,
            width: currentSize.width,
            height: currentSize.height,
        });
    };

    useEffect(() => {
        initData();
    }, []);

    return (
        <Form form={form} name="setting">
            <Form.Item
                className="form-item"
                label={t('showIcon')}
                name="isIcon"
                valuePropName="checked"
                initialValue={settingStore.isChatBoxIcon}
                tooltip={t('showIconTooltip')}
            >
                <Switch onChange={(checked) => onIsIconChange(checked)} />
            </Form.Item>

            <Form.Item
                className="form-item"
                label={t('includeWebpage')}
                name="useWebpageContext"
                valuePropName="checked"
                initialValue={settingStore.useWebpageContext}
                tooltip={t('includeWebpageTooltip')}
            >
                <Switch
                    onChange={(checked) => {
                        settingStore.setUseWebpageContext(checked);
                    }}
                />
            </Form.Item>

            <Divider />

            <Form.Item
                className="form-item"
                label={t('chatWindowSize')}
                tooltip={t('chatWindowSizeTooltip')}
            >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Form.Item
                        name="width"
                        style={{ margin: 0, flex: 1 }}
                        initialValue={settingStore.getChatBoxSize().width}
                    >
                        <InputNumber
                            min={350}
                            max={1200}
                            placeholder={t('width')}
                            addonBefore={t('width')}
                            onChange={(value) => onSizeChange('width', value)}
                        />
                    </Form.Item>
                    <span>×</span>
                    <Form.Item
                        name="height"
                        style={{ margin: 0, flex: 1 }}
                        initialValue={settingStore.getChatBoxSize().height}
                    >
                        <InputNumber
                            min={400}
                            max={1000}
                            placeholder={t('height')}
                            addonBefore={t('height')}
                            onChange={(value) => onSizeChange('height', value)}
                        />
                    </Form.Item>
                </div>
            </Form.Item>
        </Form>
    );
});

export default Interface;
