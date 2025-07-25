/*
 * 1. Configuration Constants
 */
const STORAGE_KEYS = {
    USERNAME: "p2p_username",
    PERSISTENT_USER_ID: "p2p_persistent_user_id",
    PROFILE_PIC: "p2p_pp_base64",
    HIDDEN: "p2p_hidden",
    REMOTE_ID: "p2p_remote_id",
    CONNECTION_STATUS: "p2p_connection_status",
};

const CONNECTION_STATES = {
    CONNECTED: "Connection established",
    CONNECTING: "Connecting...",
    DISCONNECTED: "Connection lost",
};

const SOCKET_SERVER = "https://pitopi.onrender.com";
const DEFAULT_PROFILE_PIC = "assets/boringavatar.svg";
const STORY_DURATION = {
    IMAGE: 4000,
};

/*
 * 2. Session Setup and Socket Init
 */
const savedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME);
if (!savedUsername) window.location.href = "login.html";

const username = savedUsername;
const savedBase64Pp = localStorage.getItem(STORAGE_KEYS.PROFILE_PIC);
const profilePic = savedBase64Pp || DEFAULT_PROFILE_PIC;
const persistentUserId = localStorage.getItem(STORAGE_KEYS.PERSISTENT_USER_ID);

const socket = io(SOCKET_SERVER, {
    transports: ["websocket"],
    auth: { username, profilePic, persistentUserId },
});

/*
 * 3. Global State
 */
const state = {
    peer: null,
    isConnected: null,
    dataChannel: null,
    receivedBuffers: [],
    incomingFileInfo: null,
    connectionStatus: localStorage.getItem(STORAGE_KEYS.CONNECTION_STATUS) === "false",
    remoteId: sessionStorage.getItem(STORAGE_KEYS.REMOTE_ID) || null,
    myId: null,
    myPersistentId: null,
    allUsers: [],
    activePeerConnection: null,
    hiddenFromSearch: localStorage.getItem(STORAGE_KEYS.HIDDEN) === "true",
    currentStories: {},
    currentStoryIndex: 0,
    currentUserStories: [],
    storyTimer: null,
    groups: [],
    myGroups: [],
    activeGroupId: null,
    currentView: "home",
    selectedUser: null,
    selectedGroup: null,
    activeChat: null,
    activeFilter: "all",
    chats: [],
    messages: {},
};

/*
 * 4. DOM Elements
 */
const elements = {
    get TabChat() { return document.getElementById("TabChat"); },
    get TabGroup() { return document.getElementById("TabGroup"); },
    get TabStory() { return document.getElementById("TabStory"); },
    get TabSetting() { return document.getElementById("TabSetting"); },
    get chatsList() { return document.getElementById("chats-list"); },
    get chatPanel() { return document.getElementById("chat-panel"); },
    get noChatPlaceholder() { return document.getElementById("no-chat-placeholder"); },
    get chatContent() { return document.getElementById("chat-content"); },
    get chatName() { return document.getElementById("chat-name"); },
    get chatAvatar() { return document.getElementById("chat-avatar"); },
    get chatStatus() { return document.getElementById("chat-status"); },
    get messagesContainer() { return document.getElementById("messages-container"); },
    get messageInput() { return document.getElementById("message-input"); },
    get sendMessageBtn() { return document.getElementById("send-message"); },
    get backToChatBtn() { return document.getElementById("back-to-chats"); },
    get searchInput() { return document.getElementById("searchId"); },
    get toggleThemeBtn() { return document.getElementById("toggle-theme"); },
    get storyInput() { return document.getElementById("storyInput"); },
    get uploadAvatarInput() { return document.getElementById("uploadAvatarInput"); },
};

/*
 * 5. Initialization
 */

function initApp() {
    setupEventListeners();
    initUIEventListeners();
}

function setupEventListeners() {
    // Toggle theme
    if (elements.toggleThemeBtn) {
        elements.toggleThemeBtn.addEventListener("click", () => {
            document.documentElement.classList.toggle("dark");
        });
    }

    // Send message
    if (elements.sendMessageBtn) {
        elements.sendMessageBtn.addEventListener("click", sendMessage);
    }
    
    if (elements.messageInput) {
        elements.messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Mobile back button
    if (elements.backToChatBtn) {
        elements.backToChatBtn.addEventListener("click", () => {
            elements.chatPanel.classList.remove("mobile-chat-open");
            elements.chatPanel.classList.add("mobile-chat-closed");
        });
    }

    // Search functionality
    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", (e) => {
            const searchTerm = e.target.value.trim().toLowerCase();
            searchInCurrentTab(searchTerm);
        });
    }
}

function initUIEventListeners() {
    let typingTimeout;

    if (elements.messageInput) {
        elements.messageInput.addEventListener("input", () => {
            if (state.connectionStatus && state.dataChannel?.readyState === "open") {
                try {
                    state.dataChannel.send(JSON.stringify({ type: "typing" }));
                } catch (e) {
                    console.error("Typing mesajı gönderilemedi:", e);
                }
            }

            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                if (state.connectionStatus && state.dataChannel?.readyState === "open") {
                    try {
                        state.dataChannel.send(JSON.stringify({ type: "stop-typing" }));
                    } catch (e) {
                        console.error("Stop-typing mesajı gönderilemedi:", e);
                    }
                }
            }, 2000);
        });
    }
}

function initStoryFunctionality() {
    if (elements.storyInput) {
        elements.storyInput.addEventListener("change", handleStoryUpload);
    }
}


