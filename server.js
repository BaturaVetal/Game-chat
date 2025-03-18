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
let allStrokes = [];

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    players.push(socket.id);

    // Send current game state and strokes to the new client
    socket.emit('updateStrokes', allStrokes);
    socket.emit('gameStatus', { gameStarted, gameEnded });

    socket.on('adminLogin', (data) => {
        if (data.password === ADMIN_PASSWORD && !adminSocket) {
            adminSocket = socket.id;
            const adminNickname = data.nickname;
            socket.emit('adminLoginResponse', { success: true, nickname: adminNickname });
        } else {
            socket.emit('adminLoginResponse', { success: false });
        }
    });

    socket.on('join', (nickname) => {
        socket.nickname = nickname;
        io.emit('chatMessage', { message: `${nickname} has joined!`, nickname: 'System' });
        socket.emit('joinResponse', { success: true });
        io.emit('updatePlayers', players.map(id => io.sockets.sockets.get(id)?.nickname || id));
    });

    socket.on('startGame', (word) => {
        if (socket.id === adminSocket) {
            currentWord = word.toLowerCase();
            gameStarted = true;
            gameEnded = false;
            allStrokes = [];
            io.emit('gameStarted');
            io.emit('gameStatus', { gameStarted, gameEnded });
            io.emit('clearCanvas');
        }
    });

    socket.on('chatMessage', (data) => {
        const { message, nickname } = data;
        if (message.toLowerCase() === currentWord) {
            gameEnded = true;
            io.emit('gameEnded', { winner: nickname, word: currentWord });
            io.emit('gameStatus', { gameStarted, gameEnded });
        }
        io.emit('chatMessage', { message, nickname, correct: message.toLowerCase() === currentWord });
    });

    socket.on('draw', (data) => {
        if (socket.id === adminSocket) {
            socket.broadcast.emit('draw', data); // Send to all except admin
        }
    });

    socket.on('updateStrokes', (updatedStrokes) => {
        if (socket.id === adminSocket) {
            allStrokes = updatedStrokes;
            socket.broadcast.emit('updateStrokes', allStrokes);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.id === adminSocket) {
            adminSocket = null;
        }
        players = players.filter(id => id !== socket.id);
        if (socket.nickname) {
            io.emit('chatMessage', { message: `${socket.nickname} has left!`, nickname: 'System' });
        }
        io.emit('updatePlayers', players.map(id => io.sockets.sockets.get(id)?.nickname || id));
    });

    socket.on('reconnect', () => {
        socket.emit('gameStatus', { gameStarted, gameEnded });
    });
});

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
