// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log(`⚡ New Connection: ${socket.id}`);

    // User jab room join karega
    socket.on('join_room', (data) => {
        const { username, room } = data;
        socket.join(room);
        console.log(`👤 ${username} joined room: ${room}`);

        // Room ke baaki logo ko notify karein (System Message)
        // Note: System messages encrypted nahi hote kyunki ye server generate karta hai
        socket.to(room).emit('system_message', {
            text: `${username} has joined the chat room.`
        });
    });

    // Encrypted Message ya File receive aur forward karna
    socket.on('send_secure_payload', (payload) => {
        const { room, sender, data, type, fileName } = payload;
        
        // Sirf us specific room ke baaki members ko data bhejein
        socket.to(room).emit('receive_secure_payload', {
            sender,
            data,      // Yeh encrypted string (ciphertext) hai
            type,      // 'text' ya 'file'
            fileName: fileName || null
        });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Secure E2EE Chat Server running on port ${PORT}`);
});