function initProfilePictureUpload() {
    if (elements.uploadAvatarInput) {
        elements.uploadAvatarInput.addEventListener("change", handleProfilePictureUpload);
    }
}

/*
 * 6. UI Render Functions
 */
const renderNotEmpty = [
    "How about being the first? 👀", 
    "Maybe they went to make coffee ☕", 
    "They're staring blankly at the screen 😶", 
    "They might be lost online 🌐",
];

function renderChatsList() {
    if (!elements.chatsList) return;

    if (!state.isConnected) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 py-10">Connecting to server...</div>`;
        return;
    }

    elements.chatsList.innerHTML = "";

    let hasChats = false;

    state.allUsers.forEach((user) => {
        if (user.id === state.myId || user.hidden) return;

        hasChats = true;

        const chatElement = document.createElement("div");
        chatElement.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";
        chatElement.dataset.userId = user.id;

        const isOnline = true;
        const lastSeen = isOnline ? "online" : "last seen recently";

        chatElement.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium shrink-0">
                <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}" class="w-full h-full rounded-full object-cover">
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="flex justify-between">
                    <div class="font-medium truncate text-black dark:text-white">${user.username}</div>
                </div>
                <div class="flex items-center">
                    <div class="text-sm text-gray-500 truncate">
                        ${lastSeen}
                    </div>
                </div>
            </div>
        `;

        chatElement.addEventListener("click", () => {
            openChat(user);
        });

        elements.chatsList.appendChild(chatElement);
    });

    if (!hasChats) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">${renderNotEmpty[Math.floor(Math.random() * renderNotEmpty.length)]}</div>`;
    }
}

function renderChatSearchResults(users) {
    elements.chatsList.innerHTML = "";

    if (!users.length) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">No matching users found.</div>`;
        return;
    }

    users.forEach((user) => {
        const chatElement = document.createElement("div");
        chatElement.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";
        chatElement.dataset.userId = user.id;

        chatElement.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium shrink-0">
                <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}" class="w-full h-full rounded-full object-cover">
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="font-medium truncate text-black dark:text-white">${user.username}</div>
                <div class="text-sm text-gray-500 truncate">online</div>
            </div>
        `;

        chatElement.addEventListener("click", () => openChat(user));

        elements.chatsList.appendChild(chatElement);
    });
}

function renderStoriesList() {
    const container = elements.chatsList;
    if (!container) return;

    if (!state.isConnected) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 py-10">Connecting to server...</div>`;
        return;
    }

    container.innerHTML = "";
    let hasStories = false;

    Object.entries(state.currentStories).forEach(([persistentUserId, storyData]) => {
        if (!storyData?.user || !storyData?.stories?.length) return;

        hasStories = true;

        const { user, stories: userStories } = storyData;
        const latestStory = userStories[userStories.length - 1];

        const storyCard = document.createElement("div");
        storyCard.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";

        storyCard.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium shrink-0">
                <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="profile picture" class="w-full h-full rounded-full object-cover">
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="flex justify-between">
                    <div class="font-medium truncate text-black dark:text-white">${user.username}</div>
                </div>
                <div class="flex items-center">
                    <div class="text-sm text-gray-500 truncate">
                        ${timeAgo(latestStory.timestamp)}
                    </div>
                </div>
            </div>
        `;

        storyCard.addEventListener("click", () => openStory(user)); // 🔥 EKLENDİ

        container.appendChild(storyCard);
    });

    if (!hasStories) {
        container.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">${renderNotEmpty[Math.floor(Math.random() * renderNotEmpty.length)]}</div>`;
    }
}

function renderStorySearchResults(stories) {
    elements.chatsList.innerHTML = "";

    if (!stories.length) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">No matching stories found.</div>`;
        return;
    }

    stories.forEach((storyData) => {
        const user = storyData.user;
        const latestStory = storyData.stories[storyData.stories.length - 1];

        const storyElement = document.createElement("div");
        storyElement.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";

        storyElement.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium shrink-0">
                <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}" class="w-full h-full rounded-full object-cover">
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="font-medium truncate text-black dark:text-white">${user.username}</div>
                <div class="text-sm text-gray-500 truncate">${timeAgo(latestStory.timestamp)}</div>
            </div>
        `;

        storyElement.addEventListener("click", () => openStory(user));

        elements.chatsList.appendChild(storyElement);
    });
}


function renderGroupsList() {
    elements.chatsList.innerHTML = "";

    let hasGroups = false;

    if (!state.isConnected) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 py-10">Connecting to server...</div>`;
        return;
    }

    state.myGroups.forEach((group) => {
        hasGroups = true;

        const chatElement = document.createElement("div");
        chatElement.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";
        chatElement.dataset.groupId = group.id;

        chatElement.innerHTML = `
            <div class="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white font-medium shrink-0">
                ${group.name.charAt(0).toUpperCase()}
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="flex justify-between">
                    <div class="font-medium truncate text-black dark:text-white">${group.name}</div>
                    <div class="text-xs text-gray-500 whitespace-nowrap ml-2">You are a member</div>
                </div>
                <div class="flex items-center">
                    <div class="text-sm text-gray-500 truncate">
                        ${group.members.length} members
                    </div>
                </div>
            </div>
        `;

        chatElement.addEventListener("click", () => {
            openGroupChat(group);
        });

        elements.chatsList.appendChild(chatElement);
    });

    const groupsToShow = state.groups.filter((group) => !state.myGroups.some((my) => my.id === group.id));

    groupsToShow.forEach((group) => {
        hasGroups = true;

        const chatElement = document.createElement("div");
        chatElement.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";
        chatElement.dataset.groupId = group.id;

        chatElement.innerHTML = `
            <div class="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white font-medium shrink-0">
                ${group.name.charAt(0).toUpperCase()}
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="flex justify-between">
                    <div class="font-medium truncate text-black dark:text-white">${group.name}</div>
                    <div class="text-xs text-gray-500 whitespace-nowrap ml-2">You are not a member</div>
                </div>
                <div class="flex items-center">
                    <div class="text-sm text-gray-500 truncate">
                        ${group.members.length} members
                    </div>
                </div>
            </div>
        `;

        chatElement.addEventListener("click", () => {
            joinGroup(group.id);
        });

        elements.chatsList.appendChild(chatElement);
    });

    if (!hasGroups) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">${renderNotEmpty[Math.floor(Math.random() * renderNotEmpty.length)]}</div>`;
    }
}

