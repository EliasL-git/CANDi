const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const AI = require('./ai');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Game state
let gameState = {
  players: {},
  ai: null,
  stars: [],
  scores: { player: 0, ai: 0 },
  gameTimer: 30,
  gameActive: false,
  playerRole: 'runner', // 'runner' or 'chaser'
  aiRole: 'chaser'      // opposite of player
};

// Initialize AI
const ai = new AI();

// Generate random stars on the map
function generateStars(count = 3) {
  const stars = [];
  const mapWidth = 800;
  const mapHeight = 600;
  
  for (let i = 0; i < count; i++) {
    stars.push({
      id: `star_${i}`,
      x: Math.random() * (mapWidth - 100) + 50,
      y: Math.random() * (mapHeight - 100) + 50,
      collected: false
    });
  }
  return stars;
}

// Reset game state
function resetGame() {
  gameState.scores = { player: 0, ai: 0 };
  gameState.gameTimer = 30;
  gameState.gameActive = true;
  gameState.playerRole = 'runner';
  gameState.aiRole = 'chaser';
  gameState.stars = generateStars();
  
  // Reset AI and player positions
  gameState.ai = {
    x: 100,
    y: 500,
    width: 30,
    height: 30
  };
}

// Game timer
let gameInterval;
function startGameTimer() {
  if (gameInterval) clearInterval(gameInterval);
  
  gameInterval = setInterval(() => {
    if (gameState.gameActive && gameState.gameTimer > 0) {
      gameState.gameTimer--;
      
      if (gameState.gameTimer <= 0) {
        // Time's up - it's a tie
        gameState.scores.player++;
        gameState.scores.ai++;
        checkGameEnd();
      }
      
      io.emit('gameState', gameState);
    }
  }, 1000);
}

// Check if game should end or role switch
function checkGameEnd() {
  // Check for role switch at 5 points
  if ((gameState.scores.player === 5 || gameState.scores.ai === 5) && 
      gameState.playerRole === 'runner') {
    // Switch roles
    gameState.playerRole = 'chaser';
    gameState.aiRole = 'runner';
    
    // Reset timer and stars for new round
    gameState.gameTimer = 30;
    gameState.stars = generateStars();
    
    io.emit('roleSwitch', { playerRole: gameState.playerRole, aiRole: gameState.aiRole });
  }
  
  // Check for game end at 10 points
  if (gameState.scores.player >= 10 || gameState.scores.ai >= 10) {
    gameState.gameActive = false;
    clearInterval(gameInterval);
    
    const winner = gameState.scores.player >= 10 ? 'player' : 'ai';
    io.emit('gameEnd', { winner, scores: gameState.scores });
    
    // Save AI learning
    ai.saveMemory();
  }
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Initialize player
  gameState.players[socket.id] = {
    x: 700,
    y: 500,
    width: 30,
    height: 30,
    onGround: false
  };
  
  // Start game if not active
  if (!gameState.gameActive) {
    resetGame();
    startGameTimer();
  }
  
  // Send initial game state
  socket.emit('gameState', gameState);
  socket.emit('playerId', socket.id);
  
  // Handle player movement
  socket.on('playerMove', (moveData) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id] = { ...gameState.players[socket.id], ...moveData };
      
      // Check star collection
      if (gameState.playerRole === 'runner') {
        gameState.stars.forEach(star => {
          if (!star.collected && 
              Math.abs(gameState.players[socket.id].x - star.x) < 30 &&
              Math.abs(gameState.players[socket.id].y - star.y) < 30) {
            star.collected = true;
            gameState.scores.player++;
            checkGameEnd();
          }
        });
      }
      
      // Check tagging
      if (gameState.playerRole === 'chaser' && gameState.ai) {
        const distance = Math.sqrt(
          Math.pow(gameState.players[socket.id].x - gameState.ai.x, 2) +
          Math.pow(gameState.players[socket.id].y - gameState.ai.y, 2)
        );
        
        if (distance < 40) {
          // Player tagged AI
          gameState.scores.player += 100; // Big reward for tagging
          checkGameEnd();
        }
      }
      
      io.emit('gameState', gameState);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[socket.id];
  });
});

// AI update loop
setInterval(() => {
  if (gameState.gameActive && gameState.ai) {
    // Get player position for AI decision making
    const playerPositions = Object.values(gameState.players);
    if (playerPositions.length > 0) {
      const player = playerPositions[0];
      
      // AI makes a move based on current role
      let target;
      if (gameState.aiRole === 'chaser') {
        // AI is chasing player
        target = player;
      } else {
        // AI is running and collecting stars
        const availableStars = gameState.stars.filter(star => !star.collected);
        if (availableStars.length > 0) {
          // Find closest star
          target = availableStars.reduce((closest, star) => {
            const currentDist = Math.sqrt(Math.pow(gameState.ai.x - star.x, 2) + Math.pow(gameState.ai.y - star.y, 2));
            const closestDist = Math.sqrt(Math.pow(gameState.ai.x - closest.x, 2) + Math.pow(gameState.ai.y - closest.y, 2));
            return currentDist < closestDist ? star : closest;
          });
        } else {
          target = player; // Fallback if no stars
        }
      }
      
      if (target) {
        const aiMove = ai.makeMove(gameState.ai, target, gameState.aiRole, player);
        gameState.ai = { ...gameState.ai, ...aiMove };
        
        // AI star collection
        if (gameState.aiRole === 'runner') {
          gameState.stars.forEach(star => {
            if (!star.collected && 
                Math.abs(gameState.ai.x - star.x) < 30 &&
                Math.abs(gameState.ai.y - star.y) < 30) {
              star.collected = true;
              gameState.scores.ai++;
              ai.giveReward(10); // Reward for collecting star
              checkGameEnd();
            }
          });
        }
        
        // AI tagging
        if (gameState.aiRole === 'chaser') {
          const distance = Math.sqrt(
            Math.pow(gameState.ai.x - player.x, 2) +
            Math.pow(gameState.ai.y - player.y, 2)
          );
          
          if (distance < 40) {
            // AI tagged player
            gameState.scores.ai += 100;
            ai.giveReward(100); // Big reward for tagging
            checkGameEnd();
          }
        }
      }
    }
  }
}, 100); // AI updates every 100ms

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CANDi server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play the game`);
});