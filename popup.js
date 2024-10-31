document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const apiSelect = document.getElementById('apiSelect');
  const snipButton = document.getElementById('snipButton');
  const answerDiv = document.getElementById('answer');
  const questionDisplay = document.getElementById('questionDisplay');

  // Load saved API key and selection
  chrome.storage.local.get(['apiKey', 'selectedApi', 'pendingQuestion'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      validateApiKey(result.apiKey, result.selectedApi || 'openai');
    }
    if (result.selectedApi) {
      apiSelect.value = result.selectedApi;
    }
    // Check for pending question
    if (result.pendingQuestion) {
      // Display and process the pending question
      questionDisplay.textContent = "Question: " + result.pendingQuestion;
      answerDiv.textContent = "Getting answer...";
      
      // Get answer
      chrome.runtime.sendMessage({
        type: 'processQuestion',
        question: result.pendingQuestion
      });
      
      // Clear the pending question
      chrome.storage.local.remove('pendingQuestion');
    }
  });

  // Save and validate API key when entered
  apiKeyInput.addEventListener('change', function() {
    const apiKey = apiKeyInput.value;
    chrome.storage.local.set({ apiKey: apiKey });
    validateApiKey(apiKey, apiSelect.value);
  });

  // Save API selection and revalidate key
  apiSelect.addEventListener('change', function() {
    chrome.storage.local.set({ selectedApi: apiSelect.value });
    validateApiKey(apiKeyInput.value, apiSelect.value);
  });

  async function validateApiKey(apiKey, selectedApi) {
    answerDiv.textContent = "Validating API key...";
    snipButton.disabled = true;
    
    try {
      const testQuestion = "Test connection. Please respond with 'OK' if successful.";
      let isValid = false;

      if (selectedApi === 'openai') {
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
              content: testQuestion
            }],
            temperature: 0.7
          })
        });
        isValid = response.ok;
      } else {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: testQuestion
              }]
            }]
          })
        });
        isValid = response.ok;
      }

      if (isValid) {
        answerDiv.innerHTML = `
          <div style="color: green; display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 20px;">✓</span>
            <span>API connection successful! You can now use Smart Assistance.</span>
          </div>`;
        snipButton.disabled = false;
      } else {
        throw new Error('Invalid response from API');
      }
    } catch (error) {
      answerDiv.innerHTML = `
        <div style="color: red; display: flex; align-items: center; gap: 5px;">
          <span style="font-size: 20px;">✗</span>
          <span>API connection failed. Please check your API key and try again.</span>
        </div>`;
      snipButton.disabled = true;
    }
  }

  snipButton.addEventListener('click', async function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "startSnipping"});
    });
  });

  // Receive question and answer
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'showPopupWithQuestion') {
      // Display question
      questionDisplay.textContent = "Question: " + message.question;
      answerDiv.textContent = "Getting answer...";
      
      // Get answer
      chrome.runtime.sendMessage({
        type: 'processQuestion',
        question: message.question
      });
    }
    else if (message.type === 'answer') {
      answerDiv.textContent = message.data;
    }
  });
}); 