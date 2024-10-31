document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const apiSelect = document.getElementById('apiSelect');
  const snipButton = document.getElementById('snipButton');
  const answerDiv = document.getElementById('answer');
  const questionDisplay = document.getElementById('questionDisplay');
  const enableToggle = document.getElementById('enableToggle');

  // Load saved settings
  chrome.storage.local.get(['apiKey', 'selectedApi', 'pendingQuestion', 'isEnabled'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
      validateApiKey(result.apiKey, result.selectedApi || 'openai');
    }
    if (result.selectedApi) {
      apiSelect.value = result.selectedApi;
    }
    // Set toggle state
    enableToggle.checked = result.isEnabled !== false; // Default to true if not set
    updateExtensionState(enableToggle.checked);
    
    // Check for pending question
    if (result.pendingQuestion && enableToggle.checked) {
      questionDisplay.textContent = "Question: " + result.pendingQuestion;
      answerDiv.textContent = "Getting answer...";
      
      chrome.runtime.sendMessage({
        type: 'processQuestion',
        question: result.pendingQuestion
      });
      
      chrome.storage.local.remove('pendingQuestion');
    }
  });

  // Handle toggle changes
  enableToggle.addEventListener('change', function() {
    const isEnabled = enableToggle.checked;
    chrome.storage.local.set({ isEnabled: isEnabled });
    updateExtensionState(isEnabled);
    
    // Notify content scripts about the state change
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "updateState",
          isEnabled: isEnabled
        }).catch(() => {}); // Ignore errors for inactive tabs
      });
    });
  });

  function updateExtensionState(isEnabled) {
    apiSelect.disabled = !isEnabled;
    apiKeyInput.disabled = !isEnabled;
    snipButton.disabled = !isEnabled || !apiKeyInput.value;
    
    if (!isEnabled) {
      answerDiv.textContent = "Smart Assistance is currently disabled.";
      questionDisplay.textContent = "";
    } else if (!apiKeyInput.value) {
      answerDiv.textContent = "Please enter your API key to start using Smart Assistance.";
    }
  }

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

  // Update message listeners to check enabled state
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!enableToggle.checked) return; // Don't process messages if disabled
    
    if (message.type === 'showPopupWithQuestion') {
      questionDisplay.textContent = "Question: " + message.question;
      answerDiv.textContent = "Getting answer...";
      
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