function renderGroupSearchResults(groups) {
    elements.chatsList.innerHTML = "";

    if (!groups.length) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">No matching groups found.</div>`;
        return;
    }

    groups.forEach((group) => {
        const groupElement = document.createElement("div");
        groupElement.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";
        groupElement.dataset.groupId = group.id;

        groupElement.innerHTML = `
            <div class="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white font-medium shrink-0">
                ${group.name.charAt(0).toUpperCase()}
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="flex justify-between">
                    <div class="font-medium truncate text-black dark:text-white">${group.name}</div>
                    <div class="text-xs text-gray-500 whitespace-nowrap ml-2"></div>
                </div>
                <div class="flex items-center">
                    <div class="text-sm text-gray-500 truncate">
                        ${group.members.length} members
                    </div>
                </div>
            </div>
        `;

        groupElement.addEventListener("click", () => {
            if (isMember) {
                openGroupChat(group);
            } else {
                joinGroup(group.id);
            }
        });

        elements.chatsList.appendChild(groupElement);
    });
}

function renderSettingsList() {
    const container = elements.chatsList;
    if (!container) return;

    container.innerHTML = "";

    const settings = [
        {
            icon: `<i class="fas fa-copy"></i>`,
            label: "Copy your ID",
            onClick: () => {navigator.clipboard.writeText(state.myId);showToast("You copied your ID")}
        },
        {
            icon: `<i class="fas fa-camera"></i>`,
            label: "Upload Profile Photo",
            onClick: () => document.getElementById("uploadAvatarInput")?.click()
        },
        {
            icon: `<i class="fas fa-user-secret"></i>`,
            label: state.hiddenFromSearch ? "You are hidden from search" : "You are visible in search",
            onClick: () => toggleSearchVisibility()
        },
        {
            icon: `<i class="fas fa-sign-out-alt"></i>`,
            label: "Log Out",
            onClick: () => logoutUser()
        }
    ];

    settings.forEach(setting => {
        const item = document.createElement("div");
        item.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";

        item.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center text-lg shrink-0">
                ${setting.icon}
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="font-medium truncate text-black dark:text-white">${setting.label}</div>
            </div>
        `;

        item.onclick = setting.onClick;
        container.appendChild(item);
    });
}

function renderSettingsSearchResults(filteredSettings) {
    const container = elements.chatsList;
    if (!container) return;

    container.innerHTML = "";

    if (filteredSettings.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">No matching settings found.</div>`;
        return;
    }

    filteredSettings.forEach(setting => {
        const item = document.createElement("div");
        item.className = "flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer chat-item";

        item.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center text-lg shrink-0">
                ${setting.icon}
            </div>
            <div class="ml-3 flex-1 min-w-0">
                <div class="font-medium truncate text-black dark:text-white">${setting.label}</div>
            </div>
        `;

        item.onclick = setting.onClick;
        container.appendChild(item);
    });
}



/*
 * 7. Navigation and Button Logic
 */
let activeTabId = "btnChats";

const sidebarButtons = [
    { id: "btnChats", action: renderChats },
    { id: "btnGroups", action: renderGroups },
    { id: "btnStorys", action: renderStorys },
    { id: "btnSettings", action: renderSettings }
];

function activateButton(buttonList, activeId) {
    buttonList.forEach(({ id }) => {
        const btn = document.getElementById(id);
        if (id === activeId) {
            btn.classList.add("text-accent");
            btn.classList.remove("text-gray-500");
        } else {
            btn.classList.remove("text-accent");
            btn.classList.add("text-gray-500");
        }
    });
}

sidebarButtons.forEach(({ id, action }) => {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
        activeTabId = id;
        activateButton(sidebarButtons, id);
        action();
    });
});

const mobileButtons = [
    { id: "mobBtnChats", action: renderChats },
    { id: "mobBtnGroups", action: renderGroups },
    { id: "mobBtnStorys", action: renderStorys },
    { id: "mobBtnSettings", action: renderSettings }
];

mobileButtons.forEach(({ id, action }) => {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
        activeTabId = id;
        activateButton(mobileButtons, id);
        action();
    });
});


/*
 * 8. Media Upload Handlers
 */
function handleProfilePictureUpload() {
    const file = elements.uploadAvatarInput.files[0];
    if (!file?.type.startsWith("image/")) {
        showToast("Lütfen geçerli bir resim dosyası seçin.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const base64Image = reader.result;
        localStorage.setItem(STORAGE_KEYS.PROFILE_PIC, base64Image);
        document.querySelector("#btnSettings img").src = base64Image;
        document.querySelector("#mobBtnSettings img").src = base64Image;
        showToast("Profil resmi güncellendi");
        socket.emit("update-profile-pic", base64Image);
    };
    reader.readAsDataURL(file);
}

function handleStoryUpload() {
    const file = elements.storyInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        showToast("Lütfen bir resim veya video dosyası seçin.");
        return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast("Dosya boyutu 10MB'dan küçük olmalıdır.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const content = reader.result;
        const type = file.type.startsWith("image/") ? "image" : "video";

        socket.emit("upload-story", {
            content,
            type,
            caption: "",
        });

        showToast("Hikaye başarıyla yüklendi!");
    };
    reader.readAsDataURL(file);
}


/*
 * 9. View Logic
 */
function renderChats() {
    renderChatsList();
    showOnlyTab(TabChat);
}
function renderGroups() {
    renderGroupsList();
    showOnlyTab(TabGroup);
}
function renderStorys() {
    renderStoriesList();
    showOnlyTab(TabStory);
}
function renderSettings() {
    renderSettingsList();
    showOnlyTab(TabSetting);
}

function showOnlyTab(tab) {
    TabChat.classList.add("hidden");
    TabGroup.classList.add("hidden");
    TabStory.classList.add("hidden");
    TabSetting.classList.add("hidden");
    tab.classList.remove("hidden");
}


/*
 * 10. Messaging
 */

function sendMessage() {
    const text = elements.messageInput?.value.trim();
    if (!text) return;

    if (state.currentView === "group" && state.selectedGroup) {
        // Send group message
        socket.emit("send-group-message", {
            groupId: state.selectedGroup.id,
            message: text,
        });

        logMessage(text, "me");
        elements.messageInput.value = "";
        return;
    }

    if (!state.dataChannel || state.dataChannel.readyState !== "open") {
        showSystemMessage("Mesaj gönderilemedi. Bağlantı kapalı.");
        return;
    }

    try {
        state.dataChannel.send(JSON.stringify({
            type: "text",
            message: text,
        }));

        logMessage(text, "me");
        elements.messageInput.value = "";
    } catch (error) {
        console.error("Error sending message:", error);
        showSystemMessage("Mesaj gönderilemedi: " + error.message);
    }
}

function handleData(data) {
    if (typeof data === "string") {
        try {
            const msg = JSON.parse(data);
            if (msg.type === "text") {
                logMessage(msg.message, "them");
                playNotificationSound();
            } else if (msg.type === "typing") {
                if (elements.chatStatus) {
                    elements.chatStatus.textContent = "Yazıyor...";
                    elements.chatStatus.style.color = "orange";
                }
            } else if (msg.type === "stop-typing") {
                if (elements.chatStatus) {
                    elements.chatStatus.textContent = "online";
                    elements.chatStatus.style.color = "";
                }
            }
        } catch (e) {
            console.error("Error parsing message:", e);
        }
    }
}

function logMessage(text, from) {
    if (!elements.messagesContainer) return;

    const wrapper = document.createElement("div");
    wrapper.className = `flex ${from === "me" ? "justify-end" : "justify-start"} mb-4`;

    const msgDiv = document.createElement("div");
    msgDiv.className = `max-w-[80%] px-3 py-2 rounded-lg ${
        from === "me" 
            ? "bg-messageBg-light dark:bg-messageBg-dark rounded-br-none" 
            : "bg-messageBg-light dark:bg-messageBg-dark rounded-bl-none"
    }`;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const processedText = text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">${url}</a>`;
    });

    msgDiv.innerHTML = `
        <div class="text-sm whitespace-pre-wrap">${processedText}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 text-${from === "me" ? "right" : "left"} mt-1">
            ${formatTime(new Date())}
        </div>
    `;

    wrapper.appendChild(msgDiv);
    elements.messagesContainer.appendChild(wrapper);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showSystemMessage(message) {
    if (!elements.messagesContainer) return;

    const wrapper = document.createElement("div");
    wrapper.className = "flex justify-center mb-4";

    const msgDiv = document.createElement("div");
    msgDiv.className = "bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-600 dark:text-gray-300";
    msgDiv.textContent = message;

    wrapper.appendChild(msgDiv);
    elements.messagesContainer.appendChild(wrapper);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}



/*
 * 11. WebRTC Functions
 */
function createPeer() {
    const config = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ],
    };

    const peer = new RTCPeerConnection(config);

    peer.onicecandidate = (e) => {
        if (e.candidate && state.remoteId) {
            socket.emit("send-ice-candidate", {
                targetId: state.remoteId,
                candidate: e.candidate,
            });
        }
    };

    peer.ondatachannel = (e) => {
        state.dataChannel = e.channel;
        setupChannel();
    };

    peer.onconnectionstatechange = () => {
        console.log("Connection state:", peer.connectionState);
        if (["disconnected", "failed", "closed"].includes(peer.connectionState)) {
            handlePeerDisconnect();
        }
    };

    state.activePeerConnection = peer;
    return peer;
}

