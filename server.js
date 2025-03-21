const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let activePlayers = [];
let gameStarted = false;
let word = "";
let currentGuessers = [];
const myAdminNickname = 'adminVet'; // Вкажіть ваш нікнейм, який буде адміністратором

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (nickname) => {
        console.log(`${nickname} joined the game.`);
        activePlayers.push({ id: socket.id, nickname: nickname });

        if (nickname === myAdminNickname) {
            socket.emit('checkAdmin', true);
        } else {
            socket.emit('checkAdmin', false);
        }
        // Надсилаємо стан гри новому гравцеві
        socket.emit('gameStatus', { gameStarted, gameEnded: !gameStarted });
    });

    socket.on('startGame', (newWord) => {
        word = newWord.trim();
        gameStarted = true;
        currentGuessers = [];
        
        io.emit('gameStarted');
        io.emit('gameStatus', { gameStarted: true, gameEnded: false });
        
        console.log(`Game started with the word: ${word}`);
    });

    socket.on('chatMessage', (data) => {
        if (gameStarted && !currentGuessers.includes(data.nickname)) {
            const isCorrect = data.message.toLowerCase() === word.toLowerCase();
            if (isCorrect) {
                io.emit('gameEnded', { winner: data.nickname, word: word });
                io.emit('gameStatus', { gameStarted: false, gameEnded: true });
                gameStarted = false;
                currentGuessers.push(data.nickname);
                console.log(`${data.nickname} guessed the word!`);
            }
            io.emit('chatMessage', { message: data.message, nickname: data.nickname, correct: isCorrect });
        }
    });

    socket.on('forceEndGame', () => {
        if (!gameStarted) return;

        gameStarted = false;
        currentGuessers = [];

        io.emit('gameEnded', { winner: 'Ніхто не', word: word });
        io.emit('gameStatus', { gameStarted: false, gameEnded: true });

        console.log('Гру примусово завершено адміном');
    });

    socket.on('reconnect', () => {
        socket.emit('gameStatus', { gameStarted, gameEnded: !gameStarted });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        activePlayers = activePlayers.filter(player => player.id !== socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});

