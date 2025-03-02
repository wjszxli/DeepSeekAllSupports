// Add this to your existing background script

// Listen for language change messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'localeChanged') {
    // Broadcast to all tabs except the sender
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && (!sender.tab || tab.id !== sender.tab.id)) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors when content script isn't loaded
          });
        }
      });
    });
    
    // Respond to confirm receipt
    sendResponse({ success: true });
  }
  
  // Return true to indicate async response
  return true;
});

// Add empty export to make it a module
export {}; 