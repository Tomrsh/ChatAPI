// server.js (Fast WebSocket Engine)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Kiska UID kis Socket ID se connect hai, usko track karne ke liye
const activeUsers = new Map(); 

io.on('connection', (socket) => {
    
    // 1. User Online Aaya
    socket.on('user_online', (uid) => {
        activeUsers.set(uid, socket.id);
        console.log(`🟢 User Online: ${uid}`);
        socket.broadcast.emit('user_status_change', { uid, status: 'online' });
    });

    // 2. Private 1-on-1 Message (E2EE)
    socket.on('send_private_msg', (payload) => {
        const { senderId, receiverId, encryptedData, msgId, timestamp } = payload;
        const receiverSocketId = activeUsers.get(receiverId);

        // Agar user online hai, turant bhej do (Fastest delivery)
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('receive_private_msg', payload);
            
            // Sender ko "Delivered" (Double Gray Tick) ka status bhejo
            socket.emit('msg_status_update', { msgId, status: 'delivered' });
        } else {
            // User offline hai -> Firebase me save karne ka logic frontend handle karega
            socket.emit('msg_status_update', { msgId, status: 'sent' });
        }
    });

    // 3. Seen/Read Status (Blue Ticks)
    socket.on('mark_as_read', ({ msgId, senderId }) => {
        const senderSocketId = activeUsers.get(senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit('msg_status_update', { msgId, status: 'read' }); // 🔵 Blue Tick
        }
    });

    // 4. Typing Indicator
    socket.on('typing', ({ senderId, receiverId, isTyping }) => {
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('typing_status', { senderId, isTyping });
        }
    });

    // 5. User Offline
    socket.on('disconnect', () => {
        let disconnectedUid = null;
        for (let [uid, sid] of activeUsers.entries()) {
            if (sid === socket.id) {
                disconnectedUid = uid;
                activeUsers.delete(uid);
                break;
            }
        }
        if (disconnectedUid) {
            console.log(`🔴 User Offline: ${disconnectedUid}`);
            io.emit('user_status_change', { uid: disconnectedUid, status: 'offline' });
        }
    });
});

server.listen(3000, () => console.log(`🚀 Ultra-Fast Chat Server Running on Port 3000`));
