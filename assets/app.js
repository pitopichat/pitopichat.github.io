// Constants
const STORAGE_KEYS = {
  USERNAME: "p2p_username",
  PERSISTENT_USER_ID: "p2p_persistent_user_id",
  PROFILE_PIC: "p2p_pp_base64",
  HIDDEN: "p2p_hidden",
  REMOTE_ID: "p2p_remote_id",
  CONNECTION_STATUS: "p2p_connection_status",
}

const CONNECTION_STATES = {
  CONNECTED: "Bağlantı kuruldu",
  CONNECTING: "Bağlanıyor...",
  DISCONNECTED: "Bağlantı kaybedildi",
}

const SOCKET_SERVER = "https://pitopi.onrender.com"
const DEFAULT_PROFILE_PIC = "https://pbs.twimg.com/profile_images/1545518896874242055/s8icSRfU_400x400.jpg"
const STORY_DURATION = {
  IMAGE: 5000, // 5 seconds
  VIDEO_MAX: 15000, // 15 seconds max
}

// Check if user is logged in
const savedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME)
if (!savedUsername) {
  window.location.href = "login.html"
}

// Initialize with saved username and persistent user ID
const username = savedUsername
const savedBase64Pp = localStorage.getItem(STORAGE_KEYS.PROFILE_PIC)
const profilePic = savedBase64Pp || DEFAULT_PROFILE_PIC
const persistentUserId = localStorage.getItem(STORAGE_KEYS.PERSISTENT_USER_ID)

// Initialize socket connection with authentication including persistent user ID
const socket = io(SOCKET_SERVER, {
  transports: ['websocket'],
  auth: {
    username,
    profilePic,
    persistentUserId,
  }
})

// Global state
const state = {
  peer: null,
  dataChannel: null,
  receivedBuffers: [],
  incomingFileInfo: null,
  connectionStatus: localStorage.getItem(STORAGE_KEYS.CONNECTION_STATUS) === "true",
  remoteId: localStorage.getItem(STORAGE_KEYS.REMOTE_ID) || null,
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
  activeGroupId: null,
  currentView: "home", // "home" or "chat"
  selectedUser: null,
}

// DOM elements cache
const elements = {
  get myId() {
    return document.getElementById("my-id")
  },
  get myName() {
    return document.getElementById("my-name")
  },
  get myPp() {
    return document.getElementById("my-pp")
  },
  get status() {
    return document.getElementById("status")
  },
  get sendBtn() {
    return document.getElementById("send-btn")
  },
  get fileBtn() {
    return document.getElementById("fileInput")
  },
  get chat() {
    return document.getElementById("chat")
  },
  get msgInput() {
    return document.getElementById("msg")
  },
  get homepage() {
    return document.getElementById("homepage")
  },
  get chatContainer() {
    return document.getElementById("chat-container")
  },
  get inputContainer() {
    return document.getElementById("input-container")
  },
  get searchInput() {
    return document.getElementById("searchId")
  },
  get logoutBtn() {
    return document.getElementById("logout-btn")
  },
  get hideFromSearchBtn() {
    return document.getElementById("hide-from-search")
  },
  get uploadPpBtn() {
    return document.getElementById("upload-pp-btn")
  },
  get uploadPpInput() {
    return document.getElementById("upload-pp-input")
  },
  get addStoryBtn() {
    return document.getElementById("add-story-btn")
  },
  get storyInput() {
    return document.getElementById("storyInput")
  },
  get storiesContainer() {
    return document.getElementById("stories-container")
  },
  get storyModal() {
    return document.getElementById("story-modal")
  },
  get storyImage() {
    return document.getElementById("story-image")
  },
  get storyVideo() {
    return document.getElementById("story-video")
  },
  get storyAvatar() {
    return document.getElementById("story-avatar")
  },
  get storyUsername() {
    return document.getElementById("story-username")
  },
  get storyTime() {
    return document.getElementById("story-time")
  },
  get storyProgressBar() {
    return document.getElementById("story-progress-bar")
  },
  get notificationSound() {
    return document.getElementById("notification-sound")
  },
  get onlineUser() {
    return document.getElementById("onlineUser")
  },
  get storiesGrid() {
    return document.getElementById("stories-grid")
  },
  get usersGrid() {
    return document.getElementById("users-grid")
  },
  get totalOnline() {
    return document.getElementById("total-online")
  },
  get totalStories() {
    return document.getElementById("total-stories")
  },
  get onlineCount() {
    return document.getElementById("online-count")
  },
  get chatUserAvatar() {
    return document.getElementById("chat-user-avatar")
  },
  get chatUserName() {
    return document.getElementById("chat-user-name")
  },
  get chatHeader() {
    return document.getElementById("chat-header")
  }
}

