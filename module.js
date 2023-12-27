    import { GoogleGenerativeAI } from "@google/generative-ai";
    
    let chat;
    let chatHistory = [];

    const chatElement = document.getElementById('chat');
    const userInput = document.getElementById('userInput');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const sendButton = document.getElementById('send');
    const clearButton = document.getElementById('clear');
    const loadingIndicator = document.getElementById('loading');

function addCopyButton(container, text) {
  let copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.classList.add('copy-msg-btn');
  copyButton.onclick = function() {
    navigator.clipboard.writeText(text).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => copyButton.textContent = 'Copy', 2000);
    }).catch(err => console.error('Error copying text:', err));
  };
  container.appendChild(copyButton);
}

function addCopyCodeButton(codeBlock) {
  let copyCodeButton = document.createElement('button');
  copyCodeButton.textContent = 'Copy Code';
  copyCodeButton.classList.add('copy-msg-btn');
  copyCodeButton.style.marginLeft = '4px';
  copyCodeButton.onclick = function () {
    navigator.clipboard.writeText(codeBlock.innerText).then(() => {
      copyCodeButton.textContent = 'Copied!';
      setTimeout(() => (copyCodeButton.textContent = 'Copy Code'), 2000);
    }).catch(err => console.error('Error copying code:', err));
  };
  codeBlock.parentNode.insertBefore(copyCodeButton, codeBlock.nextSibling);
}

const renderCodeBlocks = () => {
  document.querySelectorAll('pre code').forEach((codeBlock) => {
    if (!codeBlock.nextSibling || !codeBlock.nextSibling.classList.contains('copy-msg-btn')) {
      addCopyCodeButton(codeBlock);
    }
  });
};

function addDeleteButton(container, index) {
  let deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.classList.add('delete-msg-btn');
  deleteButton.onclick = function() {
    chatHistory.splice(index, 1);
    restartChatWithUpdatedHistory();
  };
  container.appendChild(deleteButton);
}

// Add a Regenerate button functionality
function addRegenerateButton(container) {
  let regenerateButton = document.createElement('button');
  regenerateButton.textContent = 'Regenerate';
  regenerateButton.classList.add('regenerate-msg-btn');
  regenerateButton.onclick = regenerateLastUserMessage;
  container.appendChild(regenerateButton);
}

async function regenerateLastUserMessage() {
  if (chatHistory.length < 2) {
    alert('No recent interaction to regenerate.');
    return;
  }

  // Log the latest user message
  const lastUserMessageIndex = chatHistory.length - 2;
  console.log('Latest user message:', chatHistory[lastUserMessageIndex].parts);

  // Remove the latest messages (user and model)
  chatHistory.splice(lastUserMessageIndex, 2);
  
  // Restart the chat with updated history
  await restartChatWithUpdatedHistory();
  
  // Resend the user's message
  await sendMessageStream(chatHistory[lastUserMessageIndex].parts);
}


async function restartChatWithUpdatedHistory() {
    if (apiKeyInput.value) {
      const genAI = new GoogleGenerativeAI(apiKeyInput.value);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 4096,
        },
      });
      renderChat();
    } else {
      alert('API key is required to initialize the chat.');
    }
}

const renderChat = () => {
  chatElement.innerHTML = '';
  chatHistory.forEach(({ role, parts }, index) => {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-container', role);
    
    const message = document.createElement('div');
    message.classList.add('message', role);
    message.innerHTML = renderMarkdownAndMath(parts);
    messageContainer.appendChild(message);

    const buttonGroup = document.createElement('div');
    buttonGroup.classList.add('button-group');

    addCopyButton(buttonGroup, parts);
    addDeleteButton(buttonGroup, index);
    if (chatHistory.length && chatHistory[chatHistory.length - 1].role === 'model') {
    addRegenerateButton(chatElement);
    }

    messageContainer.appendChild(buttonGroup);

    chatElement.appendChild(messageContainer);
  });

  renderCodeBlocks();
  chatElement.scrollTop = chatElement.scrollHeight;
};


const saveApiKeyToLocalStorage = () => {
    localStorage.setItem('apiKey', apiKeyInput.value);
};

const loadApiKeyFromLocalStorage = () => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        initializeChat();
    }
};

document.addEventListener('DOMContentLoaded', loadApiKeyFromLocalStorage);


      const renderMarkdownAndMath = (text) => {
    let html = marked.parse(text);
    html = html.replace(/\$\$[^\$]*\$\$/g, (match) => {
      const math = match.slice(2, -2);
      try {
        return katex.renderToString(math, { displayMode: true });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        return match;
      }
    });

    html = html.replace(/\$[^\$]*\$/g, (match) => {
      const math = match.slice(1, -1);
      try {
        return katex.renderToString(math, { displayMode: false });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        return match;
      }
    });

    return html;
  };
    
    const toggleLoading = (isLoading) => {
      loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    };
    
    const initializeChat = async () => {
      if (apiKeyInput.value) {
        const genAI = new GoogleGenerativeAI(apiKeyInput.value);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        chat = model.startChat();
        chatHistory = [];
        renderChat();
      } else {
        alert('API key is required to initialize the chat.');
      }
    };

    apiKeyInput.addEventListener('input', () => {
    saveApiKeyToLocalStorage();
    initializeChat();
});

// Asynchronous function to send a message stream
const sendMessageStream = async (messageOverride) => {
  if (!chat || !apiKeyInput.value) {
    alert('You must provide an API key and initialize the chat before sending messages.');
    return;
  }

  const msg = messageOverride || userInput.value.trim();
  if (msg === '') return;

  toggleLoading(true);

  try {
    if (!messageOverride) {
      chatHistory.push({ role: 'user', parts: msg });
      renderChat();
    }

    const result = await chat.sendMessageStream(msg);

    // Process the response stream
    let modelResponseIndex = chatHistory.length;
    for await (const responseChunk of result.stream) {
      const chunkText = await responseChunk.text();
      if (chatHistory[modelResponseIndex]) {
        chatHistory[modelResponseIndex] = { role: 'model', parts: chatHistory[modelResponseIndex].parts + chunkText };
      } else {
        chatHistory.push({ role: 'model', parts: chunkText });
        modelResponseIndex = chatHistory.length - 1;
      }
      renderChat();
    }

    toggleLoading(false);
  } catch (error) {
    console.error('An error occurred during streaming:', error);
    chatHistory.push({ role: 'model', parts: 'Error generating response.' });
    toggleLoading(false);
    renderChat();
  }
};


    sendButton.addEventListener('click', sendMessageStream);

    clearButton.addEventListener('click', async () => {
    chatHistory = [];
    if (apiKeyInput.value) {
        const genAI = new GoogleGenerativeAI(apiKeyInput.value);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 4096,
            },
        });
    } else {
        alert('API key is required to initialize the chat.');
    }
    renderChat();
});
