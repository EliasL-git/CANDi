// Game client-side logic
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameState = null;
let playerId = null;
let keys = {};

// UI elements
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl = document.getElementById('aiScore');
const gameTimerEl = document.getElementById('gameTimer');
const playerRoleEl = document.getElementById('playerRole');
const gameOverlayEl = document.getElementById('gameOverlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayMessageEl = document.getElementById('overlayMessage');
const aiEpsilonEl = document.getElementById('aiEpsilon');
const aiEpisodesEl = document.getElementById('aiEpisodes');
const aiLearningEl = document.getElementById('aiLearning');

// Player movement state
let player = {
    x: 700,
    y: 500,
    width: 30,
    height: 30,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
    speed: 5,
    jumpPower: 15,
    gravity: 0.8
};

// Game map - platforms for parkour
const platforms = [
    { x: 0, y: 580, width: 800, height: 20 },      // Ground
    { x: 150, y: 480, width: 100, height: 20 },    // Platform 1
    { x: 350, y: 380, width: 100, height: 20 },    // Platform 2
    { x: 550, y: 480, width: 100, height: 20 },    // Platform 3
    { x: 250, y: 280, width: 150, height: 20 },    // High platform
    { x: 0, y: 0, width: 20, height: 600 },        // Left wall
    { x: 780, y: 0, width: 20, height: 600 },      // Right wall
    { x: 0, y: 0, width: 800, height: 20 },        // Ceiling
];

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('playerId', (id) => {
    playerId = id;
});

socket.on('gameState', (state) => {
    gameState = state;
    updateUI();
});

socket.on('roleSwitch', (roleData) => {
    console.log('Role switch!', roleData);
    playerRoleEl.textContent = roleData.playerRole.charAt(0).toUpperCase() + roleData.playerRole.slice(1);
    
    // Add animation effect
    playerRoleEl.parentElement.classList.add('role-switch-animation');
    setTimeout(() => {
        playerRoleEl.parentElement.classList.remove('role-switch-animation');
    }, 500);
    
    // Show notification
    showNotification(`You are now the ${roleData.playerRole}!`);
});

socket.on('gameEnd', (endData) => {
    showGameOver(endData.winner, endData.scores);
});

// Keyboard input handling
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // Prevent default behavior for game keys
    if (['w', 'a', 's', 'd', ' ', 'e'].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Player movement and physics
function updatePlayer() {
    if (!gameState || !gameState.players[playerId]) return;
    
    // Horizontal movement
    if (keys['a'] || keys['arrowleft']) {
        player.velocityX = -player.speed;
    } else if (keys['d'] || keys['arrowright']) {
        player.velocityX = player.speed;
    } else {
        player.velocityX *= 0.8; // Friction
    }
    
    // Jumping
    if ((keys['w'] || keys[' '] || keys['arrowup']) && player.onGround) {
        player.velocityY = -player.jumpPower;
        player.onGround = false;
    }
    
    // Climbing (when near walls)
    if (keys['e'] && isNearWall()) {
        player.velocityY = -player.speed * 0.8;
    }
    
    // Apply gravity
    if (!player.onGround) {
        player.velocityY += player.gravity;
    }
    
    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Collision detection with platforms
    handleCollisions();
    
    // Send movement to server
    socket.emit('playerMove', {
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        onGround: player.onGround
    });
}

// Check if player is near a wall for climbing
function isNearWall() {
    const wallDistance = 40;
    return (player.x < wallDistance || player.x > 800 - wallDistance);
}

// Handle collisions with platforms
function handleCollisions() {
    player.onGround = false;
    
    for (const platform of platforms) {
        // Check collision
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y) {
            
            // Determine collision side
            const overlapX = Math.min(player.x + player.width - platform.x, platform.x + platform.width - player.x);
            const overlapY = Math.min(player.y + player.height - platform.y, platform.y + platform.height - player.y);
            
            if (overlapX < overlapY) {
                // Horizontal collision
                if (player.x < platform.x) {
                    player.x = platform.x - player.width;
                } else {
                    player.x = platform.x + platform.width;
                }
                player.velocityX = 0;
            } else {
                // Vertical collision
                if (player.y < platform.y) {
                    // Landing on top
                    player.y = platform.y - player.height;
                    player.velocityY = 0;
                    player.onGround = true;
                } else {
                    // Hitting from below
                    player.y = platform.y + platform.height;
                    player.velocityY = 0;
                }
            }
        }
    }
    
    // Boundary checks
    player.x = Math.max(20, Math.min(780 - player.width, player.x));
    if (player.y > 600) {
        player.y = 580 - player.height;
        player.velocityY = 0;
        player.onGround = true;
    }
}

// Rendering functions
function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#87ceeb');
    gradient.addColorStop(1, '#98fb98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    
    // Draw platforms
    drawPlatforms();
    
    // Draw game elements
    if (gameState) {
        drawStars();
        drawPlayers();
        drawAI();
    }
    
    // Draw UI overlay
    drawGameInfo();
}

function drawPlatforms() {
    ctx.fillStyle = '#8B4513';
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function drawStars() {
    if (!gameState.stars) return;
    
    gameState.stars.forEach(star => {
        if (!star.collected) {
            drawStar(star.x, star.y, 15, '#FFD700');
        }
    });
}

function drawStar(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 144 - 90) * Math.PI / 180;
        const xPos = x + Math.cos(angle) * size;
        const yPos = y + Math.sin(angle) * size;
        
        if (i === 0) {
            ctx.moveTo(xPos, yPos);
        } else {
            ctx.lineTo(xPos, yPos);
        }
        
        const innerAngle = ((i + 0.5) * 144 - 90) * Math.PI / 180;
        const innerX = x + Math.cos(innerAngle) * (size * 0.5);
        const innerY = y + Math.sin(innerAngle) * (size * 0.5);
        ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawPlayers() {
    if (!gameState.players) return;
    
    Object.values(gameState.players).forEach(playerData => {
        // Player character
        ctx.fillStyle = '#2ecc71';
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 2;
        
        // Body
        ctx.fillRect(playerData.x, playerData.y, playerData.width, playerData.height);
        ctx.strokeRect(playerData.x, playerData.y, playerData.width, playerData.height);
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(playerData.x + 5, playerData.y + 5, 6, 6);
        ctx.fillRect(playerData.x + 19, playerData.y + 5, 6, 6);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(playerData.x + 7, playerData.y + 7, 2, 2);
        ctx.fillRect(playerData.x + 21, playerData.y + 7, 2, 2);
        
        // Role indicator
        const role = gameState.playerRole || 'runner';
        ctx.fillStyle = role === 'chaser' ? '#e74c3c' : '#3498db';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(role.toUpperCase(), playerData.x + playerData.width / 2, playerData.y - 5);
    });
}

function drawAI() {
    if (!gameState.ai) return;
    
    const ai = gameState.ai;
    
    // AI character
    ctx.fillStyle = '#e74c3c';
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    
    // Body
    ctx.fillRect(ai.x, ai.y, ai.width, ai.height);
    ctx.strokeRect(ai.x, ai.y, ai.width, ai.height);
    
    // Eyes (glowing effect for AI)
    ctx.fillStyle = '#fff';
    ctx.fillRect(ai.x + 5, ai.y + 5, 6, 6);
    ctx.fillRect(ai.x + 19, ai.y + 5, 6, 6);
    
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(ai.x + 7, ai.y + 7, 2, 2);
    ctx.fillRect(ai.x + 21, ai.y + 7, 2, 2);
    
    // AI glow effect
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 10;
    ctx.strokeRect(ai.x, ai.y, ai.width, ai.height);
    ctx.shadowBlur = 0;
    
    // Role indicator
    const aiRole = gameState.aiRole || 'chaser';
    ctx.fillStyle = aiRole === 'chaser' ? '#e74c3c' : '#3498db';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`AI ${aiRole.toUpperCase()}`, ai.x + ai.width / 2, ai.y - 5);
}

function drawGameInfo() {
    // Draw a semi-transparent overlay for better text visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(10, 10, 200, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('WASD: Move', 20, 30);
    ctx.fillText('Space: Jump', 20, 50);
    ctx.fillText('E: Climb', 20, 70);
}

// UI update functions
function updateUI() {
    if (!gameState) return;
    
    playerScoreEl.textContent = gameState.scores.player;
    aiScoreEl.textContent = gameState.scores.ai;
    gameTimerEl.textContent = gameState.gameTimer;
    
    // Update role display
    const role = gameState.playerRole || 'runner';
    playerRoleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    
    // Update AI status (simulated values for demo)
    aiEpsilonEl.textContent = '25%';
    aiEpisodesEl.textContent = gameState.scores.player + gameState.scores.ai;
    aiLearningEl.textContent = gameState.gameActive ? 'Active' : 'Idle';
}

function showGameOver(winner, scores) {
    overlayTitleEl.textContent = 'Game Over!';
    overlayMessageEl.textContent = `Winner: ${winner.toUpperCase()}! Final Score - Player: ${scores.player}, AI: ${scores.ai}`;
    gameOverlayEl.style.display = 'flex';
}

function showNotification(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 1.5em;
        z-index: 1000;
        animation: fadeInOut 3s ease-in-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

function restartGame() {
    gameOverlayEl.style.display = 'none';
    socket.emit('restartGame');
}

// Game loop
function gameLoop() {
    updatePlayer();
    render();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
`;
document.head.appendChild(style);