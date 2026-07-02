import { load } from 'cheerio';

import type { SearchResult } from '@/services/SearchService';
import { Logger, initLogger } from '@/utils';

const logger = new Logger('background-search');

initLogger().then((config) => {
    logger.debug('Logger initialized with config', config);
}).catch((err) => {
    console.error('Failed to initialize logger config:', err);
});

const REQUEST_TIMEOUT = 15000;

const COMMON_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
};

type SearchParser = (html: string) => SearchResult[];

interface EngineConfig {
    buildUrl: (query: string) => string;
    parse: SearchParser;
}

const ENGINES: Record<string, EngineConfig> = {
    google: {
        buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=zh-CN`,
        parse: parseGoogleResults,
    },
    baidu: {
        buildUrl: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}&ie=utf-8`,
        parse: parseBaiduResults,
    },
    biying: {
        buildUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&mkt=zh-CN`,
        parse: parseBingResults,
    },
    sogou: {
        buildUrl: (q) => `https://www.sogou.com/web?query=${encodeURIComponent(q)}`,
        parse: parseSogouResults,
    },
};

async function fetchSearchPage(
    url: string,
    parser: SearchParser,
    engineName: string,
): Promise<SearchResult[]> {
    try {
        logger.info(`获取${engineName}搜索页面: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(url, {
            method: 'GET',
            headers: COMMON_HEADERS,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        logger.info(`获取到${engineName} HTML内容，长度: ${html.length}`);

        return parser(html);
    } catch (error) {
        logger.error(`${engineName}搜索失败:`, error);
        return [];
    }
}

export async function performSearchInBackground(
    query: string,
    engine: string,
): Promise<SearchResult[]> {
    try {
        logger.info(`执行搜索: ${engine} - ${query}`);

        const engineConfig = ENGINES[engine];
        if (!engineConfig) {
            throw new Error(`不支持的搜索引擎: ${engine}`);
        }

        const timeoutPromise = new Promise<SearchResult[]>((_, reject) => {
            setTimeout(() => reject(new Error('搜索超时')), 25000);
        });

        const searchPromise = () =>
            fetchSearchPage(engineConfig.buildUrl(query), engineConfig.parse, engine);

        const results = await Promise.race([searchPromise(), timeoutPromise]);

        logger.info(`搜索完成: ${engine} - 找到 ${results.length} 个结果`);
        return results;
    } catch (error) {
        logger.error(`搜索失败 (${engine}):`, error);
        return [];
    }
}

// --- Parsers ---

function parseGoogleResults(html: string): SearchResult[] {
    try {
        const results: SearchResult[] = [];
        const $ = load(html);

        $('#search .MjjYud').each((i, element) => {
            if (i >= 10) return false;

            const titleElement = $(element).find('h3').first();
            const title = titleElement.text().trim();

            const linkElement = $(element).find('a').first();
            let url = linkElement.attr('href') || '';

            if (url.includes('/url?q=')) {
                const urlMatch = url.match(/[?&]q=([^&]+)/);
                if (urlMatch) {
                    try {
                        url = decodeURIComponent(urlMatch[1]);
                    } catch (e) {
                        logger.warn('解码URL失败:', e);
                    }
                }
            }

            let snippet = $(element)
                .find('.VwiC3b, .yXK7lf, .st, .IsZvec, .s3v9rd .MUxGbd, .hgKElc, .Uroaid')
                .first()
                .text()
                .trim();

            if (!snippet) {
                snippet = $(element)
                    .find('[data-sncf] .VwiC3b, [data-snf] .VwiC3b')
                    .first()
                    .text()
                    .trim();
            }

            if (snippet) {
                snippet = snippet.replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*—\s*/, '').trim();
            }

            if (title && url && url.startsWith('http')) {
                results.push({
                    title,
                    url,
                    snippet,
                    domain: extractDomain(url),
                    source: 'Google',
                });
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从Google搜索结果中提取数据，可能选择器需要更新');
        }

        logger.info(`Google解析完成，共找到 ${results.length} 个有效结果`);
        return results;
    } catch (error) {
        logger.error('解析Google HTML结果失败:', error);
        return [];
    }
}

function parseBaiduResults(html: string): SearchResult[] {
    try {
        const results: SearchResult[] = [];
        const $ = load(html);

        $('.result, .c-container').each((i, element) => {
            if (i >= 10) return false;

            const titleElement = $(element).find('.t, .c-title');
            const title = titleElement.text().trim();
            let link = titleElement.find('a').attr('href') || '';
            const snippet = $(element).find('.c-abstract, .content-abstract').text().trim();

            if (title && link) {
                results.push({
                    title,
                    url: link,
                    domain: extractDomain(link),
                    snippet,
                    source: 'Baidu',
                });
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从百度搜索结果中提取数据');
        }

        return results;
    } catch (error) {
        logger.error('解析百度HTML结果失败:', error);
        return [];
    }
}

function parseBingResults(html: string): SearchResult[] {
    try {
        const results: SearchResult[] = [];
        const $ = load(html);

        $('.b_algo').each((i, element) => {
            if (i >= 10) return false;

            const titleElement = $(element).find('h2 a');
            const title = titleElement.text().trim();
            const url = titleElement.attr('href') || '';
            const snippet = $(element).find('.b_caption p, .b_descript').first().text().trim();

            if (title && url && url.startsWith('http')) {
                results.push({
                    title,
                    url,
                    snippet,
                    domain: extractDomain(url),
                    source: 'Bing',
                });
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从必应搜索结果中提取数据');
        }

        logger.info(`必应解析完成，共找到 ${results.length} 个有效结果`);
        return results;
    } catch (error) {
        logger.error('解析必应HTML结果失败:', error);
        return [];
    }
}

function parseSogouResults(html: string): SearchResult[] {
    try {
        const results: SearchResult[] = [];
        const $ = load(html);

        $('.vrwrap, .result, .results .rb').each((i, element) => {
            if (i >= 10) return false;

            const titleLinkElement = $(element)
                .find('h3.vr-title a, .vr-title a, h3 a, .title a')
                .first();

            let title = titleLinkElement.text().trim();
            if (title) {
                title = title.replace(/<!--red_beg-->|<!--red_end-->/g, '').trim();
            }

            let url = titleLinkElement.attr('href') || '';

            if (url.includes('/link?url=')) {
                const urlMatch = url.match(/\/link\?url=([^&]+)/);
                if (urlMatch) {
                    try {
                        const encodedUrl = urlMatch[1];
                        url = encodedUrl.startsWith('http')
                            ? encodedUrl
                            : decodeURIComponent(encodedUrl);
                    } catch (e) {
                        logger.warn('解码搜狗URL失败:', e);
                    }
                }
            }

            if (url.startsWith('//')) {
                url = 'https:' + url;
            }

            let snippet = $(element)
                .find('.fz-mid.space-txt, .ft, .str_info, .space-txt')
                .first()
                .text()
                .trim();

            if (!snippet) {
                snippet = $(element)
                    .find('#cacheresult_summary_' + (i + 1))
                    .text()
                    .trim();
            }

            if (!snippet) {
                const stepContent = $(element).find('.step-cont').first().text().trim();
                if (stepContent) {
                    snippet = stepContent;
                }
            }

            if (snippet) {
                snippet = snippet
                    .replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*[-—]\s*/, '')
                    .replace(/<!--red_beg-->|<!--red_end-->/g, '')
                    .trim();
            }

            if (title && url && url.startsWith('http')) {
                results.push({
                    title,
                    url,
                    snippet,
                    domain: extractDomain(url),
                    source: 'Sogou',
                });
            }

            return true;
        });

        if (results.length === 0) {
            logger.warn('未能从搜狗搜索结果中提取数据');
        }

        logger.info(`搜狗解析完成，共找到 ${results.length} 个有效结果`);
        return results;
    } catch (error) {
        logger.error('解析搜狗HTML结果失败:', error);
        return [];
    }
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}