// View Management
function showHomePage() {
  state.currentView = "home"
  state.selectedUser = null
  
  elements.homepage.style.display = "block"
  elements.chatContainer.style.display = "none"
  elements.inputContainer.style.display = "none"
  
  // Clear chat
  elements.chat.innerHTML = ""
  
  // Update URL without page reload
  history.pushState({ view: "home" }, "", window.location.pathname)
  
  // Disconnect if connected
  if (state.connectionStatus) {
    handlePeerDisconnect()
  }
}

function showChatPage(user) {
  state.currentView = "chat"
  state.selectedUser = user
  
  elements.homepage.style.display = "none"
  elements.chatContainer.style.display = "flex"
  elements.inputContainer.style.display = "block"
  
  // Update chat header
  elements.chatUserAvatar.src = user.profilePic || DEFAULT_PROFILE_PIC
  elements.chatUserName.textContent = user.username
  
  // Update URL without page reload
  history.pushState({ view: "chat", user: user.id }, "", window.location.pathname + "?chat=" + user.id)
  
  // Start connection
  startCall(user.id)
}

function leaveChat() {
  showHomePage()
  showToast("Sohbetten ayrıldınız")
}

// Sidebar Management
function openSidebar(side) {
  const sidebar = document.querySelector(`sidebar[${side}]`)
  if (sidebar) {
    sidebar.style.display = "flex"
    if (window.innerWidth <= 800) {
      document.body.classList.add("sidebar-open")
    }
  }
}

function closeSidebar(side) {
  const sidebar = document.querySelector(`sidebar[${side}]`)
  if (sidebar) {
    sidebar.style.display = "none"
    document.body.classList.remove("sidebar-open")
  }
}

// Utility functions
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

function throttle(func, limit) {
  let inThrottle
  return function () {
    const args = arguments

    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Story functionality
function initStoryFunctionality() {
  if (elements.addStoryBtn && elements.storyInput) {
    elements.addStoryBtn.addEventListener("click", () => {
      elements.storyInput.click()
    })

    elements.storyInput.addEventListener("change", handleStoryUpload)
  }
}

function handleStoryUpload() {
  const file = elements.storyInput.files[0]
  if (!file) return

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    showToast("Lütfen bir resim veya video dosyası seçin.")
    return
  }

  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showToast("Dosya boyutu 10MB'dan küçük olmalıdır.")
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const content = reader.result
    const type = file.type.startsWith("image/") ? "image" : "video"

    socket.emit("upload-story", {
      content,
      type,
      caption: "",
    })

    showToast("Hikaye başarıyla yüklendi!")
  }
  reader.readAsDataURL(file)
}

// Render functions
function renderHomePage() {
  // Update stats
  if (elements.totalOnline) {
    elements.totalOnline.textContent = state.allUsers.filter(user => user.id !== state.myId && !user.hidden).length
  }
  if (elements.totalStories) {
    elements.totalStories.textContent = Object.keys(state.currentStories).length
  }
  if (elements.onlineCount) {
    elements.onlineCount.textContent = state.allUsers.filter(user => user.id !== state.myId && !user.hidden).length
  }
  
  // Render stories grid
  renderStoriesGrid()
  
  // Render users grid
  renderUsersGrid()
}

function renderStoriesGrid() {
  const container = elements.storiesGrid
  if (!container) return

  container.innerHTML = ""

  // Add "Your Story" option
  const yourStoryCard = document.createElement("div")
  yourStoryCard.className = "story-card"
  yourStoryCard.innerHTML = `
    <div class="story-card-image" style="width: 150px; display: flex; align-items: center; justify-content: center; background-color: var(--secondary);">
      <div style="text-align: center;">
        <div class="story-avatar your-story" style="width: 50px; height: 50px; margin: 0 auto 10px;">
          <img src="${profilePic}" alt="Your Story">
          <div class="story-add-icon">+</div>
        </div>
        <span>Hikaye Ekle</span>
      </div>
    </div>
    <div class="story-card-info">
      <h4>Hikayeni Paylaş</h4>
      <p>Şimdi ekle</p>
    </div>
  `
  yourStoryCard.onclick = () => elements.storyInput.click()
  container.appendChild(yourStoryCard)

  Object.entries(state.currentStories).forEach(([persistentUserId, storyData]) => {
    if (persistentUserId === state.myPersistentId) return
    if (!storyData?.user || !storyData?.stories?.length) return

    const { user, stories: userStories } = storyData
    const latestStory = userStories[userStories.length - 1]

    const storyCard = document.createElement("div")
    storyCard.className = "story-card"
    storyCard.innerHTML = `
      <div class="story-card-image">
        <img src="${latestStory.content}" alt="Story" loading="lazy">
        <div class="story-card-user">
          <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}">
          <span>${user.username}</span>
        </div>
      </div>
      <div class="story-card-info">
        <h4>${user.username}</h4>
        <p>${getTimeAgo(latestStory.timestamp)}</p>
      </div>
    `

    storyCard.onclick = () => openStoryModal(persistentUserId, userStories, user)
    container.appendChild(storyCard)
  })
}

