// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const question = urlParams.get('question');

// Display question
document.getElementById('question').textContent = question;

// Request answer from background script
chrome.runtime.sendMessage({
  type: 'processQuestion',
  question: question
}, response => {
  if (response && response.answer) {
    document.getElementById('answer').textContent = response.answer;
  }
});

// Listen for answer updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'answer') {
    document.getElementById('answer').textContent = message.data;
  }
}); 