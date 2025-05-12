const username = prompt("Kullanıcı adınızı girin:");
const profilePic = `https://avatar.iran.liara.run/username?username=${encodeURIComponent(username)}`;
const socket = io("https://p2p-server.glitch.me/", {
    auth: {
        username,
        profilePic
    }
});

let peer;
let dataChannel;
let receivedBuffers = [];
let incomingFileInfo = null;
let connectionStatus = false;

const myIdEl = document.getElementById("my-id");
const myPpEl = document.getElementById("my-pp");
const statusEl = document.getElementById("status");
const callBtn = document.getElementById("call-btn");
const sendBtn = document.getElementById("send-btn");
const fileBtn = document.getElementById("fileInput");
const chatBox = document.getElementById("chat");
const msgInput = document.getElementById("msg");
const messageList = document.getElementById("chat");
const emptyState = document.getElementById("empty-state");

if (!username || username.trim().length < 2) {
    alert("Geçerli bir kullanıcı adı girmelisin.");
    location.reload();
}


msgInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        event.preventDefault(); // Enter tuşunun yeni satır oluşturmasını engelle
        sendMessage();
    }
});

function createPeer() {
    const p = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    p.onicecandidate = (e) => {
        if (e.candidate && remoteId) {
            socket.emit("send-ice-candidate", { targetId: remoteId, candidate: e.candidate });
        }
    };
    p.ondatachannel = (e) => {
        dataChannel = e.channel;
        setupChannel();
    };
    return p;
}

function setupChannel() {
    sendBtn.disabled = false;
    fileBtn.disabled = false;
    dataChannel.onopen = () => updateStatus("Bağlantı kurdun");
    dataChannel.onclose = () => updateStatus("Bağlantı kesildi");
    dataChannel.onmessage = (e) => handleData(e.data);
}

socket.on("your-id", (id) => {
    myIdEl.textContent = username;
    myPpEl.src = profilePic;
    myId = id;
});

socket.on("online-users", (users) => {
    const container = document.getElementById("onlineUser");
    container.innerHTML = "";

    users.forEach((user) => {
        if (user.id === myId) return;

        const div = document.createElement("div");
        div.classList.add("user");

        const avatar = document.createElement("img");
        avatar.src = user.profilePic || "default.png";
        avatar.width = 32;
        avatar.height = 32;
        avatar.style.borderRadius = "50%";
        avatar.style.marginRight = "8px";

        const label = document.createElement("span");
        label.textContent = user.username;

        div.appendChild(avatar);
        div.appendChild(label);

        div.onclick = () => {
            startCall(user.id);
            if (window.innerWidth <= 768) {
                document.querySelector("sidebar.open").style.display = "none";
            }
        };
        container.appendChild(div);
    });
});


socket.on("incoming-call", async ({ from, offer }) => {
    remoteId = from;

    if (connectionStatus === true) {
        socket.emit("call-rejected", { targetId: remoteId, reason: "Meşgul" });
        return;
    }

    peer = createPeer();
    updateStatus("Yanıt veriyorsun...");
    statusEl.style.backgroundColor = "orange";
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("send-answer", { targetId: remoteId, answer });
    connectionStatus = true;
});

socket.on("call-answered", async ({ answer }) => {
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    connectionStatus = true;
});

socket.on("call-rejected", async ({ reason }) => {
    updateStatus("Bağlantı reddedildi: " + reason);
    statusEl.style.backgroundColor = "red";
});