function setupChannel() {
    if (elements.sendMessageBtn) elements.sendMessageBtn.disabled = false;

    state.dataChannel.onopen = () => {
        updateStatus(CONNECTION_STATES.CONNECTED);
        localStorage.setItem(STORAGE_KEYS.CONNECTION_STATUS, "true");
    };

    state.dataChannel.onclose = () => handlePeerDisconnect();
    state.dataChannel.onerror = (error) => {
        console.error("Data channel error:", error);
        handlePeerDisconnect();
    };
    state.dataChannel.onmessage = (e) => handleData(e.data);
}

async function startCall(id) {
    if (!id) {
        showToast("Lütfen bir hedef ID girin");
        return;
    }

    if (state.connectionStatus) {
        const confirmReconnect = confirm("Zaten bir sohbete bağlısınız. Önceki sohbeti kapatıp yeni bir bağlantı kurmak istiyor musunuz?");
        if (!confirmReconnect) return;
        handlePeerDisconnect();
    }

    try {
        state.remoteId = id;
        sessionStorage.setItem(STORAGE_KEYS.REMOTE_ID, id);

        state.peer = createPeer();
        state.dataChannel = state.peer.createDataChannel("chat");
        setupChannel();

        updateStatus(CONNECTION_STATES.CONNECTING);

        const offer = await state.peer.createOffer();
        await state.peer.setLocalDescription(offer);

        socket.emit("call-user", {
            targetId: state.remoteId,
            offer,
        });
    } catch (error) {
        console.error("Error creating offer:", error);
        handlePeerDisconnect();
    }
}

