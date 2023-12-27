import { GoogleGenerativeAI } from "@google/generative-ai";

const chatElement = document.getElementById('chat');
const userInput = document.getElementById('userInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const sendButton = document.getElementById('send');
const clearButton = document.getElementById('clear');
const loadingIndicator = document.getElementById('loading');
const manageContainer = document.getElementById('manage-container');

let chat;
let chatHistory = [];

document.addEventListener('DOMContentLoaded', loadApiKeyFromLocalStorage);
apiKeyInput.addEventListener('change', handleApiKeyChange);
sendButton.addEventListener('click', sendMessageStream);
clearButton.addEventListener('click', clearChat);
document.getElementById('toggle-manage').addEventListener('click', toggleManageContainer);
userInput.addEventListener('input', () => adjustTextareaHeight(userInput));

function addButton(container, text, classNames, eventHandler) {
    const button = document.createElement('button');
    button.textContent = text;
    button.classList.add(...classNames);
    button.onclick = eventHandler;
    container.appendChild(button);
}

function addCopyButton(container, textContent) {
    addButton(container, 'Copy', ['copy-msg-btn'], () => {
        navigator.clipboard.writeText(textContent).then(() => {
            button.textContent = 'Copied!';
            setTimeout(() => button.textContent = 'Copy', 2000);
        }).catch(err => console.error('Error copying text:', err));
    });
}

function addDeleteButton(container, index) {
    addButton(container, 'Delete', ['delete-msg-btn'], () => {
        chatHistory.splice(index, 1);
        restartChat();
    });
}

function initializeChat() {
    if (!apiKeyInput.value) {
        alert('API key is required to initialize the chat.');
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKeyInput.value);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    chat = model.startChat({
        history: chatHistory,
        generationConfig: {
            maxOutputTokens: 16384,
        },
    });
}

function restartChat() {
    initializeChat();
    renderChat();
}

function addCopyCodeButton(codeBlock) {
    addButton(codeBlock.parentNode, 'Copy Code', ['copy-msg-btn'], () => {
        navigator.clipboard.writeText(codeBlock.innerText).then(() => {
            button.textContent = 'Copied!';
            setTimeout(() => button.textContent = 'Copy Code', 2000);
        }).catch(err => console.error('Error copying code:', err));
    });
}

function renderChat() {
    chatElement.innerHTML = '';
    chatHistory.forEach((messageObject, index) => renderMessage(messageObject, index));
    renderCodeBlocks();
    chatElement.scrollTop = chatElement.scrollHeight;
}

function renderMessage({ role, parts }, index) {
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
}

function renderCodeBlocks() {
    document.querySelectorAll('pre code').forEach((codeBlock) => {
        if (!codeBlock.nextSibling || !codeBlock.nextSibling.classList.contains('copy-msg-btn')) {
        addCopyCodeButton(codeBlock);
        }
    });
}

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

function toggleLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
}

function handleApiKeyChange() {
    localStorage.setItem('apiKey', apiKeyInput.value);
    initializeChat();
}

function loadApiKeyFromLocalStorage() {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        initializeChat();
    }
}

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
        console.error('An error occurred during streaming:', error);
        chatHistory.push({ role: 'model', parts: 'Error generating response.' });
        toggleLoading(false);
        renderChat();
      }
    };

function clearChat() {
    chatHistory = [];
    restartChat();
}

function toggleManageContainer() {
    manageContainer.classList.toggle('hidden');
}

function adjustTextareaHeight(element) {
    element.style.height = '0px';
    element.style.height = `${Math.max(element.scrollHeight)}px`;
}
