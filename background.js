// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "smartAssistance",
    title: "Answer with Smart Assistance",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "smartAssistance") {
    const selectedText = info.selectionText;
    if (selectedText) {
      // Open new window with the selected text
      const question = encodeURIComponent(selectedText);
      chrome.windows.create({
        url: `answer.html?question=${question}`,
        type: 'popup',
        width: 800,
        height: 600,
        focused: true
      }, (window) => {
        // Process the question after window is created
        chrome.runtime.sendMessage({
          type: 'processQuestion',
          question: decodeURIComponent(question)
        });
      });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'processQuestion') {
    getAnswer(message.question).then(answer => {
      // Send answer to all open windows
      chrome.runtime.sendMessage({
        type: 'answer',
        data: answer
      });
      
      // Send response back if callback exists
      if (sendResponse) {
        sendResponse({ answer: answer });
      }
    });
    return true;
  }
  
  // Handle opening answer window with question
  if (message.type === 'openAnswerWindow' || message.type === 'openPopupWithQuestion') {
    const question = encodeURIComponent(message.question);
    chrome.windows.create({
      url: `answer.html?question=${question}`,
      type: 'popup',
      width: 800,
      height: 600,
      focused: true
    }, (window) => {
      // After window is created, process the question
      chrome.runtime.sendMessage({
        type: 'processQuestion',
        question: decodeURIComponent(question)
      });
    });
  }
});

async function getAnswer(question) {
  try {
    // Get API key and selected API from storage
    const result = await chrome.storage.local.get(['apiKey', 'selectedApi']);
    const apiKey = result.apiKey;
    const selectedApi = result.selectedApi || 'openai';

    if (!apiKey) {
      throw new Error('API key not found');
    }

    let answer;
    if (selectedApi === 'openai') {
      answer = await getOpenAIAnswer(question, apiKey);
    } else {
      answer = await getGeminiAnswer(question, apiKey);
    }

    return answer;

  } catch (error) {
    throw new Error(`Error: ${error.message}`);
  }
}

async function getOpenAIAnswer(question, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: question
      }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getGeminiAnswer(question, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: question
        }]
      }]
    })
  });

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
} 