function handlePeerDisconnect() {
    if (!state.connectionStatus) return;

    console.log("Peer disconnected, cleaning up...");
    updateStatus(CONNECTION_STATES.DISCONNECTED);
    showSystemMessage("Karşı taraf bağlantıyı kapattı veya bağlantı kaybedildi.");

    // Clean up resources
    closeChat();
    state.dataChannel?.close();
    state.activePeerConnection?.close();

    // Reset state
    Object.assign(state, {
        dataChannel: null,
        activePeerConnection: null,
        connectionStatus: false,
        remoteId: null,
        receivedBuffers: [],
        incomingFileInfo: null,
    });

    // Clear connection state in localStorage
    sessionStorage.removeItem(STORAGE_KEYS.REMOTE_ID);
    localStorage.removeItem(STORAGE_KEYS.CONNECTION_STATUS);

    if (elements.sendMessageBtn) elements.sendMessageBtn.disabled = true;
}

/*
 * 12. Group Chat Screen
 */
function showGroupCreationForm() {
    const container = document.getElementById('chats-list');

    container.innerHTML = `
        <div class="dark:text-light text-dark p-4 space-y-4 text-sm">
        <label class=block>
            <span>Grup Adı:</span>
            <input class="dark:text-light text-dark bg-gray-100 dark:bg-gray-800 py-2 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent my-4 pl-4 placeholder-gray-500 pr-4 rounded-lg text-base w-full"id=group-name-input placeholder="Örn. Geliştiriciler"></label>
            <label class="flex cursor-pointer items-center space-x-3">
            <input class="accent-accent border border-dark dark:accent-accentHover dark:border-light peer rounded size-4"id=group-private-checkbox type=checkbox>
            <span class="dark:text-light text-dark text-base select-none">Özel Grup</span>
        </label>
        <div class="flex justify-end space-x-2">
            <button class="dark:text-light text-dark bg-secondaryLight dark:bg-secondaryDark py-2 dark:hover:bg-gray-700 hover:bg-gray-300 px-4 rounded"onclick=cancelGroupCreation()>İptal</button>
            <button class="py-2 px-4 rounded bg-accent hover:bg-accentHover text-light"onclick=createGroup()>Oluştur</button>
        </div>
    </div>
    `;
}

function cancelGroupCreation() {
    const container = document.getElementById('chats-list');
    container.innerHTML = `<div class="p-4 text-center text-gray-500">Grup listesi yükleniyor...</div>`;
    renderGroupsList();
}

function createGroup() {
    const name = document.getElementById("group-name-input").value.trim();
    const isPrivate = document.getElementById("group-private-checkbox").checked;

    if (!name) {
        showToast("Grup adı gereklidir");
        return;
    }

    socket.emit("create-group", {
        name,
        isPrivate,
    });

    hideCreateGroupModal();
}

function joinGroup(id) {
    const groupId = id || document.getElementById("join-group-id-input").value.trim();

    if (!groupId) {
        showToast("Grup ID gereklidir");
        return;
    }

    socket.emit("join-group", { groupId });
}

function leaveGroup() {
    if (!state.selectedGroup) return;

    const confirmLeave = confirm(`"${state.selectedGroup.name}" grubundan ayrılmak istediğinizden emin misiniz?`);
    if (!confirmLeave) return;

    socket.emit("leave-group", { groupId: state.selectedGroup.id });
}

function openGroupChat(group) {
    state.activeChat = group;
    state.selectedGroup = group;
    state.currentView = "group";

    prepareChatUI();

    if (elements.chatName) elements.chatName.textContent = group.name;
    if (elements.chatAvatar) {
        elements.chatAvatar.innerHTML = `<div class="w-full h-full rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">${group.name.charAt(0).toUpperCase()}</div>`;
    }
    if (elements.chatStatus) elements.chatStatus.textContent = `${group.members.length} members`;

    socket.emit("join-group-room", { groupId: group.id });
}


function closeGroupChat() {
    // Leave group room
    if (state.selectedGroup?.id) {
        socket.emit("leave-group-room", { groupId: state.selectedGroup.id });
    }

    // Clear state
    state.activeChat = null;
    state.selectedGroup = null;
    state.currentView = null;

    // Hide chat UI
    if (elements.chatContent) {
        elements.chatContent.classList.add("hidden");
        elements.chatContent.classList.remove("flex");
    }
    if (elements.chatPanel) {
        elements.chatPanel.classList.remove("mobile-chat-open");
        elements.chatPanel.classList.add("mobile-chat-closed");
    }
    if (elements.noChatPlaceholder) {
        elements.noChatPlaceholder.classList.remove("hidden");
    }

    // Clear messages
    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = "";
    }
}


/*
 * 13. Story Screen
 */
let isStoryPlaying = false;
let storyTimeout = null;