function renderUsersGrid() {
  const container = elements.usersGrid
  if (!container) return

  container.innerHTML = ""

  // Show only first 6 users on homepage
  const usersToShow = state.allUsers.filter(user => user.id !== state.myId && !user.hidden).slice(0, 6)

  usersToShow.forEach((user) => {
    const userCard = document.createElement("div")
    userCard.className = "user-card"
    userCard.innerHTML = `
      <div class="user-card-header">
        <div class="user-card-avatar">
          <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}" loading="lazy">
          <div class="user-card-online"></div>
        </div>
        <div class="user-card-info">
          <h4>${user.username}</h4>
          <p>Şu anda çevrimiçi</p>
        </div>
      </div>
      <button class="user-card-action">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
        Sohbet Başlat
      </button>
    `

    userCard.querySelector(".user-card-action").addEventListener("click", () => {
      showChatPage(user)
      if (window.innerWidth <= 800) {
        closeSidebar('left')
      }
    })
    
    container.appendChild(userCard)
  })
}

// Render stories with performance optimization
function renderStories(stories) {
  const container = elements.storiesContainer
  if (!container) return

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment()

  // Add "Your Story" option
  const yourStoryDiv = document.createElement("div")
  yourStoryDiv.className = "story-item your-story"
  yourStoryDiv.innerHTML = `
    <div class="story-avatar">
      <img src="${profilePic}" alt="Your Story" loading="lazy">
      <div class="story-add-icon">+</div>
    </div>
  `
  yourStoryDiv.onclick = () => elements.storyInput.click()
  fragment.appendChild(yourStoryDiv)

  // Add other users' stories
  Object.entries(stories).forEach(([persistentUserId, storyData]) => {
    if (persistentUserId === state.myPersistentId) return

    if (!storyData?.user || !storyData?.stories?.length) {
      console.log("Missing story data:", persistentUserId, storyData)
      return
    }

    const { user, stories: userStories } = storyData

    const storyDiv = document.createElement("div")
    storyDiv.className = "story-item"
    storyDiv.innerHTML = `
      <div class="story-avatar ${userStories.length > 0 ? "has-story" : ""}">
        <img src="${user.profilePic || DEFAULT_PROFILE_PIC}" alt="${user.username}" loading="lazy">
      </div>
    `

    storyDiv.onclick = () => openStoryModal(persistentUserId, userStories, user)
    fragment.appendChild(storyDiv)
  })

  // Clear container and append all at once
  container.innerHTML = ""
  container.appendChild(fragment)
}

// Story modal functions
function openStoryModal(persistentUserId, stories, user) {
  elements.storyProgressBar.style.width = 0;
  if (!stories?.length) return

  state.currentUserStories = stories
  state.currentStoryIndex = 0

  const modal = elements.storyModal
  const avatar = elements.storyAvatar
  const usernameEl = elements.storyUsername

  avatar.src = user.profilePic || DEFAULT_PROFILE_PIC
  usernameEl.textContent = user.username

  modal.style.display = "flex"
  showStory(0)

  socket.emit("view-story", {
    persistentUserId,
    storyId: stories[0].id,
  })
}

function showStory(index) {
  if (index >= state.currentUserStories.length) {
    closeStoryModal()
    return
  }

  const story = state.currentUserStories[index]
  const imageEl = elements.storyImage
  const videoEl = elements.storyVideo
  const timeEl = elements.storyTime
  const progressBar = elements.storyProgressBar

  timeEl.textContent = getTimeAgo(story.timestamp)

  // Hide both elements first
  imageEl.style.display = "none"
  videoEl.style.display = "none"

  if (story.type === "image") {
    imageEl.src = story.content
    imageEl.style.display = "block"
    startStoryTimer(STORY_DURATION.IMAGE)
  } else if (story.type === "video") {
    videoEl.src = story.content
    videoEl.style.display = "block"
    videoEl.onloadedmetadata = () => {
      const duration = Math.min(videoEl.duration * 1000, STORY_DURATION.VIDEO_MAX)
      startStoryTimer(duration)
    }
  }

  const progress = ((index + 1) / state.currentUserStories.length) * 100
  setTimeout(() => {
    progressBar.style.width = `${progress}%`
  }, 100);
}

