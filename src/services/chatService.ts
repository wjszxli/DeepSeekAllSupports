import { extractWebpageContent } from '../utils/webContentExtractor';
import { chatAIStream } from '@/service';
import { IMessage } from '@/typings';
import storage from '@/utils/storage';

/**
 * Sends a message to the AI service
 * @param {string} message - The message to send
 * @param {(chunk: string) => void} onStreamUpdate - Optional callback for incremental updates
 * @returns {Promise<string>} The response from the AI
 */
export async function sendMessage(
    message: string,
    onStreamUpdate?: (chunk: string) => void
): Promise<string> {
    try {
        console.log('sendMessage called with:', message);
        const previousMessages: IMessage[] = (await storage.get('chatHistory')) || [];
        const sendMessage = [...previousMessages, { role: 'user', content: message }];
        console.log('Chat history with new message:', sendMessage);

        let response = '';

        // Create a new abort controller for this request
        // @ts-ignore
        window.currentAbortController = new AbortController();
        // @ts-ignore
        const signal = window.currentAbortController.signal;

        return new Promise((resolve, reject) => {
            // Check if chatAIStream accepts signal parameter
            // If not, we need to adjust how we call it
            chatAIStream(sendMessage, async (chunk) => {
                // If request was aborted, stop processing
                if (signal.aborted) {
                    return;
                }

                console.log('Received chunk:', chunk);
                const { data, done } = chunk;

                // Process direct text content
                if (!done && !data.startsWith('data: ')) {
                    console.log('Adding direct text to response:', data);
                    response += data;
                    if (onStreamUpdate) onStreamUpdate(data);
                } 
                // Process streaming data
                else if (!done) {
                    try {
                        console.log('Parsing stream data:', data);
                        const chunkStringData = data.slice(6); // Remove "data: " prefix
                        const chunkData = JSON.parse(chunkStringData);
                        if (chunkData.choices?.[0]?.delta?.content) {
                            const content = chunkData.choices[0].delta.content;
                            console.log('Adding content to response:', content);
                            response += content;
                            if (onStreamUpdate) onStreamUpdate(content);
                        } else {
                            console.log('No content in chunk data:', chunkData);
                        }
                    } catch (error) {
                        console.error('Error parsing chunk data:', error);
                    }
                }

                // Handle completion
                if (done) {
                    console.log('Stream complete. Final response:', response);
                    
                    // Update chat history with the completed response
                    const updatedMessages = [
                        ...sendMessage,
                        { role: 'assistant', content: response },
                    ];
                    await storage.set('chatHistory', updatedMessages);
                    
                    // @ts-ignore
                    window.currentAbortController = null;
                    
                    resolve(response);
                }
            }).catch((error) => {
                console.error('Error in chatAIStream:', error);
                // Only reject if not aborted
                if (!signal.aborted) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Error in sendMessage:', error);
        throw error;
    }
}

/**
 * Sends a message to the LLM with the current webpage context
 * @param {string} userMessage - The user's message
 * @param {boolean} includeWebpage - Whether to include the webpage content
 * @param {(chunk: string) => void} onStreamUpdate - Optional callback for incremental updates
 * @returns {Promise<string>} The response from the LLM
 */
export async function sendMessageWithWebpageContext(
    userMessage: string,
    includeWebpage = true,
    onStreamUpdate?: (chunk: string) => void
): Promise<string> {
    try {
        console.log('sendMessageWithWebpageContext called with:', userMessage);
        let contextMessage = userMessage;

        if (includeWebpage) {
            console.log('Extracting webpage content...');
            const webpageContent = await extractWebpageContent();
            console.log('Extracted webpage content length:', webpageContent.length);
            
            // Format the message with webpage context
            contextMessage = `The following is the content of the webpage I'm currently viewing:

${webpageContent}

Based on this webpage, please respond to my question: ${userMessage}`;
        }

        // Call sendMessage with the enhanced context
        console.log('Sending message with context of length:', contextMessage.length);
        return await sendMessage(contextMessage, onStreamUpdate);
    } catch (error) {
        console.error('Error sending message with webpage context:', error);
        throw error;
    }
}