function openStory(user) {
    if (isStoryPlaying) return;
    if (!user?.persistentUserId) return;

    closeChat();

    const storyData = state.currentStories[user.persistentUserId];
    const stories = storyData?.stories?.filter(s => s.type === "image") || [];

    if (!stories.length) {
        showToast("Bu kullanıcıya ait hikaye yok.");
        return;
    }

    isStoryPlaying = true; // Hikaye oynatılıyor

    const panel = document.getElementById("story-panel");
    const img = document.getElementById("story-image");
    const progressContainer = document.getElementById("story-progress-container");
    const usernameLabel = document.getElementById("story-username");
    const avatar = document.getElementById("story-avatar");

    elements.noChatPlaceholder?.classList.add("hidden");
    panel.classList.remove("hidden");
    document.getElementById("chat-panel")?.classList.remove("hidden");
    document.getElementById("chat-panel")?.classList.remove("mobile-chat-closed");
    document.getElementById("chat-panel")?.classList.add("mobile-chat-open");

    usernameLabel.textContent = user.username;
    avatar.src = user.profilePic || DEFAULT_PROFILE_PIC;

    progressContainer.innerHTML = "";
    stories.forEach((_, i) => {
        const bar = document.createElement("div");
        bar.className = "h-full bg-gray-700 relative flex-1 mx-0.5 overflow-hidden rounded";
        bar.innerHTML = `<div id="progress-fill-${i}" class="absolute top-0 left-0 h-full bg-accent w-0 transition-all"></div>`;
        progressContainer.appendChild(bar);
    });

    let index = 0;

    function showNextStory() {
        if (!isStoryPlaying) return;

        if (index >= stories.length) {
            closeStory();
            isStoryPlaying = false;
            return;
        }

        const story = stories[index];
        img.src = story.content;
        if (user.persistentUserId === state.myPersistentId) {
            const deleteBtn = document.getElementById("delete-story-btn");
            if (deleteBtn) {
                deleteBtn.classList.remove("hidden");
                deleteBtn.onclick = () => {
                    if (confirm("Bu hikayeyi silmek istediğine emin misin?")) {
                        socket.emit("delete-story", { storyId: story.id });
                        closeStory();
                    }
                };
            }
        }

        img.draggable = false;
        img.addEventListener("touchstart", e => e.preventDefault());
        img.addEventListener("mousedown", e => e.preventDefault());
        img.classList.remove("hidden");

        const fill = document.getElementById(`progress-fill-${index}`);
        fill.style.width = "0%";
        fill.style.transition = "none";

        requestAnimationFrame(() => {
            fill.style.transition = `width ${STORY_DURATION.IMAGE}ms linear`;
            fill.style.width = "100%";
        });

        storyTimeout = setTimeout(() => {
            index++;
            showNextStory();
        }, STORY_DURATION.IMAGE);

    }

    showNextStory();
}

function closeStory() { 
    const chatPanel = document.getElementById("chat-panel");
    const panel = document.getElementById("story-panel");
    const img = document.getElementById("story-image");
    const progressContainer = document.getElementById("story-progress-container");
    const deleteBtn = document.getElementById("delete-story-btn");

    // Hikaye oynatmayı durdur
    if (storyTimeout) {
        clearTimeout(storyTimeout);
        storyTimeout = null;
    }
    isStoryPlaying = false;

    // UI temizle
    if (deleteBtn) deleteBtn.classList.add("hidden");
    img.src = "";
    panel.classList.add("hidden");
    progressContainer.innerHTML = "";
    chatPanel.classList.add("hidden");
    chatPanel.classList.add("mobile-chat-closed");
    chatPanel.classList.remove("mobile-chat-open");

    elements.noChatPlaceholder?.classList.remove("hidden");
}



/*
 * 14. User Chat Screen
 */
function prepareChatUI() {
    if (elements.sendMessageBtn) elements.sendMessageBtn.disabled = false;
    elements.noChatPlaceholder?.classList.add("hidden");

    if (elements.chatContent) {
        elements.chatContent.classList.remove("hidden");
        elements.chatContent.classList.add("flex");
    }

    if (elements.chatPanel) {
        elements.chatPanel.classList.remove("hidden");
        elements.chatPanel.classList.add("mobile-chat-open");
        elements.chatPanel.classList.remove("mobile-chat-closed");
    }

    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = "";
    }

    setTimeout(elements.messageInput?.focus(), 0)
}

function openChat(user) {
    closeStory(); 
    state.activeChat = user;
    state.selectedUser = user;
    state.currentView = "chat";

    prepareChatUI();

    // Başlık & avatar
    if (elements.chatName) elements.chatName.textContent = user.username;
    if (elements.chatAvatar) {
        elements.chatAvatar.innerHTML = `<img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}" class="w-full h-full rounded-full object-cover">`;
    }
    if (elements.chatStatus) elements.chatStatus.textContent = "online";

    startCall(user.id);
}

function closeChat() {
    // Clear state
    state.activeChat = null;
    state.selectedUser = null;
    state.currentView = null;

    // Hide chat UI
    if (elements.chatContent) {
        elements.chatContent.classList.add("hidden");
        elements.chatContent.classList.remove("flex");
    }

    if (elements.chatPanel) {
        elements.chatPanel.classList.remove("mobile-chat-open");
        elements.chatPanel.classList.add("mobile-chat-closed");
    }

    if (elements.noChatPlaceholder) {
        elements.noChatPlaceholder.classList.remove("hidden");
    }

    // Clear messages
    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = "";
    }
}

