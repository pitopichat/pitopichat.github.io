// Check if user is logged in
const savedUsername = localStorage.getItem("p2p_username")
if (!savedUsername) {
  window.location.href = "index.html"
}

// Initialize with saved username
const username = savedUsername
const profilePic = `https://avatar.iran.liara.run/username?username=${encodeURIComponent(username)}`

// Initialize socket connection with authentication
const socket = io("https://p2p-server.glitch.me/", {
  auth: {
    username,
    profilePic,
  },
})

// Global variables
let peer
let dataChannel
let receivedBuffers = []
let incomingFileInfo = null
let connectionStatus = false
let remoteId
let myId
let allUsers = [] // Store all users for search functionality
let activePeerConnection = null // Track the active peer connection
let hiddenFromSearch = false // Track if user is hidden from search

// DOM elements
const myIdEl = document.getElementById("my-id")
const myNameEl = document.getElementById("my-name")
const myPpEl = document.getElementById("my-pp")
const statusEl = document.getElementById("status")
const sendBtn = document.getElementById("send-btn")
const fileBtn = document.getElementById("fileInput")
const chatBox = document.getElementById("chat")
const msgInput = document.getElementById("msg")
const messageList = document.getElementById("chat")
const emptyState = document.getElementById("empty-state")
const searchInput = document.getElementById("searchId")
const logoutBtn = document.getElementById("logout-btn")
const hideFromSearchBtn = document.getElementById("hide-from-search")

// Check if user was previously hidden from search
hiddenFromSearch = localStorage.getItem("p2p_hidden") === "true"
if (hiddenFromSearch && hideFromSearchBtn) {
  hideFromSearchBtn.classList.add("hidden-from-search")
  hideFromSearchBtn.querySelector("span").textContent = "Aramada Gözük"
}

// Event listeners
msgInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    event.preventDefault()
    sendMessage()
  }
})

// Search functionality
searchInput.addEventListener("input", () => {
  const searchTerm = searchInput.value.toLowerCase().trim()
  filterUsers(searchTerm)
})

// Logout functionality
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("p2p_username")
    window.location.href = "index.html"
  })
}

// Hide from search functionality
if (hideFromSearchBtn) {
  hideFromSearchBtn.addEventListener("click", () => {
    hiddenFromSearch = !hiddenFromSearch
    localStorage.setItem("p2p_hidden", hiddenFromSearch)

    if (hiddenFromSearch) {
      hideFromSearchBtn.classList.add("hidden-from-search")
      hideFromSearchBtn.querySelector("span").textContent = "Aramada Gözük"
      showToast("Artık aramada gözükmüyorsunuz")
    } else {
      hideFromSearchBtn.classList.remove("hidden-from-search")
      hideFromSearchBtn.querySelector("span").textContent = "Aramada Gözükme"
      showToast("Artık aramada gözüküyorsunuz")
    }

    // Update server about visibility status
    socket.emit("update-visibility", { hidden: hiddenFromSearch })
  })
}

// Copy ID functionality
if (myIdEl) {
  myIdEl.addEventListener("click", () => {
    const idText = myIdEl.getAttribute("dataId") || myId

    // Fallback copy method for browsers that don't support clipboard API
    function fallbackCopyTextToClipboard(text) {
      const textArea = document.createElement("textarea")
      textArea.value = text

      // Make the textarea out of viewport
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      let successful = false
      try {
        successful = document.execCommand("copy")
      } catch (err) {
        console.error("Fallback: Copy to clipboard failed", err)
      }

      document.body.removeChild(textArea)
      return successful
    }

    // Try to use the modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(idText)
        .then(() => {
          myIdEl.classList.add("copied")
          showToast("ID kopyalandı")

          setTimeout(() => {
            myIdEl.classList.remove("copied")
          }, 2000)
        })
        .catch((err) => {
          console.error("Clipboard API failed:", err)
          // Try fallback method
          if (fallbackCopyTextToClipboard(idText)) {
            myIdEl.classList.add("copied")
            showToast("ID kopyalandı")

            setTimeout(() => {
              myIdEl.classList.remove("copied")
            }, 2000)
          } else {
            showToast("ID kopyalanamadı. Lütfen manuel olarak kopyalayın.")
          }
        })
    } else {
      if (fallbackCopyTextToClipboard(idText)) {
        myIdEl.classList.add("copied")
        showToast("ID kopyalandı")

        setTimeout(() => {
          myIdEl.classList.remove("copied")
        }, 2000)
      } else {
        showToast("ID kopyalanamadı. Lütfen manuel olarak kopyalayın.")
      }
    }
  })
}