function startStoryTimer(duration) {
  if (state.storyTimer) {
    clearTimeout(state.storyTimer)
  }

  state.storyTimer = setTimeout(() => {
    state.currentStoryIndex++
    showStory(state.currentStoryIndex)
  }, duration)
}

function closeStoryModal() {
  const modal = elements.storyModal
  modal.style.display = "none"

  if (state.storyTimer) {
    clearTimeout(state.storyTimer)
    state.storyTimer = null
  }

  const videoEl = elements.storyVideo
  if (videoEl) {
    videoEl.pause()
  }
}

function getTimeAgo(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))

  if (hours > 0) return `${hours} saat önce`
  if (minutes > 0) return `${minutes} dakika önce`
  return "Az önce"
}

// Profile picture upload
function initProfilePictureUpload() {
  if (elements.uploadPpBtn && elements.uploadPpInput) {
    elements.uploadPpBtn.addEventListener("click", () => {
      elements.uploadPpInput.click()
    })

    elements.uploadPpInput.addEventListener("change", handleProfilePictureUpload)
  }
}

function handleProfilePictureUpload() {
  const file = elements.uploadPpInput.files[0]
  if (!file?.type.startsWith("image/")) {
    showToast("Lütfen geçerli bir resim dosyası seçin.")
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const base64Image = reader.result
    localStorage.setItem(STORAGE_KEYS.PROFILE_PIC, base64Image)
    elements.myPp.src = base64Image
    showToast("Profil resmi güncellendi")
    socket.emit("update-profile-pic", base64Image)
  }
  reader.readAsDataURL(file)
}

// UI event listeners
function initUIEventListeners() {
  // Message input
  elements.msgInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      sendMessage()
    }
  })

  // Search with debouncing
  const debouncedSearch = debounce((searchTerm) => {
    filterUsers(searchTerm)
  }, 300)

  elements.searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value.toLowerCase().trim())
  })

  // Logout
  elements.logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.USERNAME)
    localStorage.removeItem(STORAGE_KEYS.PERSISTENT_USER_ID)
    window.location.href = "login.html"
  })

  // Hide from search toggle
  elements.hideFromSearchBtn?.addEventListener("click", toggleSearchVisibility)

  // Copy ID functionality
  elements.myId?.addEventListener("click", copyIdToClipboard)
  
  // Handle browser back button
  window.addEventListener("popstate", (event) => {
    if (event.state?.view === "home" || !event.state) {
      showHomePage()
    } else if (event.state?.view === "chat" && event.state?.user) {
      const user = state.allUsers.find(u => u.id === event.state.user)
      if (user) {
        showChatPage(user)
      } else {
        showHomePage()
      }
    }
  })
}

function toggleSearchVisibility() {
  state.hiddenFromSearch = !state.hiddenFromSearch
  localStorage.setItem(STORAGE_KEYS.HIDDEN, state.hiddenFromSearch)

  const btn = elements.hideFromSearchBtn
  const span = btn.querySelector("span")

  if (state.hiddenFromSearch) {
    btn.classList.add("hidden-from-search")
    span.textContent = "Aramada Göster"
    showToast("Artık aramada gizlisiniz")
  } else {
    btn.classList.remove("hidden-from-search")
    span.textContent = "Aramada Gizle"
    showToast("Artık aramada görünürsünüz")
  }

  socket.emit("update-visibility", { hidden: state.hiddenFromSearch })
}

async function copyIdToClipboard() {
  const idText = elements.myId.getAttribute("dataId") || state.myId

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(idText)
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = idText
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    }

    elements.myId.classList.add("copied")
    showToast("ID kopyalandı")

    setTimeout(() => {
      elements.myId.classList.remove("copied")
    }, 2000)
  } catch (err) {
    console.error("Copy failed:", err)
    showToast("ID kopyalanamadı. Lütfen manuel olarak kopyalayın.")
  }
}

