let isSnipping = false;
let isEnabled = true; // Default to enabled

// Load initial state
chrome.storage.local.get(['isEnabled'], function(result) {
  isEnabled = result.isEnabled !== false; // Default to true if not set
  if (isEnabled) {
    detectQuestions();
  }
});

// Listen for state changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateState") {
    isEnabled = message.isEnabled;
    if (isEnabled) {
      detectQuestions();
    } else {
      // Remove all answer buttons when disabled
      const buttons = document.querySelectorAll('.smart-answer-btn');
      buttons.forEach(button => button.remove());
      
      // Remove question-detected class
      const questions = document.querySelectorAll('.question-detected');
      questions.forEach(q => q.classList.remove('question-detected'));
      
      // Remove any active snipping elements
      removeSnippingElements();
    }
  } else if (message.action === "startSnipping" && isEnabled) {
    isSnipping = true;
    createSnippingElements();
    instruction.style.display = 'block';
    handleSnipping();
  }
});

let startX, startY;
let overlay, selection, instruction;

// Function to detect questions
function detectQuestions() {
  const paragraphs = document.querySelectorAll('p, div, span');
  const questionPatterns = [
    /\?$/,  // Ends with question mark
    /^(what|who|when|where|why|how|explain|describe|discuss|analyze|compare|contrast|evaluate|define)/i,  // Question words
    /(question):\s/i  // Starts with "question:"
  ];

  paragraphs.forEach(element => {
    const text = element.textContent.trim();
    
    // Check if text contains question patterns
    const isQuestion = questionPatterns.some(pattern => pattern.test(text));
    
    if (isQuestion && !element.classList.contains('question-detected')) {
      element.classList.add('question-detected');
      
      // Create answer button
      const answerButton = document.createElement('button');
      answerButton.textContent = '💡 Answer';
      answerButton.className = 'smart-answer-btn';
      
      // Add event listener for button
      answerButton.addEventListener('click', async () => {
        // Send message to background script to open popup with question
        chrome.runtime.sendMessage({
          type: 'openPopupWithQuestion',
          question: text
        });
      });
      
      // Add button after question element
      element.parentNode.insertBefore(answerButton, element.nextSibling);
    }
  });
}

// Create overlay elements
function createSnippingElements() {
  // Create overlay
  overlay = document.createElement('div');
  overlay.className = 'snipping-overlay';
  
  // Create selection area
  selection = document.createElement('div');
  selection.className = 'selection-area';
  selection.style.display = 'none';
  
  // Create instruction
  instruction = document.createElement('div');
  instruction.className = 'selection-instruction';
  instruction.textContent = 'Click and drag to select the question area';
  instruction.style.display = 'none';
  
  document.body.appendChild(overlay);
  document.body.appendChild(selection);
  document.body.appendChild(instruction);
}

// Remove overlay elements
function removeSnippingElements() {
  if (overlay) overlay.remove();
  if (selection) selection.remove();
  if (instruction) instruction.remove();
  isSnipping = false;
}

// Handle mouse events for snipping
function handleSnipping() {
  let startX, startY;
  let selectedText = '';

  overlay.addEventListener('mousedown', (e) => {
    startX = e.pageX;
    startY = e.pageY;
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    selection.style.display = 'block';

    // Clear any existing selection
    window.getSelection().removeAllRanges();
  });

  overlay.addEventListener('mousemove', (e) => {
    if (e.buttons !== 1) return; // Only run when left mouse button is pressed

    const currentX = e.pageX;
    const currentY = e.pageY;
    
    const width = currentX - startX;
    const height = currentY - startY;
    
    const left = width < 0 ? currentX : startX;
    const top = height < 0 ? currentY : startY;
    
    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = Math.abs(width) + 'px';
    selection.style.height = Math.abs(height) + 'px';

    // Create a temporary element to get text from the selected area
    const tempElement = document.elementFromPoint(currentX, currentY);
    if (tempElement) {
      selectedText = tempElement.textContent;
    }
  });

  overlay.addEventListener('mouseup', (e) => {
    if (selectedText) {
      // Send message to background script to open new window
      chrome.runtime.sendMessage({
        type: 'openAnswerWindow',
        question: selectedText.trim()
      });
    }
    removeSnippingElements();
  });

  // Cancel snipping with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSnipping) {
      removeSnippingElements();
    }
  });
}

// Run detection when page loads
detectQuestions();

// Run detection when DOM changes
const observer = new MutationObserver(detectQuestions);
observer.observe(document.body, {
  childList: true,
  subtree: true
}); 