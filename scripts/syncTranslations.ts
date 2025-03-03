import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
    'en',
    'zh-CN',
    'zh-TW',
    'ja',
    'ko',
    'fr',
    'de',
    'es',
    'ru',
];

// 语言文件路径
const LOCALES_DIR = path.resolve(__dirname, '../src/locales');

// 类型定义
interface TranslationObject {
    [key: string]: string | TranslationObject;
}

// 从 TypeScript 文件中提取翻译对象
function parseTypeScriptFile(filePath: string, langCode: string): TranslationObject {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    try {
        // 读取文件内容
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // 使用正则表达式提取翻译对象
        // 匹配 export const langCode = { ... } 或 export default { ... }
        const exportRegex = new RegExp(
            `export\\s+(const\\s+${langCode}\\s*=|default)\\s*({[\\s\\S]*?})\\s*;?\\s*$`,
            'i',
        );
        const match = fileContent.match(exportRegex);

        if (!match || !match[2]) {
            console.warn(`Could not find export in ${filePath}`);

            // 尝试直接读取文件内容并解析
            console.log(`Attempting to extract translations using a temporary file...`);

            // 创建一个临时文件，将内容转换为可执行的 JS
            const tempFilePath = path.join(__dirname, 'temp_translation.js');

            // 替换 export 语句，提取对象内容
            let processedContent = fileContent
                .replace(/export\s+const\s+\w+\s*=\s*/, 'module.exports = ')
                .replace(/export\s+default\s+/, 'module.exports = ');

            fs.writeFileSync(tempFilePath, processedContent);

            try {
                // 使用 require 加载临时文件
                const translations = require(tempFilePath);
                // 删除临时文件
                fs.unlinkSync(tempFilePath);
                // 清除 require 缓存
                delete require.cache[require.resolve(tempFilePath)];

                return translations;
            } catch (requireError) {
                console.error(`Error requiring temp file: ${requireError}`);
                // 如果 require 失败，删除临时文件
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                return {};
            }
        }

        // 解析对象字符串为 JavaScript 对象
        try {
            // 创建一个临时文件，将对象字符串转换为 JSON
            const tempFilePath = path.join(__dirname, 'temp_translation.js');
            const tempFileContent = `
                const obj = ${match[2]};
                console.log(JSON.stringify(obj));
            `;

            fs.writeFileSync(tempFilePath, tempFileContent);

            // 执行临时文件并获取输出
            const output = execSync(`node "${tempFilePath}"`).toString();

            // 删除临时文件
            fs.unlinkSync(tempFilePath);

            // 解析 JSON 输出
            return JSON.parse(output);
        } catch (evalError) {
            console.error(`Error evaluating object: ${evalError}`);
            return {};
        }
    } catch (error) {
        console.error(
            `Error parsing ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {};
    }
}

// 从文件中提取所有翻译键（递归）
function extractKeys(obj: TranslationObject, prefix = ''): string[] {
    let keys: string[] = [];

    for (const key in obj) {
        const currentKey = prefix ? `${prefix}.${key}` : key;

        if (typeof obj[key] === 'string') {
            keys.push(currentKey);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = [...keys, ...extractKeys(obj[key] as TranslationObject, currentKey)];
        }
    }

    return keys;
}

// 根据键路径获取对象中的值
function getValueByPath(obj: TranslationObject, path: string): string | undefined {
    const parts = path.split('.');
    let current: any = obj;

    for (const part of parts) {
        if (current[part] === undefined) {
            return undefined;
        }
        current = current[part];
    }

    return typeof current === 'string' ? current : undefined;
}

// 根据键路径设置对象中的值
function setValueByPath(obj: TranslationObject, path: string, value: string): void {
    const parts = path.split('.');
    let current: any = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
            current[part] = {};
        }
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
}

// 使用 DeepSeek API 翻译文本
async function translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
): Promise<string> {
    try {
        // 准备语言代码（从 'zh-CN' 格式转换为 'Chinese' 格式）
        const languageMap: Record<string, string> = {
            'zh-CN': 'Chinese',
            'en': 'English',
            'ja': 'Japanese',
            'ko': 'Korean',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'ru': 'Russian',
            'zh-TW': 'Chinese (Traditional)',
        };

        const sourceLanguage = languageMap[sourceLang] || 'English';
        const targetLanguage = languageMap[targetLang] || 'English';

        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve any formatting, variables, or special characters. Only return the translated text without any explanations.`,
                    },
                    {
                        role: 'user',
                        content: text,
                    },
                ],
                temperature: 0.3,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                },
            },
        );

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error(
            `Translation error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return text; // 出错时返回原文
    }
}

// 保存语言文件
function saveLanguageFile(lang: string, data: TranslationObject): void {
    const filePath = path.join(LOCALES_DIR, `${lang}.ts`);

    // 格式化对象为字符串，保持缩进
    const formatObject = (obj: TranslationObject, indent = 2): string => {
        const spaces = ' '.repeat(indent);
        let result = '{\n';

        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                // 处理字符串中的引号
                const value = (obj[key] as string).replace(/"/g, '\\"');
                result += `${spaces}"${key}": "${value}",\n`;
            } else if (obj[key] !== null && typeof obj[key] === 'object') {
                result += `${spaces}"${key}": ${formatObject(
                    obj[key] as TranslationObject,
                    indent + 2,
                )},\n`;
            }
        }

        // 移除最后一个逗号
        if (result.endsWith(',\n')) {
            result = result.slice(0, -2) + '\n';
        }

        return result + ' '.repeat(indent - 2) + '}';
    };

    // 获取语言代码变量名（例如：zhCN, enUS）
    const langVarName = lang.replace('-', '');

    const fileContent = `// 自动生成的翻译文件，请勿直接修改
// Generated on: ${new Date().toISOString()}

export const ${langVarName} = ${formatObject(data)};
`;

    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`✅ Saved ${lang}.ts`);
}

// 生成 TypeScript 类型定义文件
function generateTypeDefinition(keys: string[]): void {
    const typePath = path.join(LOCALES_DIR, 'translationKeys.ts');

    // 将点分隔的键转换为字符串联合类型
    const keyUnion = keys.map((key) => `'${key}'`).join(' | ');

    const fileContent = `// 自动生成的翻译键类型定义，请勿直接修改
// Generated on: ${new Date().toISOString()}

export type TranslationKey = ${keyUnion};
`;

    fs.writeFileSync(typePath, fileContent, 'utf8');
    console.log('✅ Generated translation key type definition');
}

// 主函数
async function main() {
    console.log('🔄 Starting translation sync...');

    if (!DEEPSEEK_API_KEY) {
        console.error('❌ DEEPSEEK_API_KEY not found in environment variables');
        process.exit(1);
    }

    // 确保目录存在
    if (!fs.existsSync(LOCALES_DIR)) {
        fs.mkdirSync(LOCALES_DIR, { recursive: true });
    }

    // 读取源语言文件 (zh-CN)
    const sourceLangPath = path.join(LOCALES_DIR, 'zh-CN.ts');
    if (!fs.existsSync(sourceLangPath)) {
        throw new Error(`Source language file not found: ${sourceLangPath}`);
    }

    const sourceData = parseTypeScriptFile(sourceLangPath, 'zh-CN');
    const sourceKeys = extractKeys(sourceData);

    console.log(`📝 Found ${sourceKeys.length} keys in source language (zh-CN)`);

    // 生成类型定义文件
    generateTypeDefinition(sourceKeys);

    // 处理每种目标语言
    for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === 'zh-CN') continue; // 跳过源语言

        console.log(`\n🔍 Processing ${lang}...`);
        const langPath = path.join(LOCALES_DIR, `${lang}.ts`);
        
        // 如果目标语言文件不存在，创建一个空对象
        let langData: TranslationObject = {};
        if (fs.existsSync(langPath)) {
            langData = parseTypeScriptFile(langPath, lang);
        }
        
        // 提取目标语言中已有的所有键
        const existingKeys = extractKeys(langData);
        
        // 找出在目标语言中存在但源语言中不存在的键（需要删除的键）
        const keysToRemove = existingKeys.filter(key => !sourceKeys.includes(key));
        
        if (keysToRemove.length > 0) {
            console.log(`🗑️ Removing ${keysToRemove.length} keys that don't exist in source language`);
            
            // 从目标语言数据中删除这些键
            for (const key of keysToRemove) {
                const parts = key.split('.');
                let current = langData;
                
                // 遍历路径直到倒数第二级
                for (let i = 0; i < parts.length - 1; i++) {
                    if (current[parts[i]] && typeof current[parts[i]] === 'object') {
                        current = current[parts[i]] as TranslationObject;
                    } else {
                        break; // 如果路径不存在，跳出循环
                    }
                }
                
                // 删除最后一级的键
                if (current && parts.length > 0) {
                    delete current[parts[parts.length - 1]];
                }
            }
        }

        let missingKeys = 0;
        const allKeys = [...sourceKeys]; // 使用源语言的所有键

        // 翻译缺失的键
        for (const key of allKeys) {
            const sourceValue = getValueByPath(sourceData, key);
            const targetValue = getValueByPath(langData, key);

            // 如果目标语言中已有该键且不为空，则跳过
            if (targetValue && targetValue.trim() !== '') {
                continue;
            }

            if (sourceValue && typeof sourceValue === 'string') {
                missingKeys++;
                console.log(`  📌 Translating: ${key}`);
                
                try {
                    const translatedText = await translateText(sourceValue, 'zh-CN', lang);
                    setValueByPath(langData, key, translatedText);
                } catch (error) {
                    console.error(`  ❌ Failed to translate key "${key}": ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }

        console.log(
            `📊 ${lang}: ${missingKeys} keys translated, ${
                allKeys.length - missingKeys
            } keys already exist, ${keysToRemove.length} keys removed`,
        );

        // 保存更新后的翻译文件
        saveLanguageFile(lang, langData);
    }

    console.log('\n🎉 Translation sync completed successfully!');
}

// 运行主函数
main().catch((error) => {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
});