// Show toast notification
function showToast(message) {
  // Remove existing toast if any
  const existingToast = document.querySelector(".toast")
  if (existingToast) {
    document.body.removeChild(existingToast)
  }

  // Create new toast
  const toast = document.createElement("div")
  toast.className = "toast"
  toast.textContent = message
  document.body.appendChild(toast)

  // Show toast
  setTimeout(() => {
    toast.classList.add("show")
  }, 10)

  // Hide toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast)
      }
    }, 300)
  }, 3000)
}

// Filter users based on search term
function filterUsers(searchTerm) {
  const container = document.getElementById("onlineUser")
  container.innerHTML = ""

  const filteredUsers = allUsers.filter(
    (user) =>
      user.id !== myId &&
      !user.hidden &&
      (user.username.toLowerCase().includes(searchTerm) || user.id.toLowerCase().includes(searchTerm)),
  )

  renderUsers(filteredUsers)
}

// Render users in the sidebar
function renderUsers(users) {
  const container = document.getElementById("onlineUser")

  users.forEach((user) => {
    const div = document.createElement("div")
    div.classList.add("user")

    const avatar = document.createElement("img")
    avatar.src = user.profilePic || "default.png"
    avatar.width = 32
    avatar.height = 32
    avatar.style.borderRadius = "50%"
    avatar.style.marginRight = "8px"

    const label = document.createElement("span")
    label.textContent = user.username

    div.appendChild(avatar)
    div.appendChild(label)

    div.onclick = () => {
      startCall(user.id)
      if (window.innerWidth <= 768) {
        document.querySelector("sidebar[left].open").style.display = "none"
      }
    }

    container.appendChild(div)
  })
}

// WebRTC functions
function createPeer() {
  const p = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  })

  p.onicecandidate = (e) => {
    if (e.candidate && remoteId) {
      socket.emit("send-ice-candidate", {
        targetId: remoteId,
        candidate: e.candidate,
      })
    }
  }

  p.ondatachannel = (e) => {
    dataChannel = e.channel
    setupChannel()
  }

  // Add connection state change handler
  p.onconnectionstatechange = () => {
    console.log("Connection state:", p.connectionState)
    if (p.connectionState === "disconnected" || p.connectionState === "failed" || p.connectionState === "closed") {
      handlePeerDisconnect()
    }
  }

  // Add ICE connection state change handler
  p.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", p.iceConnectionState)
    if (
      p.iceConnectionState === "disconnected" ||
      p.iceConnectionState === "failed" ||
      p.iceConnectionState === "closed"
    ) {
      handlePeerDisconnect()
    }
  }

  activePeerConnection = p
  return p
}

function setupChannel() {
  sendBtn.disabled = false
  fileBtn.disabled = false

  dataChannel.onopen = () => updateStatus("Bağlantı kurdun")

  dataChannel.onclose = () => {
    console.log("Data channel closed")
    handlePeerDisconnect()
  }

  dataChannel.onerror = (error) => {
    console.error("Data channel error:", error)
    handlePeerDisconnect()
  }

  dataChannel.onmessage = (e) => handleData(e.data)
}

// Handle peer disconnection
function handlePeerDisconnect() {
  if (!connectionStatus) return // Already disconnected

  console.log("Peer disconnected, cleaning up...")

  // Update UI
  updateStatus("Bağlantı kesildi")
  statusEl.style.backgroundColor = "#ef4444"

  // Show system message
  const systemMessage = "Karşı taraf bağlantıyı kapattı veya bağlantı kesildi."
  showSystemMessage(systemMessage)

  // Clean up resources
  if (dataChannel) {
    dataChannel.close()
    dataChannel = null
  }

  if (activePeerConnection) {
    activePeerConnection.close()
    activePeerConnection = null
  }

  // Reset state
  connectionStatus = false
  remoteId = null
  receivedBuffers = []
  incomingFileInfo = null

  // Disable UI elements
  sendBtn.disabled = true
  fileBtn.disabled = true
}

// Show system message in chat
function showSystemMessage(message) {
  const wrapper = document.createElement("div")
  wrapper.className = "message-wrapper system"

  const msgDiv = document.createElement("div")
  msgDiv.className = "msg system"
  msgDiv.textContent = message

  wrapper.appendChild(msgDiv)
  chatBox.appendChild(wrapper)
  chatBox.scrollTop = chatBox.scrollHeight
  showChat()
}

// Socket event handlers
socket.on("your-id", (id) => {
  myId = id

  // Display ID in the profile
  const idValueEl = document.getElementById("id-value")
  if (idValueEl) {
    idValueEl.textContent = id
  }

  myIdEl.setAttribute("dataId", id)
  myNameEl.textContent = username
  myPpEl.src = profilePic

  // Send visibility status to server
  socket.emit("update-visibility", { hidden: hiddenFromSearch })
})

