// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Config file se database (db) import karein
const { db } = require('./config'); 

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const activeUsers = new Map();

io.on('connection', (socket) => {
    
    // User online aata hai
    socket.on('user_online', (uid) => {
        activeUsers.set(uid, socket.id);
        console.log(`🟢 User Online: ${uid}`);
        
        // TODO: Jaise hi user online aaye, aap yahan DB se uske offline messages fetch karke bhej sakte hain
    });

    // Jab koi E2EE message ya file bhejta hai
    socket.on('send_private_msg', async (payload) => {
        const { msgId, senderId, receiverId, encryptedData, type, fileName } = payload;
        const receiverSocket = activeUsers.get(receiverId);

        if (receiverSocket) {
            // Receiver ONLINE hai -> Direct WebSockets (Fastest Delivery)
            io.to(receiverSocket).emit('receive_private_msg', payload);
            console.log(`⚡ Fast delivery to ${receiverId}`);
        } else {
            // Receiver OFFLINE hai -> Firebase Realtime DB me save karo
            console.log(`🟡 ${receiverId} offline hai. Saving to Firebase...`);
            
            try {
                // Firebase me 'offline_messages/receiverId/msgId' ke format me save karenge
                const messageRef = db.ref(`offline_messages/${receiverId}/${msgId}`);
                
                await messageRef.set({
                    senderId: senderId,
                    encryptedData: encryptedData, // Server ke paas sirf ye cipher-text aayega
                    type: type,
                    fileName: fileName || null,
                    timestamp: Date.now()
                });

                // Sender ko batao ki msg successfully server/DB tak pahunch gaya (Single Tick ✓)
                socket.emit('msg_status_update', { msgId: msgId, status: 'saved_to_db' });
                
            } catch (error) {
                console.error("Firebase saving error: ", error);
            }
        }
    });

    // Seen/Read Ticks (Double Blue Ticks)
    socket.on('mark_as_read', ({ msgId, senderId }) => {
        const senderSocket = activeUsers.get(senderId);
        if (senderSocket) {
            io.to(senderSocket).emit('msg_status_update', { msgId, status: 'read' });
        }
    });

    // User logout karta hai
    socket.on('user_offline', (uid) => {
        activeUsers.delete(uid);
        console.log(`🔴 User Offline: ${uid}`);
    });

    // Connection tootne par (browser close etc.)
    socket.on('disconnect', () => {
        for (let [uid, sid] of activeUsers.entries()) {
            if (sid === socket.id) {
                activeUsers.delete(uid);
                console.log(`🔌 Connection closed for: ${uid}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 NexChat API Running on Port ${PORT}`));