// Toast notification with better positioning
function showToast(message) {
  // Remove existing toast
  const existingToast = document.querySelector(".toast")
  existingToast?.remove()

  const toast = document.createElement("div")
  toast.className = "toast"
  toast.textContent = message
  document.body.appendChild(toast)

  // Show toast with animation
  requestAnimationFrame(() => {
    toast.classList.add("show")
  })

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// User filtering and rendering
function filterUsers(searchTerm) {
  const container = elements.onlineUser
  if (!container) return

  const filteredUsers = state.allUsers.filter(
    (user) =>
      user.id !== state.myId &&
      !user.hidden &&
      (user.username.toLowerCase().includes(searchTerm) || user.id.toLowerCase().includes(searchTerm)),
  )

  if (filteredUsers.length === 0) {
    container.innerHTML = "<span style='color: var(--muted-foreground); padding: 0.75rem;'>Şu anda çevrimiçi kullanıcı yok.</span>"
  } else {
    renderUsers(filteredUsers)
  }
}

function renderUsers(users) {
  const container = elements.onlineUser
  const fragment = document.createDocumentFragment()

  users.forEach((user) => {
    const div = document.createElement("div")
    div.classList.add("user")

    const avatar = document.createElement("img")
    avatar.src = user.profilePic || DEFAULT_PROFILE_PIC
    avatar.width = 35
    avatar.height = 35
    avatar.style.borderRadius = "50%"
    avatar.style.marginRight = "8px"
    avatar.loading = "lazy"
    avatar.classList.add("pp")

    const userInfo = document.createElement("div")
    userInfo.classList.add("user-info")
    
    const userName = document.createElement("div")
    userName.classList.add("user-name")
    userName.textContent = user.username
    
    userInfo.appendChild(userName)

    div.appendChild(avatar)
    div.appendChild(userInfo)

    div.onclick = () => {
      showChatPage(user)
      if (window.innerWidth <= 800) {
        closeSidebar('left')
      }
    }

    fragment.appendChild(div)
  })

  container.innerHTML = ""
  container.appendChild(fragment)
}

// WebRTC functions with better error handling
function createPeer() {
  const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
  }

  const peer = new RTCPeerConnection(config)

  peer.onicecandidate = (e) => {
    if (e.candidate && state.remoteId) {
      socket.emit("send-ice-candidate", {
        targetId: state.remoteId,
        candidate: e.candidate,
      })
    }
  }

  peer.ondatachannel = (e) => {
    state.dataChannel = e.channel
    setupChannel()
  }

  peer.onconnectionstatechange = () => {
    console.log("Connection state:", peer.connectionState)
    if (["disconnected", "failed", "closed"].includes(peer.connectionState)) {
      handlePeerDisconnect()
    }
  }

  peer.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peer.iceConnectionState)
    if (["disconnected", "failed", "closed"].includes(peer.iceConnectionState)) {
      handlePeerDisconnect()
    }
  }

  state.activePeerConnection = peer
  return peer
}

function setupChannel() {
  elements.sendBtn.disabled = false
  elements.fileBtn.disabled = false

  state.dataChannel.onopen = () => {
    updateStatus(CONNECTION_STATES.CONNECTED)
    // Save connection status to localStorage
    localStorage.setItem(STORAGE_KEYS.CONNECTION_STATUS, "true")
  }

  state.dataChannel.onclose = () => handlePeerDisconnect()
  state.dataChannel.onerror = (error) => {
    console.error("Data channel error:", error)
    handlePeerDisconnect()
  }
  state.dataChannel.onmessage = (e) => handleData(e.data)
}

function handlePeerDisconnect() {
  if (!state.connectionStatus) return

  console.log("Peer disconnected, cleaning up...")

  updateStatus(CONNECTION_STATES.DISCONNECTED)
  elements.status.style.backgroundColor = "#ef4444"

  showSystemMessage("Karşı taraf bağlantıyı kapattı veya bağlantı kaybedildi.")

  // Clean up resources
  state.dataChannel?.close()
  state.activePeerConnection?.close()

  // Reset state
  Object.assign(state, {
    dataChannel: null,
    activePeerConnection: null,
    connectionStatus: false,
    remoteId: null,
    receivedBuffers: [],
    incomingFileInfo: null,
  })

  // Clear connection state in localStorage
  localStorage.removeItem(STORAGE_KEYS.REMOTE_ID)
  localStorage.removeItem(STORAGE_KEYS.CONNECTION_STATUS)

  elements.sendBtn.disabled = true
  elements.fileBtn.disabled = true
  
  // Return to home page after a short delay
  setTimeout(() => {
    showHomePage()
  }, 2000)
}

function showSystemMessage(message) {
  const wrapper = document.createElement("div")
  wrapper.className = "message-wrapper system"

  const msgDiv = document.createElement("div")
  msgDiv.className = "msg system"
  msgDiv.textContent = message

  wrapper.appendChild(msgDiv)
  elements.chat.appendChild(wrapper)
  elements.chat.scrollTop = elements.chat.scrollHeight
}