socket.on("online-users", (users) => {
  allUsers = users // Store all users

  // Check if the remote user we're connected to has gone offline
  if (connectionStatus && remoteId) {
    const remoteUserStillOnline = users.some((user) => user.id === remoteId)
    if (!remoteUserStillOnline) {
      handlePeerDisconnect()
    }
  }

  filterUsers(searchInput.value.toLowerCase().trim()) // Apply current search filter
})

socket.on("user-disconnected", (userId) => {
  // If we're connected to this user, handle the disconnection
  if (connectionStatus && remoteId === userId) {
    handlePeerDisconnect()
  }
})

socket.on("incoming-call", async ({ from, offer }) => {
  remoteId = from

  if (connectionStatus === true) {
    socket.emit("call-rejected", {
      targetId: remoteId,
      reason: "Meşgul",
    })
    return
  }

  peer = createPeer()
  updateStatus("Yanıt veriyorsun...")
  statusEl.style.backgroundColor = "orange"

  await peer.setRemoteDescription(new RTCSessionDescription(offer))
  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer)

  socket.emit("send-answer", {
    targetId: remoteId,
    answer,
  })

  connectionStatus = true
})

socket.on("call-answered", async ({ answer }) => {
  await peer.setRemoteDescription(new RTCSessionDescription(answer))
  connectionStatus = true
})

socket.on("call-rejected", async ({ reason }) => {
  updateStatus("Bağlantı reddedildi: " + reason)
  statusEl.style.backgroundColor = "#ef4444"

  // Clean up the peer connection since the call was rejected
  if (activePeerConnection) {
    activePeerConnection.close()
    activePeerConnection = null
  }

  connectionStatus = false
  remoteId = null
})

socket.on("ice-candidate", async ({ candidate }) => {
  if (peer) {
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error("Error adding ICE candidate:", error)
    }
  }
})

// Connection and messaging functions
function startCall(id) {
  if (!id) {
    alert("Lütfen bir hedef ID girin")
    return
  }

  if (connectionStatus) {
    const confirmReconnect = confirm(
      "Zaten bir sohbete bağlısın. Önceki sohbeti kapatıp yeni bir bağlantı kurmak istiyor musun?",
    )
    if (!confirmReconnect) return

    // Clean up existing connection
    handlePeerDisconnect()
  }

  remoteId = id
  peer = createPeer()
  dataChannel = peer.createDataChannel("chat")
  setupChannel()

  updateStatus("Bağlanıyorsun...")
  statusEl.style.backgroundColor = "orange"

  peer
    .createOffer()
    .then((offer) => {
      peer.setLocalDescription(offer)
      socket.emit("call-user", {
        targetId: remoteId,
        offer,
      })
    })
    .catch((error) => {
      console.error("Error creating offer:", error)
      handlePeerDisconnect()
    })
}

function sendMessage() {
  const text = msgInput.value.trim()
  if (!text) return

  if (!dataChannel || dataChannel.readyState !== "open") {
    showSystemMessage("Mesaj gönderilemedi. Bağlantı kapalı.")
    return
  }

  try {
    dataChannel.send(
      JSON.stringify({
        type: "text",
        message: text,
      }),
    )

    logMessage(text, "me")
    msgInput.value = ""
    showChat()
  } catch (error) {
    console.error("Error sending message:", error)
    showSystemMessage("Mesaj gönderilemedi: " + error.message)
  }
}

function sendFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file || !dataChannel || dataChannel.readyState !== "open") {
    if (file) showSystemMessage("Dosya gönderilemedi. Bağlantı kapalı.");
    return;
  }

  const chunkSize = 16 * 1024;
  let offset = 0;

  try {
    // Dosya bilgilerini gönder
    dataChannel.send(JSON.stringify({
      type: "file-info",
      name: file.name,
      size: file.size,
      mime: file.type
    }));

    previewFileLocally(file, "me");

    const reader = new FileReader();

    reader.onload = (event) => {
      if (dataChannel.readyState !== "open") {
        showSystemMessage("Veri kanalı kapandı.");
        return;
      }

      const buffer = event.target.result;
      dataChannel.send(buffer);
      offset += chunkSize;

      if (offset < file.size) {
        readNextChunk(); // sıradaki parçayı oku
      } else {
        dataChannel.send("EOF");
        console.log("Dosya gönderimi tamamlandı.");
      }
    };

    reader.onerror = (error) => {
      console.error("Dosya okunamadı:", error);
      showSystemMessage("Dosya okunamadı: " + error.message);
    };

    function readNextChunk() {
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    }

    readNextChunk(); // ilk parçayı başlat

    showChat();

  } catch (error) {
    console.error("Dosya gönderimi başlatılamadı:", error);
    showSystemMessage("Dosya gönderimi başlatılamadı: " + error.message);
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
    link.style.background = "#e5e7eb"
    link.style.padding = "1rem"
    link.style.borderRadius = "10px"
    link.style.textDecoration = "none"
    link.style.color = "#1d4ed8"
    wrapper.appendChild(link)
  }

  chatBox.appendChild(wrapper)
  chatBox.scrollTop = chatBox.scrollHeight
}

