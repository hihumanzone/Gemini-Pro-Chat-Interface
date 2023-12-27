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

async function restartChatWithUpdatedHistory() {
    if (apiKeyInput.value) {
      const genAI = new GoogleGenerativeAI(apiKeyInput.value);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 16384,
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

    apiKeyInput.addEventListener('change', () => {
    saveApiKeyToLocalStorage();
    initializeChat();
});

    const sendMessageStream = async () => {
      if (!chat || !apiKeyInput.value) {
        alert('You must provide an API key and initialize the chat before sending messages.');
        return;
      }

      const msg = userInput.value.trim();
      if (msg === '') return;

      chatHistory.push({ role: 'user', parts: msg });
      renderChat();
      userInput.value = '';
      adjustTextareaHeight(userInput);
      toggleLoading(true);

      try {
        const result = await chat.sendMessageStream(msg);
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
        console.error(error);
        chatHistory.push({ role: 'model', parts: error.message });
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
                maxOutputTokens: 16384,
            },
        });
    } else {
        alert('API key is required to initialize the chat.');
    }
    renderChat();
});


document.querySelector('button#toggle-manage').addEventListener('click', () => {
  const manageContainer = document.getElementById('manage-container');
  manageContainer.classList.toggle('hidden');
});

const adjustTextareaHeight = (element) => {
    if (element.value === '') {
        element.style.height = '35px';
    } else {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
    }
};

userInput.addEventListener('input', () => adjustTextareaHeight(userInput));