// Socket event handlers
socket.on("your-id", ({ socketId, persistentUserId }) => {
  state.myId = socketId
  state.myPersistentId = persistentUserId

  // Save persistent user ID to localStorage
  localStorage.setItem(STORAGE_KEYS.PERSISTENT_USER_ID, persistentUserId)

  elements.myId.setAttribute("dataId", socketId)
  elements.myName.textContent = username
  elements.myPp.src = profilePic
  socket.emit("update-visibility", { hidden: state.hiddenFromSearch })

  console.log(`Connected with socket ID: ${socketId}, persistent ID: ${persistentUserId}`)
})

socket.on("nickname-restricted", (message) => {
  alert(message || "Kullanıcı adınız kısıtlanmış. Bağlantı sonlandırıldı.")
  localStorage.removeItem(STORAGE_KEYS.USERNAME)
  localStorage.removeItem(STORAGE_KEYS.PERSISTENT_USER_ID)
})

socket.on("online-users", (users) => {
  state.allUsers = users

  if (state.connectionStatus && state.remoteId) {
    const remoteUserStillOnline = users.some((user) => user.id === state.remoteId)
    if (!remoteUserStillOnline) {
      handlePeerDisconnect()
    }
  }

  filterUsers(elements.searchInput.value.toLowerCase().trim())
  renderHomePage()
})

socket.on("user-disconnected", (userId) => {
  if (state.connectionStatus && state.remoteId === userId) {
    handlePeerDisconnect()
  }
})

socket.on("stories-updated", (stories) => {
  state.currentStories = stories
  renderStories(stories)
  renderHomePage()
})

socket.on("incoming-call", async ({ from, offer }) => {
  // Find user info
  const caller = state.allUsers.find(user => user.id === from)
  
  if (!caller) {
    socket.emit("call-rejected", {
      targetId: from,
      reason: "User not found",
    })
    return
  }
  
  state.remoteId = from

  if (state.connectionStatus) {
    socket.emit("call-rejected", {
      targetId: state.remoteId,
      reason: "Busy",
    })
    return
  }

  // Ask user if they want to accept the call
  const confirmConnect = confirm(`${caller.username} sizinle bağlantı kurmak istiyor. Kabul ediyor musunuz?`)
  
  if (!confirmConnect) {
    socket.emit("call-rejected", {
      targetId: from,
      reason: "Rejected",
    })
    return
  }

  try {
    // Show chat page with caller info
    showChatPage(caller)
    
    state.peer = createPeer()
    updateStatus("Yanıtlanıyor...")
    elements.status.style.backgroundColor = "orange"

    await state.peer.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await state.peer.createAnswer()
    await state.peer.setLocalDescription(answer)

    socket.emit("send-answer", {
      targetId: state.remoteId,
      answer,
    })

    state.connectionStatus = true
    localStorage.setItem(STORAGE_KEYS.REMOTE_ID, from)
  } catch (error) {
    console.error("Error handling incoming call:", error)
    handlePeerDisconnect()
  }
})

socket.on("call-answered", async ({ answer }) => {
  try {
    await state.peer.setRemoteDescription(new RTCSessionDescription(answer))
    state.connectionStatus = true
  } catch (error) {
    console.error("Error handling call answer:", error)
    handlePeerDisconnect()
  }
})

socket.on("call-rejected", ({ reason }) => {
  updateStatus("Bağlantı reddedildi: " + reason)
  elements.status.style.backgroundColor = "#ef4444"
  showToast("Bağlanmaya çalıştığınız kişi meşgul veya bağlantıyı reddetti")
  localStorage.removeItem("p2p_remote_id")
  
  state.activePeerConnection?.close()
  state.activePeerConnection = null
  state.connectionStatus = false
  state.remoteId = null
  
  // Return to home page
  showHomePage()
})

socket.on("ice-candidate", async ({ candidate }) => {
  if (state.peer) {
    try {
      await state.peer.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error("Error adding ICE candidate:", error)
    }
  }
})

// Connection and messaging functions
async function startCall(id) {
  if (!id) {
    alert("Lütfen bir hedef ID girin")
    return
  }

  if (state.connectionStatus) {
    const confirmReconnect = confirm(
      "Zaten bir sohbete bağlısınız. Önceki sohbeti kapatıp yeni bir bağlantı kurmak istiyor musunuz?"
    )
    if (!confirmReconnect) return
    handlePeerDisconnect()
  }

  try {
    state.remoteId = id
    // Save remote ID to localStorage
    localStorage.setItem(STORAGE_KEYS.REMOTE_ID, id)

    state.peer = createPeer()
    state.dataChannel = state.peer.createDataChannel("chat")
    setupChannel()

    updateStatus(CONNECTION_STATES.CONNECTING)
    elements.status.style.backgroundColor = "orange"

    const offer = await state.peer.createOffer()
    await state.peer.setLocalDescription(offer)

    socket.emit("call-user", {
      targetId: state.remoteId,
      offer,
    })
  } catch (error) {
    console.error("Error creating offer:", error)
    handlePeerDisconnect()
  }
}

