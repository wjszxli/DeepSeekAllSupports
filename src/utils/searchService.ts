import axios from 'axios';
import { load } from 'cheerio';

// 搜索结果接口
interface SearchResult {
    title: string;
    link: string;
    snippet: string;
}

// 使用免费搜索API或自建代理
export async function performSearch(query: string): Promise<SearchResult[]> {
    try {
        // 这里使用一个示例搜索API，实际实现可能需要替换
        const response = await axios.get('https://your-search-api.com/search', {
            params: {
                q: query,
                limit: 5,
            },
        });

        return response.data.results.map((result: any) => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet,
        }));
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
}

// 抓取网页内容
export async function fetchWebContent(url: string): Promise<string> {
    try {
        const response = await axios.get(url);
        const $ = load(response.data);

        // 移除脚本、样式和不必要的元素
        $(
            'script, style, nav, footer, header, aside, [role="banner"], [role="navigation"]',
        ).remove();

        // 提取主要内容
        const title = $('title').text();
        const mainContent =
            $('main, article, .content, #content, .main').text() || $('body').text();

        // 清理文本
        const cleanedContent = mainContent.replace(/\s+/g, ' ').trim().substring(0, 8000); // 限制长度

        return `${title}\n\n${cleanedContent}`;
    } catch (error) {
        console.error('Failed to fetch content:', error);
        return '';
    }
}
