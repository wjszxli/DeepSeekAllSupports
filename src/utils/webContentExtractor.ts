/**
 * Extracts the content from the current webpage
 * @returns {Promise<string>} The extracted content from the webpage
 */
export async function extractWebpageContent(): Promise<string> {
    try {
        // Get the page title
        const pageTitle = document.title;

        // Get the main content
        // First try to find main content areas
        const mainElements = document.querySelectorAll('main, article, [role="main"]');
        let contentText = '';

        if (mainElements.length > 0) {
            // Use identified main content areas
            mainElements.forEach((element) => {
                // @ts-ignore
                contentText += element.innerText + '\n\n';
            });
        } else {
            // Fallback: get the body text but exclude scripts, styles, etc.
            const bodyText = document.body.innerText;
            contentText = bodyText;
        }

        // Get the current URL
        const currentUrl = window.location.href;

        // Format the extracted content
        const extractedContent = `
URL: ${currentUrl}
Title: ${pageTitle}

Content:
${contentText.slice(0, 15000)}${contentText.length > 15000 ? '...(content truncated)' : ''}
    `.trim();

        return extractedContent;
    } catch (error) {
        console.error('Error extracting webpage content:', error);
        return 'Failed to extract webpage content due to an error.';
    }
}