function sendMessage() {
  const text = elements.msgInput.value.trim()
  if (!text) return

  if (!state.dataChannel || state.dataChannel.readyState !== "open") {
    showSystemMessage("Mesaj gönderilemedi. Bağlantı kapalı.")
    return
  }

  try {
    state.dataChannel.send(
      JSON.stringify({
        type: "text",
        message: text,
      })
    )

    logMessage(text, "me")
    elements.msgInput.value = ""
  } catch (error) {
    console.error("Error sending message:", error)
    showSystemMessage("Mesaj gönderilemedi: " + error.message)
  }
}

function sendFile() {
  const file = elements.fileBtn.files[0]
  if (!file || !state.dataChannel || state.dataChannel.readyState !== "open") {
    if (file) showSystemMessage("Dosya gönderilemedi. Bağlantı kapalı.")
    return
  }

  const chunkSize = 16 * 1024
  let offset = 0

  try {
    state.dataChannel.send(
      JSON.stringify({
        type: "file-info",
        name: file.name,
        size: file.size,
        mime: file.type,
      })
    )

    previewFileLocally(file, "me")

    const reader = new FileReader()

    reader.onload = (event) => {
      if (state.dataChannel.readyState !== "open") {
        showSystemMessage("Veri kanalı kapalı.")
        return
      }

      const buffer = event.target.result
      state.dataChannel.send(buffer)
      offset += chunkSize

      if (offset < file.size) {
        readNextChunk()
      } else {
        state.dataChannel.send("EOF")
        console.log("Dosya transferi tamamlandı.")
      }
    }

    reader.onerror = (error) => {
      console.error("Dosya okunamadı:", error)
      showSystemMessage("Dosya okunamadı: " + error.message)
    }

    function readNextChunk() {
      const slice = file.slice(offset, offset + chunkSize)
      reader.readAsArrayBuffer(slice)
    }

    readNextChunk()
  } catch (error) {
    console.error("Dosya transferi başlatılamadı:", error)
    showSystemMessage("Dosya transferi başlatılamadı: " + error.message)
  }
}

function previewFileLocally(file, from) {
  const url = URL.createObjectURL(file)
  const wrapper = document.createElement("div")
  wrapper.className = `message-wrapper ${from === "me" ? "you" : "them"}`

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img")
    img.src = url
    img.style.maxWidth = "200px"
    img.style.borderRadius = "10px"
    img.loading = "lazy"
    wrapper.appendChild(img)
  } else if (file.type.startsWith("video/")) {
    const video = document.createElement("video")
    video.src = url
    video.controls = true
    video.style.maxWidth = "250px"
    video.style.borderRadius = "10px"
    wrapper.appendChild(video)
  } else if (file.type.startsWith("audio/")) {
    const audio = document.createElement("audio")
    audio.src = url
    audio.controls = true
    wrapper.appendChild(audio)
  } else {
    const link = document.createElement("a")
    link.href = url
    link.download = file.name
    link.textContent = `📄 ${file.name}`
    link.style.cssText =
      "background: #e5e7eb; padding: 1rem; border-radius: 10px; text-decoration: none; color: #1d4ed8;"
    wrapper.appendChild(link)
  }

  elements.chat.appendChild(wrapper)
  elements.chat.scrollTop = elements.chat.scrollHeight
}

function playNotificationSound() {
  elements.notificationSound?.play().catch((e) => console.log("Audio play error:", e))
}

function handleData(data) {
  if (typeof data === "string") {
    try {
      const msg = JSON.parse(data)
      if (msg.type === "text") {
        logMessage(msg.message, "them")
        playNotificationSound()
      } else if (msg.type === "file-info") {
        state.incomingFileInfo = msg
        state.receivedBuffers = []
      } else if (msg.type === "system") {
        showSystemMessage(msg.message)
      }
    } catch {
      if (data === "EOF" && state.incomingFileInfo) {
        const blob = new Blob(state.receivedBuffers, { type: state.incomingFileInfo.mime })
        const url = URL.createObjectURL(blob)
        const wrapper = document.createElement("div")
        wrapper.className = "message-wrapper them"

        if (state.incomingFileInfo.mime.startsWith("image/")) {
          const img = document.createElement("img")
          img.src = url
          img.style.cssText = "max-width: 200px; margin-top: 10px; border-radius: 10px;"
          img.loading = "lazy"
          wrapper.appendChild(img)
        } else if (state.incomingFileInfo.mime.startsWith("audio/")) {
          const audio = document.createElement("audio")
          audio.controls = true
          audio.src = url
          audio.style.marginTop = "10px"
          wrapper.appendChild(audio)
        } else if (state.incomingFileInfo.mime.startsWith("video/")) {
          const video = document.createElement("video")
          video.controls = true
          video.src = url
          video.style.cssText = "max-width: 200px; margin-top: 10px; border-radius: 10px;"
          wrapper.appendChild(video)
        } else {
          const link = document.createElement("a")
          link.href = url
          link.download = state.incomingFileInfo.name
          link.textContent = `📄 ${state.incomingFileInfo.name}`
          link.style.cssText =
            "background: #e5e7eb; padding: 1rem; border-radius: 10px; text-decoration: none; color: #1d4ed8;"
          wrapper.appendChild(link)
        }

        elements.chat.appendChild(wrapper)
        elements.chat.scrollTop = elements.chat.scrollHeight
        state.incomingFileInfo = null
        state.receivedBuffers = []
        playNotificationSound()
      }
    }
  } else {
    state.receivedBuffers.push(data)
  }
}