function handleData(data) {
  if (typeof data === "string") {
    try {
      const msg = JSON.parse(data)
      if (msg.type === "text") {
        logMessage(msg.message, "them")
      } else if (msg.type === "file-info") {
        incomingFileInfo = msg
        receivedBuffers = []
      } else if (msg.type === "system") {
        showSystemMessage(msg.message)
      } else if (msg.type === "ping") {
      }
    } catch {
      if (data === "EOF" && incomingFileInfo) {
        const blob = new Blob(receivedBuffers, { type: incomingFileInfo.mime })
        const url = URL.createObjectURL(blob)
        const wrapper = document.createElement("div")
        wrapper.className = `message-wrapper them`

        if (incomingFileInfo.mime.startsWith("image/")) {
          const img = document.createElement("img")
          img.src = url
          img.style.maxWidth = "200px"
          img.style.marginTop = "10px"
          img.style.borderRadius = "10px"
          wrapper.appendChild(img)
        } else if (incomingFileInfo.mime.startsWith("audio/")) {
          const audio = document.createElement("audio")
          audio.controls = true
          audio.src = url
          audio.style.marginTop = "10px"
          wrapper.appendChild(audio)
        } else if (incomingFileInfo.mime.startsWith("video/")) {
          const video = document.createElement("video")
          video.controls = true
          video.src = url
          video.style.maxWidth = "200px"
          video.style.marginTop = "10px"
          video.style.borderRadius = "10px"
          wrapper.appendChild(video)
        } else {
          const link = document.createElement("a")
          link.href = url
          link.download = incomingFileInfo.name
          link.textContent = `📄 ${incomingFileInfo.name}`
          link.style.background = "#e5e7eb"
          link.style.padding = "1rem"
          link.style.borderRadius = "10px"
          link.style.textDecoration = "none"
          link.style.color = "#1d4ed8"
          wrapper.appendChild(link)
        }

        chatBox.appendChild(wrapper)
        chatBox.scrollTop = chatBox.scrollHeight
        incomingFileInfo = null
        receivedBuffers = []
        showChat()
      }
    }
  } else {
    receivedBuffers.push(data)
  }
}

function logMessage(text, from) {
  const wrapper = document.createElement("div")
  wrapper.className = `message-wrapper ${from === "me" ? "you" : "them"}`

  const msgDiv = document.createElement("div")
  msgDiv.className = `msg ${from === "me" ? "you" : "them"}`

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const processedText = text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="text-decoration: underline;">${url}</a>`
  })

  msgDiv.innerHTML = processedText
  wrapper.appendChild(msgDiv)
  chatBox.appendChild(wrapper)
  chatBox.scrollTop = chatBox.scrollHeight
  showChat()
}

function showChat() {
  if (emptyState.style.display !== "none") {
    emptyState.style.display = "none"
    messageList.style.display = "flex"
  }
}

function updateStatus(text) {
  if (text == "Bağlantı kurdun") {
    statusEl.style.backgroundColor = "lightgreen"
    dataChannel.send(
          JSON.stringify({
            type: "system",
            message: "Bağlantı Kurdun.",
          }),
        )
  } else if (text == "Bağlantı kesildi") {
    statusEl.style.backgroundColor = "#ef4444"
  }
}

// Handle page unload to notify peers
window.addEventListener("beforeunload", () => {
  if (connectionStatus && remoteId) {
    // Try to send a disconnect message
    try {
      if (dataChannel && dataChannel.readyState === "open") {
      }
    } catch (e) {
      console.error("Error sending disconnect message:", e)
    }
  }
})

// Ping to keep connection alive
setInterval(() => {
  if (connectionStatus && dataChannel && dataChannel.readyState === "open") {
    try {
      dataChannel.send(
        JSON.stringify({
          type: "ping",
        }),
      )
    } catch (e) {
      console.error("Error sending ping:", e)
      handlePeerDisconnect()
    }
  }
}, 30000) // Every 30 seconds