function toggleFloatingMenu() {
    const menu = document.getElementById("floating-menu");
    const isVisible = !menu.classList.contains("hidden");

    if (isVisible) {
        menu.classList.add("hidden");
        return;
    }

    const { currentView, selectedUser, selectedGroup } = state;

    const copyBtn = document.getElementById("copy-id-btn");
    const chatBtn = document.getElementById("leave-chat-btn");
    const leaveBtn = document.getElementById("leave-group-btn");

    if (currentView === "group" && selectedGroup) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(selectedGroup.id);
            showToast("Group ID kopyalandı");
            menu.classList.add("hidden");
        };

        chatBtn.classList.add("hidden");
        
        leaveBtn.classList.remove("hidden");
        leaveBtn.onclick = () => {
            leaveGroup();
            menu.classList.add("hidden");
        };

    } else if (currentView === "chat") {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(selectedUser.id);
            showToast("Kullanıcı ID kopyalandı");
            menu.classList.add("hidden");
        };

        chatBtn.classList.remove("hidden");
        chatBtn.onclick = () => {
            handlePeerDisconnect();
            menu.classList.add("hidden");
        }

        leaveBtn.classList.add("hidden");
    }

    menu.classList.remove("hidden");
}


/*
 * 15. Utilities
 */
function updateStatus(text) {
    console.log("Status:", text);
    if (text === CONNECTION_STATES.CONNECTED) {
        state.connectionStatus = true;
    } else if (text === CONNECTION_STATES.DISCONNECTED) {
        state.connectionStatus = false;
    }
}

function formatTime(date) {
    return date.toLocaleString("en-US", { 
        hour: "numeric", 
        minute: "numeric", 
        hour12: false
    });
}

function timeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds} saniye önce paylaşıldı`;
  if (minutes < 60) return `${minutes} dakika önce paylaşıldı`;
  if (hours   < 24) return `${hours} saat önce paylaşıldı`;
  return `${days} gün önce paylaşıldı`;
}

function playNotificationSound() {
    // Create audio element if it doesn't exist
    let audio = document.getElementById("notification-sound");
    if (!audio) {
        audio = document.createElement("audio");
        audio.id = "notification-sound";
        audio.src = "assets/notification.mp3";
        document.body.appendChild(audio);
    }
    audio.play().catch((e) => console.log("Audio play error:", e));
}

function searchInCurrentTab(query) {
    if (!state.isConnected) {
        elements.chatsList.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 py-10">Connecting to server...</div>`;
        return;
    }

    const q = query.trim().toLowerCase();
    const settings = [
        {
            icon: `<i class="fas fa-copy"></i>`,
            label: "Copy your ID",
            onClick: () => {
                navigator.clipboard.writeText(state.myId);
                showToast("You copied your ID");
            }
        },
        {
            icon: `<i class="fas fa-camera"></i>`,
            label: "Upload Profile Photo",
            onClick: () => document.getElementById("uploadAvatarInput")?.click()
        },
        {
            icon: `<i class="fas fa-user-secret"></i>`,
            label: state.hiddenFromSearch ? "You are hidden from search" : "You are visible in search",
            onClick: () => toggleSearchVisibility()
        },
        {
            icon: `<i class="fas fa-sign-out-alt"></i>`,
            label: "Log Out",
            onClick: () => logoutUser()
        }
    ];

    // 🟡 CHAT
    if (activeTabId === "btnChats" || activeTabId === "mobBtnChats") {
        const matchedUsers = state.allUsers.filter(user =>
            user.id !== state.myId &&
            !user.hidden &&
            user.username.toLowerCase().includes(q)
        );
        renderChatSearchResults(matchedUsers);
    }

    // 🔵 GROUP
    else if (activeTabId === "btnGroups" || activeTabId === "mobBtnGroups") {
        const matchedGroups = state.groups.filter(group =>
            group.name.toLowerCase().includes(q)
        );
        renderGroupSearchResults(matchedGroups);
    }

    // 🟣 STORY
    else if (activeTabId === "btnStorys" || activeTabId === "mobBtnStorys") {
        const matchedStories = Object.values(state.currentStories).filter(story =>
            story?.user?.username.toLowerCase().includes(q)
        );
        renderStorySearchResults(matchedStories);
    }

    // ⚙️ SETTINGS

    
    else if (activeTabId === "btnSettings" || activeTabId === "mobBtnSettings") {
        const filteredSettings = settings.filter(setting =>
            setting.label.toLowerCase().includes(query.toLowerCase())
        );
        renderSettingsSearchResults(filteredSettings);
    }

    else {
        console.warn("Unknown tab for search:", activeTabId);
    }
}


function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector(".toast");
    existingToast?.remove();

    const toast = document.createElement("div");
    toast.className = "toast fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast with animation
    requestAnimationFrame(() => {
        toast.classList.remove("translate-x-full");
    });

    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.add("translate-x-full");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/*
 * 16. Socket Events
 */
socket.on("connect", () => {
    state.isConnected = true;
    initApp();
    document.querySelector("#btnSettings img").src = profilePic;
    document.querySelector("#mobBtnSettings img").src = profilePic;
});

socket.on("your-id", ({ socketId, persistentUserId }) => {
    state.myId = socketId;
    state.myPersistentId = persistentUserId;
    localStorage.setItem(STORAGE_KEYS.PERSISTENT_USER_ID, persistentUserId);
    console.log(`Connected with socket ID: ${socketId}, persistent ID: ${persistentUserId}`);
});

