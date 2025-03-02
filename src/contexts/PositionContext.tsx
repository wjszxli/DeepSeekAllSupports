import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PositionConfig {
    enabled: boolean;
    left?: number;
    top?: number;
}

interface PositionContextType {
    positionConfig: PositionConfig;
    togglePositionMemory: () => void;
    updatePosition: (left: number, top: number) => void;
}

const PositionContext = createContext<PositionContextType | undefined>(undefined);

export const PositionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [positionConfig, setPositionConfig] = useState<PositionConfig>({
        enabled: false,
    });

    const togglePositionMemory = () => {
        setPositionConfig(prev => ({
            ...prev,
            enabled: !prev.enabled
        }));
    };

    const updatePosition = (left: number, top: number) => {
        setPositionConfig(prev => ({
            ...prev,
            left,
            top
        }));
    };

    return (
        <PositionContext.Provider value={{ positionConfig, togglePositionMemory, updatePosition }}>
            {children}
        </PositionContext.Provider>
    );
};

export const usePositionConfig = (): PositionContextType => {
    const context = useContext(PositionContext);
    if (context === undefined) {
        throw new Error('usePositionConfig must be used within a PositionProvider');
    }
    return context;
}; 