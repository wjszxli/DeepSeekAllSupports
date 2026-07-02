import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';

// Declare global messageNotification interface
declare global {
    interface Window {
        messageNotification?: {
            success: (
                message: string | { message: string; placement?: string; duration?: number },
            ) => void;
            error: (message: string) => void;
        };
    }
}

// LRU cache with capacity limit to prevent unbounded memory growth
const MAX_CACHE_SIZE = 500;

function createLRUCache<K, V>(maxSize: number) {
    const cache = new Map<K, V>();
    return {
        get(key: K): V | undefined {
            return cache.get(key);
        },
        set(key: K, value: V): void {
            if (cache.size >= maxSize && !cache.has(key)) {
                const oldestKey = cache.keys().next().value;
                if (oldestKey !== undefined) {
                    cache.delete(oldestKey);
                }
            }
            cache.set(key, value);
        },
        has(key: K): boolean {
            return cache.has(key);
        },
    };
}

const processedTexts = createLRUCache<string, string>(MAX_CACHE_SIZE);

const memoizedPreprocessMath = (() => {
    const cache = createLRUCache<string, string>(MAX_CACHE_SIZE);
    return (text: string): string => {
        if (cache.has(text)) {
            return cache.get(text) as string;
        }

        const result = preprocessMath(text);
        cache.set(text, result);
        return result;
    };
})();

// 预处理数学公式
function preprocessMath(text: string) {
    // 使用正则表达式优化：减少重复处理
    const patterns = {
        brackets: /[()[\]{}]/g,
        blockFormula: /\\\[([\S\s]*?)\\]/g,
        inlineFormula: /\\\(([\S\s]*?)\\\)/g,
        // 修复：只在有明确下标标记（如 _）的情况下处理下标
        subscripts: /([A-Za-z]+)_(\d+)/g,
        specialSymbols: /\\(pm|mp|times|div|gamma|ln|int|infty|leq|geq|neq|approx)\b/g,
    };

    // 批量处理文本替换
    let processed = text.replace(/\n{3,}/g, '\n\n').replace(/[\t ]+$/gm, '');

    // 优化块级公式处理
    processed = processed.replace(
        patterns.blockFormula,
        (_, p1) => `\n$$${p1.trim().replace(/\n\s+/g, '\n')}$$\n`,
    );

    // 优化行内公式处理
    processed = processed.replace(patterns.inlineFormula, (_, p1) => `$${p1.trim()}$`);

    // 修复：只处理明确的下标（如 H_2O）
    processed = processed.replace(patterns.subscripts, '$1_{$2}');

    // 只在数学公式环境中替换特殊字符
    const specialChars = new Map([
        ['∫', '\\int '],
        ['±', '\\pm '],
        ['∓', '\\mp '],
        ['×', '\\times '],
        ['÷', '\\div '],
        ['∞', '\\infty '],
        ['≤', '\\leq '],
        ['≥', '\\geq '],
        ['≠', '\\neq '],
        ['≈', '\\approx '],
    ]);

    // 处理块级公式中的特殊字符
    processed = processed.replace(/\$\$([\S\s]*?)\$\$/g, (_, content) => {
        let processedContent = content;
        for (const [char, replacement] of specialChars) {
            processedContent = processedContent.replaceAll(char, replacement);
        }
        return `$$${processedContent}$$`;
    });

    // 处理行内公式中的特殊字符
    processed = processed.replace(/\$([^$]+?)\$/g, (_, content) => {
        let processedContent = content;
        for (const [char, replacement] of specialChars) {
            processedContent = processedContent.replaceAll(char, replacement);
        }
        return `$${processedContent}$`;
    });

    return processed;
}

// 创建 MarkdownIt 实例并优化配置
// @ts-ignore
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    // @ts-ignore
    highlight: (str, lang) => {
        if (!lang || !hljs.getLanguage(lang)) {
            return `<code>${md.utils.escapeHtml(str)}</code>`;
        }
        try {
            const highlighted = hljs.highlight(str, { language: lang }).value;
            // Add line numbers to the highlighted code
            const lines = highlighted.split('\n');

            // Improve line numbers with line breaks preserved properly
            const lineNumbers = lines
                .map((_, index) => `<span class="line-number">${index + 1}</span>`)
                .join('\n');

            // Preserve line breaks in highlighted code
            const codeWithLineBreaks = lines
                .map((line) => `<span class="code-line">${line || ' '}</span>`)
                .join('\n');

            return `
              <div class="code-with-lines">
                <div class="line-numbers">${lineNumbers}</div>
                <div class="code-wrap">${codeWithLineBreaks}</div>
              </div>
            `;
        } catch {
            return `<code>${md.utils.escapeHtml(str)}</code>`;
        }
    },
});

// 优化 mathjax 配置
const mathjaxOptions = {
    tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
        processEscapes: true,
        processEnvironments: true,
        packages: ['base', 'ams', 'noerrors', 'noundefined'],
    },
    options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoreHtmlClass: 'tex2jax_ignore',
        processHtmlClass: 'tex2jax_process',
    },
    chtml: {
        scale: 1,
        minScale: 0.5,
        mtextInheritFont: true,
        merrorInheritFont: true,
    },
};

md.use(mathjax3, mathjaxOptions);

// 优化渲染方法
const originalRender = md.render.bind(md);
md.render = function (text: string) {
    try {
        // 使用缓存的预处理结果
        const preprocessedText = memoizedPreprocessMath(text);

        if (processedTexts.has(preprocessedText)) {
            return processedTexts.get(preprocessedText);
        }

        const result = originalRender(preprocessedText)
            // @ts-expect-error
            .replace(/\$\$([\S\s]+?)\$\$/g, (_, p1) => `<div class="math-block">$$${p1}$$</div>`)
            // @ts-expect-error
            .replace(/\$([^$]+?)\$/g, (_, p1) => `<span class="math-inline">$${p1}$</span>`);

        processedTexts.set(preprocessedText, result);
        return result;
    } catch (error) {
        console.error('渲染错误:', error);
        return originalRender(text);
    }
};

// 优化代码块渲染器
md.renderer.rules.fence = (() => {
    // @ts-expect-error
    return function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const code = token.content.trim();
        const lang = token.info || '';

        // 直接使用 highlight.js 进行高亮处理
        let highlightedCode;
        if (lang && hljs.getLanguage(lang)) {
            try {
                highlightedCode = hljs.highlight(code, { language: lang }).value;
            } catch {
                highlightedCode = md.utils.escapeHtml(code);
            }
        } else {
            highlightedCode = md.utils.escapeHtml(code);
        }

        // 添加行号
        const lines = highlightedCode.split('\n');
        const lineNumbers = lines
            .map((_: any, index: number) => `<span class="line-number">${index + 1}</span>`)
            .join('\n');

        // 处理代码行
        const codeWithLineBreaks = lines
            .map((line: string) => `<span class="code-line">${line || ' '}</span>`)
            .join('\n');

        // 创建编码后的代码字符串用于复制按钮
        const encodedCode = encodeURIComponent(code);

        return `
        <div class="code-block-wrapper">
            <div class="code-header">
                <span class="code-language">${lang || 'text'}</span>
                <button class="copy-button" data-code="${encodedCode}">
                    <svg class="copy-icon" viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
                    </svg>
                    <span>复制</span>
                </button>
            </div>
            <div class="code-with-lines">
                <div class="line-numbers">${lineNumbers}</div>
                <div class="code-wrap">${codeWithLineBreaks}</div>
            </div>
        </div>
        `.trim();
    };
})();

export { md };