socket.on("nickname-restricted", (message) => {
    alert(message || "Kullanıcı adınız kısıtlanmış. Bağlantı sonlandırıldı.");
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
    localStorage.removeItem(STORAGE_KEYS.PERSISTENT_USER_ID);
});

socket.on("online-users", (users) => {
    state.allUsers = users;
    if (activeTabId == "btnChats" || activeTabId == "mobBtnChats") renderChatsList();
});

socket.on("user-disconnected", (userId) => {
    if (state.connectionStatus && state.remoteId === userId) {
        handlePeerDisconnect();
    }
});

socket.on("stories-updated", (stories) => {
    state.currentStories = stories;
    if (activeTabId == "btnStorys" || activeTabId == "mobBtnStorys") renderStoriesList(stories);
});

socket.on("groups-updated", (groups) => {
    state.groups = groups;
    if (activeTabId == "btnGroups" || activeTabId == "mobBtnGroups") renderGroupsList();
});

socket.on("my-groups-updated", (myGroups) => {
    state.myGroups = myGroups;
    if (activeTabId == "btnGroups" || activeTabId == "mobBtnGroups") renderGroupsList();
});

socket.on("group-created", (data) => {
    showToast(`"${data.group.name}" grubu başarıyla oluşturuldu!`);
    state.myGroups.push(data.group);
    renderGroupsList();
});

socket.on("group-joined", (data) => {
    showToast(`"${data.group.name}" grubuna katıldınız!`);
    state.myGroups.push(data.group);
    renderGroupsList();
});

socket.on("group-left", (data) => {
    showToast(`"${data.groupName}" grubundan ayrıldınız`);
    state.myGroups = state.myGroups.filter((g) => g.id !== data.groupId);
    renderGroupsList();
    closeGroupChat();
});

socket.on("group-message", (data) => {
    if (state.currentView === "group" && state.selectedGroup?.id === data.groupId) {
        logMessage(`<div class="text-xs text-accent dark:text-accent text-left mt-1">${data.sender.username}</div>${data.message}`, "them");
        playNotificationSound();
    }
});

socket.on("group-error", (error) => {
    showToast(error.message || "Grup işlemi başarısız");
    closeGroupChat();
});

socket.on("incoming-call", async ({ from, offer }) => {
    const caller = state.allUsers.find((user) => user.id === from);
    if (!caller) return;

    state.remoteId = from;

    if (state.connectionStatus) {
        socket.emit("call-rejected", {
            targetId: from,
            reason: "Busy",
        });
        return;
    }

    const confirmConnect = confirm(`${caller.username} sizinle bağlantı kurmak istiyor. Kabul ediyor musunuz?`);
    if (!confirmConnect) {
        socket.emit("call-rejected", {
            targetId: from,
            reason: "Rejected",
        });
        return;
    }

    try {
        state.peer = createPeer();
        updateStatus("Yanıtlanıyor...");
        openChat(caller);

        await state.peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await state.peer.createAnswer();
        await state.peer.setLocalDescription(answer);

        socket.emit("send-answer", {
            targetId: state.remoteId,
            answer,
        });

        state.connectionStatus = true;
        sessionStorage.setItem(STORAGE_KEYS.REMOTE_ID, from);
    } catch (error) {
        console.error("Error handling incoming call:", error);
        handlePeerDisconnect();
    }
});

socket.on("call-answered", async ({ answer }) => {
    try {
        await state.peer.setRemoteDescription(new RTCSessionDescription(answer));
        state.connectionStatus = true;
    } catch (error) {
        console.error("Error handling call answer:", error);
        handlePeerDisconnect();
    }
});

socket.on("call-rejected", ({ reason }) => {
    updateStatus("Bağlantı reddedildi: " + reason);
    showToast("Bağlanmaya çalıştığınız kişi meşgul veya bağlantıyı reddetti");
    sessionStorage.removeItem(STORAGE_KEYS.REMOTE_ID);

    state.activePeerConnection?.close();
    state.activePeerConnection = null;
    state.connectionStatus = false;
    state.remoteId = null;
    closeChat();
});

socket.on("ice-candidate", async ({ candidate }) => {
    if (state.peer) {
        try {
            await state.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error("Error adding ICE candidate:", error);
        }
    }
});

/*
 * 17. Settings Functions
 */
function logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
    localStorage.removeItem(STORAGE_KEYS.PERSISTENT_USER_ID);
    window.location.href = "login.html";
}

function toggleSearchVisibility() {
    state.hiddenFromSearch = !state.hiddenFromSearch;
    localStorage.setItem(STORAGE_KEYS.HIDDEN, state.hiddenFromSearch);

    if (state.hiddenFromSearch) { 
        showToast("You are now hidden from search");
    } else {
        showToast("You are now visible in search");
    }

    socket.emit("update-visibility", { hidden: state.hiddenFromSearch });
    renderSettingsList();
}

/*
 * 18. App Ready
 */
document.addEventListener("DOMContentLoaded", () => {
    initStoryFunctionality();
    initProfilePictureUpload();
    sessionStorage.removeItem(STORAGE_KEYS.REMOTE_ID);
    localStorage.removeItem(STORAGE_KEYS.CONNECTION_STATUS);
    if (elements.noChatPlaceholder) elements.noChatPlaceholder.classList.remove("hidden");
    if (elements.chatContent) elements.chatContent.classList.add("hidden");
});

document.addEventListener("click", (e) => {
    const menu = document.getElementById("floating-menu");
    if (!menu.contains(e.target) && !e.target.closest("[onclick='toggleFloatingMenu()']")) {
        menu.classList.add("hidden");
    }
});

window.sendMessage = sendMessage;
