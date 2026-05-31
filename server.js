// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Online users ko track karne ke liye
let onlineUsers = {}; 

io.on('connection', (socket) => {
    console.log(`⚡ New Device Connected: ${socket.id}`);

    // 1. User apne device ka naam batata hai
    socket.on('register_device', (deviceName) => {
        onlineUsers[socket.id] = { id: socket.id, name: deviceName };
        // Sabko updated list bhejo
        io.emit('update_user_list', Object.values(onlineUsers));
    });

    // 2. Connection Request bhejna (User A -> User B)
    socket.on('send_request', (data) => {
        const { targetId, senderName } = data;
        io.to(targetId).emit('incoming_request', { senderId: socket.id, senderName });
    });

    // 3. Request Accept/Deny karna (User B -> User A)
    socket.on('request_response', (data) => {
        const { senderId, status, responderName } = data; // status: 'accepted' or 'denied'
        io.to(senderId).emit('request_status', { responderId: socket.id, responderName, status });
    });

    // === WEBRTC SIGNALING (For building the P2P tunnel) ===
    socket.on('webrtc_offer', (data) => io.to(data.target).emit('webrtc_offer', data));
    socket.on('webrtc_answer', (data) => io.to(data.target).emit('webrtc_answer', data));
    socket.on('webrtc_ice_candidate', (data) => io.to(data.target).emit('webrtc_ice_candidate', data));

    // 4. User Disconnect
    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update_user_list', Object.values(onlineUsers));
        console.log(`🔌 Device Disconnected: ${socket.id}`);
    });
});

server.listen(3000, () => console.log(`🚀 Matchmaker Server Running on Port 3000`));
