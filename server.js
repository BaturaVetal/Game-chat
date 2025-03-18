const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASSWORD = 'admin123';
let adminSocket = null;
let gameStarted = false;
let gameEnded = false;
let currentWord = '';
let players = [];
let allStrokes = []; // Store strokes on the server

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    players.push(socket.id);

    // Send current strokes to the newly connected client
    socket.emit('updateStrokes', allStrokes);

    socket.on('adminLogin', (data) => {
        console.log('Received adminLogin event:', data);
        if (data.password === ADMIN_PASSWORD && !adminSocket) {
            adminSocket = socket.id;
            const adminNickname = data.nickname;
            console.log('Admin login successful, setting adminSocket:', adminSocket);
            socket.emit('adminLoginResponse', { success: true, nickname: adminNickname });
        } else {
            console.log('Admin login failed: incorrect password or admin already connected');
            socket.emit('adminLoginResponse', { success: false });
        }
    });

    socket.on('join', (nickname) => {
        console.log('Received join event for nickname:', nickname);
        socket.nickname = nickname;
        io.emit('chatMessage', { message: `${nickname} has joined!`, nickname: 'System' });
        socket.emit('joinResponse', { success: true });
        io.emit('updatePlayers', players.map(id => io.sockets.sockets.get(id)?.nickname || id));
    });

    socket.on('startGame', (word) => {
        if (socket.id === adminSocket) {
            console.log('Starting game with word:', word);
            currentWord = word.toLowerCase();
            gameStarted = true;
            gameEnded = false;
            allStrokes = []; // Clear strokes on the server
            io.emit('gameStarted');
            io.emit('gameStatus', { gameStarted, gameEnded });
            io.emit('clearCanvas'); // Notify all clients to clear
        } else {
            console.log('Non-admin attempted to start game:', socket.id);
        }
    });

    socket.on('chatMessage', (data) => {
        const { message, nickname } = data;
        console.log('Received chatMessage:', data);
        if (message.toLowerCase() === currentWord) {
            gameEnded = true;
            io.emit('gameEnded', { winner: nickname, word: currentWord });
            io.emit('gameStatus', { gameStarted, gameEnded });
        }
        io.emit('chatMessage', { message, nickname, correct: message.toLowerCase() === currentWord });
    });

    socket.on('draw', (data) => {
        console.log('Broadcasting draw data:', data);
        io.emit('draw', data); // Broadcast to all clients
    });

    socket.on('updateStrokes', (updatedStrokes) => {
        console.log('Received updated strokes:', updatedStrokes);
        allStrokes = updatedStrokes;
        io.emit('updateStrokes', allStrokes); // Sync with all clients
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.id === adminSocket) {
            adminSocket = null;
            console.log('Admin disconnected, adminSocket cleared');
        }
        players = players.filter(id => id !== socket.id);
        if (socket.nickname) {
            io.emit('chatMessage', { message: `${socket.nickname} has left!`, nickname: 'System' });
        }
        io.emit('updatePlayers', players.map(id => io.sockets.sockets.get(id)?.nickname || id));
    });

    socket.on('reconnect', () => {
        console.log('Client reconnected:', socket.id);
        socket.emit('gameStatus', { gameStarted, gameEnded });
    });
});

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
