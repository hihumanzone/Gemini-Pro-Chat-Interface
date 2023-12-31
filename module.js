import { GoogleGenerativeAI } from "@google/generative-ai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

let chat;
let chatHistory = [];
let currentSession = 'default';
const defaultChatHistory = JSON.stringify({ default: [] });

const chatElement = document.getElementById('chat');
const userInput = document.getElementById('userInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const sendButton = document.getElementById('send');
const loadingIndicator = document.getElementById('loading');
const imageInput = document.getElementById('imageInput');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const removeAttachmentsButton = document.getElementById('removeAttachments');

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
  return await genAI.getGenerativeModel({
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
    initializeChat();
  };
  container.appendChild(deleteButton);
}

async function regenerateLastModelResponse() {
  if (chatHistory.length >= 2) {
    const lastUserMessageIndex = chatHistory.length - 2;
    const lastUserMessage = chatHistory[lastUserMessageIndex];
    chatHistory.splice(lastUserMessageIndex, 2);
    await initializeChat();

    userInput.value = lastUserMessage.parts;

    if (lastUserMessage.imageAttached && lastUserMessage.images && lastUserMessage.images.length > 0) {
      const dataTransfer = new DataTransfer();
      for (let imageSrc of lastUserMessage.images) {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const file = new File([blob], 'regenerated_image', { type: blob.type });
        dataTransfer.items.add(file);
      }
      imageInput.files = dataTransfer.files;
      displayImagePreviews(imageInput.files);
    }
    await sendMessageStream();
    userInput.value = '';
  } else {
    console.error('Unable to regenerate: not enough history present.');
  }
}

function createRegenerateButton(text, index) {
  const regenerateButton = document.createElement('button');
  regenerateButton.textContent = 'Regenerate';
  regenerateButton.classList.add('regenerate-msg-btn');
  regenerateButton.onclick = function () {
    regenerateLastModelResponse();
  };
  return regenerateButton;
}

const addChatSession = () => {
  const newSessionName = prompt('Enter new session name:');
  if (newSessionName) {
    const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
    if (chatSessionsHistory[newSessionName]) {
      alert('Session already exists.');
      return;
    }
    chatSessionsHistory[newSessionName] = [];
    localStorage.setItem('chatHistory', JSON.stringify(chatSessionsHistory));
    currentSession = newSessionName;
    loadChatSessionsIntoDropdown();
    loadChatHistoryFromLocalStorage();
    renderChat();
  }
};

const renameChatSession = () => {
  const newSessionName = prompt('Enter new session name:');
  if (newSessionName) {
    const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
    if (chatSessionsHistory[newSessionName]) {
      alert('Session already exists.');
      return;
    }
    chatSessionsHistory[newSessionName] = chatSessionsHistory[currentSession];
    delete chatSessionsHistory[currentSession];
    localStorage.setItem('chatHistory', JSON.stringify(chatSessionsHistory));
    currentSession = newSessionName;
    loadChatSessionsIntoDropdown();
  }
};

const deleteChatSession = () => {
  if (currentSession === 'default') {
    if (confirm(`Are you sure you want to delete the "${currentSession}" session? This cannot be undone.`)) {
      const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
      chatSessionsHistory['default'] = [];
      localStorage.setItem('chatHistory', JSON.stringify(chatSessionsHistory));
      loadChatHistoryFromLocalStorage();
      renderChat();
    }
  } else {
    if (confirm(`Are you sure you want to delete the "${currentSession}" session? This cannot be undone.`)) {
      const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
      delete chatSessionsHistory[currentSession];
      localStorage.setItem('chatHistory', JSON.stringify(chatSessionsHistory));
      currentSession = 'default';
      loadChatSessionsIntoDropdown();
      loadChatHistoryFromLocalStorage();
      renderChat();
    }
  }
};

const loadChatSessionsIntoDropdown = () => {
  const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
  const chatSessionsDropdown = document.getElementById('chatSessions');
  chatSessionsDropdown.innerHTML = '';
  for (const sessionName in chatSessionsHistory) {
    const option = document.createElement('option');
    option.value = sessionName;
    option.text = sessionName;
    chatSessionsDropdown.appendChild(option);
  }
  chatSessionsDropdown.value = currentSession;
};

document.getElementById('chatSessions').addEventListener('change', e => {
  currentSession = e.target.value;
  loadChatHistoryFromLocalStorage();
  renderChat();
});

document.getElementById('addSession').addEventListener('click', addChatSession);
document.getElementById('renameSession').addEventListener('click', renameChatSession);
document.getElementById('deleteSession').addEventListener('click', deleteChatSession);

document.addEventListener('DOMContentLoaded', () => {
  loadGenerationConfigFromLocalStorage();
  loadApiKeyFromLocalStorage();
});

const saveChatToLocalStorage = async () => {
  const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
  const chatHistoryWithBase64 = await Promise.all(chatHistory.map(async (message) => {
    if (message.imageAttached && message.images && message.images.length > 0) {
      const base64Images = await Promise.all(message.images.map(async (imageUrl) => {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        return await blobToBase64(blob);
      }));
      return { ...message, images: base64Images };
    }
    return message;
  }));

  chatSessionsHistory[currentSession] = chatHistoryWithBase64;
  localStorage.setItem('chatHistory', JSON.stringify(chatSessionsHistory));
};

const blobToBase64 = (blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
};

const loadChatHistoryFromLocalStorage = () => {
  const chatSessionsHistory = JSON.parse(localStorage.getItem('chatHistory') || defaultChatHistory);
  if (!Array.isArray(chatSessionsHistory[currentSession])) {
    chatSessionsHistory[currentSession] = [];
  }

  const sessionHistory = chatSessionsHistory[currentSession];
  const chatHistoryWithFiles = sessionHistory.map((message) => {
    if (message.imageAttached && message.images && message.images.length > 0) {
      const fileObjects = message.images.map((base64Data) => {
        const byteString = atob(base64Data.split(',')[1]);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const intArray = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) {
          intArray[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([intArray], { type: 'image/jpeg' }); 
        const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
        return URL.createObjectURL(file); 
      });
      return { ...message, images: fileObjects };
    }
    return message;
  });

  chatHistory = chatHistoryWithFiles;
  renderChat();
  initializeChat();
};

const generationConfig = {
  maxOutputTokens: 16384,
  temperature: 0.9,
  topP: 0.95,
  topK: 1,
};

const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

function saveGenerationConfigToLocalStorage() {
  localStorage.setItem('generationConfig', JSON.stringify(generationConfig));
}

function loadGenerationConfigFromLocalStorage() {
  const savedConfig = JSON.parse(localStorage.getItem('generationConfig'));
  if (savedConfig) {
    Object.assign(generationConfig, savedConfig);
    updateSliderUI();
  }
}

function updateSliderUI() {
  document.getElementById('maxOutputTokens').value = generationConfig.maxOutputTokens;
  document.getElementById('maxOutputTokensValue').textContent = generationConfig.maxOutputTokens;
  
  document.getElementById('temperature').value = generationConfig.temperature;
  document.getElementById('temperatureValue').textContent = generationConfig.temperature;
  
  document.getElementById('topP').value = generationConfig.topP;
  document.getElementById('topPValue').textContent = generationConfig.topP;
  
  document.getElementById('topK').value = generationConfig.topK;
  document.getElementById('topKValue').textContent = generationConfig.topK;
}

function updateGenerationConfig(event) {
  const target = event.target.id;
  const value = parseFloat(event.target.value);
  generationConfig[target] = value;
  document.getElementById(target + 'Value').textContent = value;
  saveGenerationConfigToLocalStorage();
  initializeChat();
}

document.getElementById('maxOutputTokens').addEventListener('change', updateGenerationConfig);
document.getElementById('temperature').addEventListener('change', updateGenerationConfig);
document.getElementById('topP').addEventListener('change', updateGenerationConfig);
document.getElementById('topK').addEventListener('change', updateGenerationConfig);

function resetGenerationConfigToDefault() {
  generationConfig.maxOutputTokens = 16384;
  generationConfig.temperature = 0.9;
  generationConfig.topP = 0.95;
  generationConfig.topK = 1;
  updateSliderUI();
  saveGenerationConfigToLocalStorage();
}

document.getElementById('resetGenConfig').addEventListener('click', resetGenerationConfigToDefault);

async function initializeChat() {
    if (apiKeyInput.value) {
      const genAI = new GoogleGenerativeAI(apiKeyInput.value);
      const model = await genAI.getGenerativeModel({ model: "gemini-pro" });
      chat = model.startChat({
        history: chatHistory,
        generationConfig,safetySettings});
      renderChat();
    } else {
      alert('API key is required to initialize the chat.');
    }
}

function sanitizeExceptCodeBlocks(markdown) {
  const regex = /(```[\s\S]*?```)|(`[^`\n]*?`)/gm;
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
  let sanitized = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return sanitized;
}

function renderKaTeX(content) {
    const displayPattern = /\$\$(.+?)\$\$|\\\[(.+?)\\\]/g;
    const inlinePattern = /\$(.+?)\$|\\\((.+?)\\\)/g;

    const renderMatch = (fullMatch, group1, group2, displayMode) => {
        const tex = group1 || group2;
        try {
            return katex.renderToString(tex, {
                throwOnError: false,
                displayMode: displayMode
            });
        } catch (e) {
            console.error(e);
            return fullMatch;
        }
    };

    content = content.replace(displayPattern, (match, group1, group2) => renderMatch(match, group1, group2, true));

    content = content.replace(inlinePattern, (match, group1, group2) => {
        if (match.startsWith("\\(") || match.startsWith("$")) {
            return renderMatch(match, group1, group2, false);
        }
        return match;
    });
    return content;
}
const renderChat = () => {
  chatElement.innerHTML = '';
  chatHistory.forEach(({ role, parts, imageAttached, images }, index) => {
  const messageContainer = document.createElement('div');
  messageContainer.classList.add('message-container', role);

  const message = document.createElement('div');
  message.classList.add('message', role);

  const attachmentIndicator = imageAttached ? ' 📸' : '';
  const sanitizedContent = DOMPurify.sanitize(marked.parse(sanitizeExceptCodeBlocks(parts))) + attachmentIndicator;
  message.innerHTML = renderKaTeX(sanitizedContent);
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
    if (role === 'model' && index === chatHistory.length - 1) {
      const regenerateButton = createRegenerateButton(parts, index);
      buttonGroup.appendChild(regenerateButton);
    }

    messageContainer.appendChild(buttonGroup);

    chatElement.appendChild(messageContainer);
  });
  renderCodeBlocks();
  saveChatToLocalStorage(); 
  chatElement.scrollTop = chatElement.scrollHeight;
};


const saveApiKeyToLocalStorage = () => {
    localStorage.setItem('apiKey', apiKeyInput.value);
    if (apiKeyInput.value) {
    loadChatSessionsIntoDropdown();
  }
};

const loadApiKeyFromLocalStorage = () => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
        loadChatSessionsIntoDropdown();
        loadChatHistoryFromLocalStorage();
    }
};
    
const toggleLoading = (isLoading) => {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    sendButton.disabled = isLoading;
    const deleteButtons = document.querySelectorAll('.delete-msg-btn');
    const regenerateButtons = document.querySelectorAll('.regenerate-msg-btn');
    deleteButtons.forEach((button) => {
    button.disabled = isLoading;
    });
    regenerateButtons.forEach((button) => {
    button.disabled = isLoading;
    });
};

apiKeyInput.addEventListener('change', saveApiKeyToLocalStorage);
apiKeyInput.addEventListener('change', initializeChat);

const displayImagePreviews = (files) => {
  const imagePreviewContainer = document.getElementById('image-preview-container');
  imagePreviewContainer.innerHTML = '';
  if (files.length > 0) {
    Array.from(files).forEach((file, index) => {
      const imgElement = document.createElement('img');
      imgElement.src = URL.createObjectURL(file);
      imgElement.onload = () => URL.revokeObjectURL(imgElement.src);

      const removeImageButton = document.createElement('button');
      removeImageButton.innerHTML = '&#128465;';
      removeImageButton.addEventListener('click', () => removeImagePreview(index));

      const previewWrapper = document.createElement('div');
      previewWrapper.appendChild(imgElement);
      previewWrapper.appendChild(removeImageButton);

      imagePreviewContainer.appendChild(previewWrapper);
    });
    imagePreviewContainer.classList.remove('hidden');
  } else {
    imagePreviewContainer.classList.add('hidden');
  }
};

const removeImagePreview = (index) => {
  const filesArray = Array.from(imageInput.files);
  filesArray.splice(index, 1);
  const dataTransfer = new DataTransfer();
  filesArray.forEach((file) => dataTransfer.items.add(file));
  imageInput.files = dataTransfer.files;
  displayImagePreviews(imageInput.files);
  updateImageCounter();
};

const updateImageCounter = () => {
  const imageCounterElement = document.getElementById('imageCounter');
  const fileCount = imageInput.files ? imageInput.files.length : 0;
  imageCounterElement.textContent = fileCount;
  displayImagePreviews(imageInput.files);
};

imageInput.addEventListener('change', updateImageCounter);

const removeAttachments = () => {
    imageInput.value = '';
    updateImageCounter();
};

removeAttachmentsButton.addEventListener('click', removeAttachments);

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
    generationConfig,safetySettings});
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
    chatHistory.push({ role: 'model', parts: error.message });
    toggleLoading(false);
    renderChat();
  }
};

sendButton.addEventListener('click', sendMessageStream);

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
