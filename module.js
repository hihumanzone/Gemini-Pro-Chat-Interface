import { GoogleGenerativeAI } from "@google/generative-ai";
    
let chat;
let chatHistory = [];

const chatElement = document.getElementById('chat');
const userInput = document.getElementById('userInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const sendButton = document.getElementById('send');
const clearButton = document.getElementById('clear');
const loadingIndicator = document.getElementById('loading');
const imageInput = document.getElementById('imageInput');
const uploadImageBtn = document.getElementById('uploadImageBtn');

async function fileToGenerativePart(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        inlineData: {
          data: reader.result.split(',')[1],
          mimeType: file.type,
        },
      });
    };
    reader.readAsDataURL(file);
  });
}

async function createGenerativeModel(useVisionModel = false) {
  const genAI = new GoogleGenerativeAI(apiKeyInput.value);
  return genAI.getGenerativeModel({
    model: useVisionModel ? "gemini-pro-vision" : "gemini-pro"
  });
}


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

function sanitizeExceptCodeBlocks(markdown) {
  const regex = /(^```[\s\S]*?```$)|(`.*?`)/gm;
  let lastIndex = 0;
  let result = '';
  markdown.replace(regex, (match, codeBlock, inlineCode, index) => {
    result += sanitizeHTML(markdown.slice(lastIndex, index));
    result += codeBlock || inlineCode;
    lastIndex = index + match.length;
  });
  result += sanitizeHTML(markdown.slice(lastIndex));
  return result;
}
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

const renderChat = () => {
  chatElement.innerHTML = '';
  chatHistory.forEach(({ role, parts, imageAttached, images }, index) => {
  const messageContainer = document.createElement('div');
  messageContainer.classList.add('message-container', role);

  const message = document.createElement('div');
  message.classList.add('message', role);

  const attachmentIndicator = imageAttached ? ' 📸' : '';
  message.innerHTML = renderMarkdownAndMath(sanitizeExceptCodeBlocks(parts)) + attachmentIndicator;
  if (imageAttached && images.length > 0) {
      const imagePreviewContainer = document.createElement('div');
      imagePreviewContainer.classList.add('image-preview-container');
      
      images.forEach((imageUrl) => {
        const imgElement = document.createElement('img');
        imgElement.src = imageUrl;
        imgElement.classList.add('image-preview');
        imagePreviewContainer.appendChild(imgElement);
      });

      messageContainer.appendChild(imagePreviewContainer);
    }
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

const markAndExtractCodeBlocks = (html) => {
  const codeBlockRegex = /<pre><code>[\s\S]*?<\/code><\/pre>|<code>[\s\S]*?<\/code>/g;
  let codeBlocks = [];
  const newHtml = html.replace(codeBlockRegex, match => `[code-block-${codeBlocks.push(match) - 1}]`);
  return { newHtml, codeBlocks };
};

const restoreCodeBlocks = (html, blocks) => 
  html.replace(/\[code-block-(\d+)\]/g, (match, index) => blocks[parseInt(index, 10)]);

const replaceMathWithRendered = (html, regex, displayMode) => 
  html.replace(regex, match => {
    const math = match.slice(1, -1).trim();
    try {
      return katex.renderToString(math, { displayMode });
    } catch {
      return match;
    }
  });

const renderMarkdownAndMath = (text) => {
  let markdownHtml = marked.parse(text);
  
  let { newHtml, codeBlocks } = markAndExtractCodeBlocks(markdownHtml);
  
  newHtml = replaceMathWithRendered(newHtml, /(?<!\\)\$\$[\s\S]+?\$\$/g, true);
  newHtml = replaceMathWithRendered(newHtml, /(?<!\\)\$[^$]+?\$/g, false);
  
  return restoreCodeBlocks(newHtml, codeBlocks);
};
    
const toggleLoading = (isLoading) => {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    sendButton.disabled = isLoading;
};
    
const initializeChat = async () => {
    if (apiKeyInput.value) {
        chatHistory = [];
        userInput.value = '';
        imageInput.value = '';
        updateImageCounter();
        const genAI = new GoogleGenerativeAI(apiKeyInput.value);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        chat = await model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 16384,
            },
        });
        renderChat();
    } else {
        alert('API key is required to initialize the chat.');
    }
};

apiKeyInput.addEventListener('change', saveApiKeyToLocalStorage);
apiKeyInput.addEventListener('change', initializeChat);

const displayImagePreviews = (files) => {
  const imagePreviewContainer = document.getElementById('image-preview-container');
  imagePreviewContainer.innerHTML = '';
  if (files.length > 0) {
    Array.from(files).forEach((file) => {
      const imgElement = document.createElement('img');
      imgElement.src = URL.createObjectURL(file);
      imgElement.onload = () => URL.revokeObjectURL(imgElement.src);
      imagePreviewContainer.appendChild(imgElement);
    });
    imagePreviewContainer.classList.remove('hidden');
  } else {
    imagePreviewContainer.classList.add('hidden');
  }
};

const updateImageCounter = () => {
  const imageCounterElement = document.getElementById('imageCounter');
  const fileCount = imageInput.files ? imageInput.files.length : 0;
  imageCounterElement.textContent = fileCount;
  displayImagePreviews(imageInput.files);
};
imageInput.addEventListener('change', updateImageCounter);

const sendMessageStream = async () => {
  if (!chat || !apiKeyInput.value) {
    alert('You must provide an API key and initialize the chat before sending messages.');
    return;
  }

  const msg = userInput.value.trim();
  const files = imageInput.files;

  let inputParts = [{ text: msg }];
  let useVisionModel = false;

  if (files && files.length > 0) {
    const imagePartsPromises = Array.from(files).map(fileToGenerativePart);
    const imageParts = await Promise.all(imagePartsPromises);
    inputParts = inputParts.concat(imageParts);
    useVisionModel = true;
  }
  updateImageCounter();

  const model = await createGenerativeModel(useVisionModel);
  chat = await model.startChat({
    history: chatHistory,
    generationConfig: {
      maxOutputTokens: 16384,
    },
  });
  if (msg === '') return;

  chatHistory.push({
  role: 'user',
  parts: msg,
  imageAttached: useVisionModel,
  images: useVisionModel ? Array.from(files).map(file => URL.createObjectURL(file)) : [],
  });
  renderChat();
  userInput.value = '';
  imageInput.value = '';
  updateImageCounter();
  adjustTextareaHeight(userInput);
  toggleLoading(true);

  try {
    let result;
    if (useVisionModel) {
      result = await model.generateContentStream(inputParts);
    } else {
      result = await chat.sendMessageStream(inputParts);
    }
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
    chatHistory.push({ role: 'model', parts: `Error: ${error.message}` });
    toggleLoading(false);
    renderChat();
  }
};

sendButton.addEventListener('click', sendMessageStream);

clearButton.addEventListener('click', initializeChat);

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
