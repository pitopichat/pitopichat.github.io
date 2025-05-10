const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const users = {};

io.on("connection", (socket) => {
    const ip = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
    const userAgent = socket.handshake.headers["user-agent"];
    const acceptLanguage = socket.handshake.headers["accept-language"];
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${socket.id} bağlandı (${ip}, ${userAgent}, ${acceptLanguage})`);

    // Kullanıcı bilgilerini sade olarak kaydet
    users[socket.id] = {
        id: socket.id,
        ip,
        userAgent,
        language: acceptLanguage,
    };

    // Bağlanan kullanıcıya kendi ID'sini gönder
    socket.emit("your-id", socket.id);

    // Tüm istemcilere güncel kullanıcı listesi gönder
    io.emit("online-users", Object.values(users));

    // Arama isteği
    socket.on("call-user", ({ targetId, offer }) => {
        io.to(targetId).emit("incoming-call", { from: socket.id, offer });
    });

    socket.on("call-rejected", ({ targetId, reason }) => {
        io.to(targetId).emit("call-rejected", { reason });
    });

    // Arama cevabı
    socket.on("send-answer", ({ targetId, answer }) => {
        io.to(targetId).emit("call-answered", { answer });
    });

    // ICE adayı gönderme
    socket.on("send-ice-candidate", ({ targetId, candidate }) => {
        io.to(targetId).emit("ice-candidate", { candidate });
    });

    // Bağlantı kesildiğinde kullanıcıyı listeden çıkar
    socket.on("disconnect", () => {
        delete users[socket.id];
        console.log(`[${new Date().toISOString()}] Bağlantı kesildi: ${socket.id}`);
        io.emit("online-users", Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});