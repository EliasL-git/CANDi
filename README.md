# 🏃 CANDi - 2D Parkour Tag Game

A 2D parkour tag game where you compete against an AI that learns from your movement patterns using reinforcement learning (Q-learning).

![CANDi Game Screenshot](https://github.com/user-attachments/assets/464c9ba0-9db8-4666-aadc-10e6384fa394)

## 🎮 Game Features

- **2D Parkour Movement**: WASD controls with jumping and climbing mechanics
- **AI Opponent with Q-Learning**: AI that learns and adapts to your play style
- **Dynamic Role Switching**: Switch between Runner and Chaser at 5 points
- **Star Collection**: Collect randomly placed stars to score points
- **Real-time Multiplayer**: WebSocket-based client-server communication
- **Persistent AI Memory**: AI remembers lessons between game sessions

## 🎯 How to Play

### Objective
- **First to 10 points wins**
- **Roles switch at 5 points**: Runner ↔ Chaser

### Controls
- **WASD**: Move around the arena
- **Space**: Jump to reach higher platforms
- **E**: Climb walls when near them

### Game Modes
- **Runner**: Collect golden stars scattered around the map (1 point each)
- **Chaser**: Tag the opponent to score points (100 points for tagging)

### Game Rules
- Each round lasts 30 seconds
- If no one reaches 10 points in 30 seconds, it's a tie (both get +1 point)
- Roles automatically switch at 5 points to keep the game dynamic

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation & Setup
```bash
# Clone the repository
git clone https://github.com/EliasL-git/CANDi.git
cd CANDi

# Install dependencies
npm install

# Start the game server
npm start
```

### Play the Game
1. Open your browser to `http://localhost:3000`
2. Use WASD + Space + E to move around
3. Collect stars as a Runner or tag the AI as a Chaser
4. Watch the AI learn from your movements!

## 🤖 AI Learning System

The AI uses **Q-Learning** with the following features:

- **State Space**: Position relative to target, role (runner/chaser), distance categories
- **Action Space**: Move up, down, left, right, or jump
- **Reward System**: 
  - +1 for moving closer to target
  - -0.5 for moving away
  - +10 for collecting stars
  - +100 for successful tagging
- **Pattern Recognition**: Learns common player movement habits
- **Persistent Memory**: Q-table saved to `server/data.json`

### AI Status Indicators
- **Exploration Rate**: How often AI tries random moves vs. learned moves
- **Episodes**: Number of games the AI has played
- **Learning**: Current AI learning status

## 📁 Project Structure

```
CANDi/
├── client/           # Frontend game client
│   ├── index.html   # Main game page
│   ├── style.css    # Game styling
│   └── game.js      # Canvas rendering & input handling
├── server/          # Backend Node.js server
│   ├── server.js    # Express server & game logic
│   ├── ai.js        # Q-learning AI implementation
│   └── data.json    # Persistent AI memory
├── maps/            # Game level definitions
│   └── default.json # Default parkour arena
└── assets/          # Game assets (sprites, sounds)
```

## 🛠️ Technical Details

- **Frontend**: HTML5 Canvas + JavaScript
- **Backend**: Node.js + Express + Socket.IO
- **AI**: Q-Learning with epsilon-greedy exploration
- **Communication**: Real-time WebSocket updates
- **Data Storage**: JSON file for AI persistence

## 🎨 Game Mechanics

### Movement Physics
- Gravity and collision detection
- Multi-level platforms for parkour gameplay
- Wall climbing near boundaries
- Smooth WASD movement with momentum

### AI Behavior
- **Chaser Mode**: Pursues player using learned optimal paths
- **Runner Mode**: Collects stars while avoiding player
- **Adaptive Learning**: Improves strategy over time
- **Pattern Recognition**: Predicts player movement patterns

## 🏆 Win Conditions

1. **Score Victory**: First to reach 10 points
2. **Tie Rounds**: 30-second timer creates tie conditions
3. **Role Switching**: Keeps gameplay dynamic and balanced

## 🔧 Development

### Running in Development Mode
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Game Configuration
- Modify `maps/default.json` to change the arena layout
- Adjust AI learning parameters in `server/ai.js`
- Customize game rules in `server/server.js`

## 📄 License

MIT License - Feel free to use this code for learning and experimentation!

---

**Enjoy playing CANDi and watch the AI learn from your every move!** 🎮🤖