socket.on("ice-candidate", async ({ candidate }) => {
    if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

function startCall(id) {
    const target = id;
    if (!target) {
        alert("Lütfen bir hedef ID girin");
        return;
    }
    if (connectionStatus) {
        alert("Zaten bir sohbete bağlısın. Önceki sohbeti kaybeedeceksin.");
        return;
    }
    remoteId = target;
    peer = createPeer();
    dataChannel = peer.createDataChannel("chat");
    setupChannel();
    updateStatus("Bağlanıyorsun...");
    statusEl.style.backgroundColor = "orange";
    peer.createOffer().then((offer) => {
        peer.setLocalDescription(offer);
        socket.emit("call-user", { targetId: remoteId, offer });
        updateStatus("Bağlanıyorsun...");
        statusEl.style.backgroundColor = "orange";
    });
}

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;
    dataChannel.send(JSON.stringify({ type: "text", message: text }));
    logMessage(text, "me");
    msgInput.value = "";
    if (emptyState.style.display !== "none") {
        emptyState.style.display = "none";
        messageList.style.display = "flex";
    }
}

function sendFile() {
    const file = document.getElementById("fileInput").files[0];
    if (!file || !dataChannel || dataChannel.readyState !== "open") return;

    const chunkSize = 16 * 1024;
    let offset = 0;
    const reader = new FileReader();

    // 1. Dosya bilgisi gönder
    dataChannel.send(
        JSON.stringify({
            type: "file-info",
            name: file.name,
            size: file.size,
            mime: file.type,
        })
    );

    // 2. Gönderene uygun şekilde gösterim ekle
    previewFileLocally(file, "me");

    reader.onload = () => {
        const buffer = reader.result;
        while (offset < buffer.byteLength) {
            const chunk = buffer.slice(offset, offset + chunkSize);
            dataChannel.send(chunk);
            offset += chunkSize;
        }
        dataChannel.send("EOF");
    };

    reader.readAsArrayBuffer(file);
    if (emptyState.style.display !== "none") {
        emptyState.style.display = "none";
        messageList.style.display = "flex";
    }
}

function previewFileLocally(file, from) {
    const url = URL.createObjectURL(file);
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${from === "me" ? "you" : "them"}`;
    const container = document.createElement("div");
    container.className = `msg ${from === "me" ? "you" : "them"}`;

    if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "200px";
        img.style.borderRadius = "10px";
        wrapper.appendChild(img);
    } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.style.maxWidth = "250px";
        img.style.borderRadius = "10px";
        wrapper.appendChild(video);
    } else if (file.type.startsWith("audio/")) {
        const audio = document.createElement("audio");
        audio.src = url;
        audio.controls = true;
        wrapper.appendChild(audio);
    } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.textContent = `📄 ${file.name}`;
        link.style.background = "#e5e7eb";
        link.style.padding = "1rem";
        link.style.borderRadius = "10px";
        link.style.textDecoration = "none";
        link.style.color = "#1d4ed8";
        wrapper.appendChild(link);
    }

    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleData(data) {
    if (typeof data === "string") {
        try {
            const msg = JSON.parse(data);
            if (msg.type === "text") logMessage(msg.message, "them");
            else if (msg.type === "file-info") {
                incomingFileInfo = msg;
                receivedBuffers = [];
            }
        } catch {
            if (data === "EOF" && incomingFileInfo) {
                const blob = new Blob(receivedBuffers, { type: incomingFileInfo.mime });
                const url = URL.createObjectURL(blob);
                const wrapper = document.createElement("div");
                wrapper.className = `message-wrapper them`;

                if (incomingFileInfo.mime.startsWith("image/")) {
                    const img = document.createElement("img");
                    img.src = url;
                    img.style.maxWidth = "200px";
                    img.style.marginTop = "10px";
                    img.style.borderRadius = "10px";
                    wrapper.appendChild(img);
                } else if (incomingFileInfo.mime.startsWith("audio/")) {
                    const audio = document.createElement("audio");
                    audio.controls = true;
                    audio.src = url;
                    audio.style.marginTop = "10px";
                    wrapper.appendChild(audio);
                } else if (incomingFileInfo.mime.startsWith("video/")) {
                    const video = document.createElement("video");
                    video.controls = true;
                    video.src = url;
                    video.style.maxWidth = "200px";
                    video.style.marginTop = "10px";
                    video.style.borderRadius = "10px";
                    wrapper.appendChild(video);
                } else {
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = incomingFileInfo.name;
                    link.textContent = `📄 ${incomingFileInfo.name}`;
                    link.style.background = "#e5e7eb";
                    link.style.padding = "1rem";
                    link.style.borderRadius = "10px";
                    link.style.textDecoration = "none";
                    link.style.color = "#1d4ed8";
                    wrapper.appendChild(link);
                }

                chatBox.appendChild(wrapper);
                chatBox.scrollTop = chatBox.scrollHeight;
                incomingFileInfo = null;
                receivedBuffers = [];
                if (emptyState.style.display !== "none") {
                    emptyState.style.display = "none";
                    messageList.style.display = "flex";
                }
            }
        }
    } else {
        receivedBuffers.push(data);
    }
}

function logMessage(text, from) {
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${from === "me" ? "you" : "them"}`;

    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${from === "me" ? "you" : "them"}`;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const processedText = text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" style="text-decoration: underline;">${url}</a>`;
    });

    msgDiv.innerHTML = processedText;
    wrapper.appendChild(msgDiv);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
    if (emptyState.style.display !== "none") {
        emptyState.style.display = "none";
        messageList.style.display = "flex";
    }
}

function updateStatus(text) {
    //statusEl.textContent = text;
    if (text == "Bağlantı kurdun") {
        statusEl.style.backgroundColor = "lightgreen";
    } else if (text == "Bağlantı kesildi") {
        window.location.reload();
    }
}