function logMessage(text, from) {
  const wrapper = document.createElement("div")
  wrapper.className = `message-wrapper ${from === "me" ? "you" : "them"}`

  const msgDiv = document.createElement("div")
  msgDiv.className = `msg ${from === "me" ? "you" : "them"}`

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const processedText = text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">${url}</a>`
  })

  msgDiv.innerHTML = processedText
  wrapper.appendChild(msgDiv)
  elements.chat.appendChild(wrapper)
  elements.chat.scrollTop = elements.chat.scrollHeight
}

function updateStatus(text) {
  if (text === CONNECTION_STATES.CONNECTED) {
    elements.status.style.backgroundColor = "#1b7959"
    state.dataChannel?.send(
      JSON.stringify({
        type: "system",
        message: "Bağlantı Kuruldu.",
      })
    )
  } else if (text === CONNECTION_STATES.DISCONNECTED) {
    elements.status.style.backgroundColor = "#ef4444"
  }
}

// Event listeners for modal and keyboard navigation
document.addEventListener("click", (e) => {
  if (e.target === elements.storyModal) {
    closeStoryModal()
  }
})

document.addEventListener("keydown", (e) => {
  const modal = elements.storyModal
  if (modal?.style.display === "flex") {
    if (e.key === "Escape") {
      closeStoryModal()
    } else if (e.key === "ArrowRight") {
      state.currentStoryIndex++
      showStory(state.currentStoryIndex)
    } else if (e.key === "ArrowLeft" && state.currentStoryIndex > 0) {
      state.currentStoryIndex--
      showStory(state.currentStoryIndex)
    }
  }
})

// Page lifecycle handlers
window.addEventListener("beforeunload", () => {
  if (state.connectionStatus && state.remoteId) {
    try {
      if (state.dataChannel?.readyState === "open") {
        // Send disconnect notification if possible
      }
    } catch (e) {
      console.error("Error sending disconnect message:", e)
    }
  }
})

// Keep connection alive with throttled ping
const sendPing = throttle(() => {
  if (state.connectionStatus && state.dataChannel?.readyState === "open") {
    try {
      state.dataChannel.send(JSON.stringify({ type: "ping" }))
    } catch (e) {
      console.error("Error sending ping:", e)
      handlePeerDisconnect()
    }
  }
}, 30000)

setInterval(sendPing, 30000)

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initStoryFunctionality()
  initProfilePictureUpload()
  initUIEventListeners()

  // Set initial visibility state
  if (state.hiddenFromSearch && elements.hideFromSearchBtn) {
    elements.hideFromSearchBtn.classList.add("hidden-from-search")
    elements.hideFromSearchBtn.querySelector("span").textContent = "Aramada Göster"
  }
  
  // Show homepage by default
  showHomePage()

  // Attempt to reconnect if we have a saved connection
  if (state.connectionStatus && state.remoteId) {
    // Update UI to show we're trying to reconnect
    updateStatus(CONNECTION_STATES.CONNECTING)
    elements.status.style.backgroundColor = "orange"
    showSystemMessage("Önceki oturuma yeniden bağlanmaya çalışılıyor...")

    // We'll attempt to reconnect once we have our socket ID
    socket.on("your-id", () => {
      if (state.remoteId) {
        setTimeout(() => {
          startCall(state.remoteId)
        }, 1000)
      }
    })
  }
})

// Global functions for HTML onclick handlers
window.sendMessage = sendMessage
window.sendFile = sendFile
window.closeStoryModal = closeStoryModal
window.openSidebar = openSidebar
window.closeSidebar = closeSidebar
window.showHomePage = showHomePage
window.leaveChat = leaveChat