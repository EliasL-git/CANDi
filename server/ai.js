const fs = require('fs');
const path = require('path');

class AI {
  constructor() {
    this.dataFile = path.join(__dirname, 'data.json');
    this.loadMemory();
    
    // Movement actions
    this.actions = ['up', 'down', 'left', 'right', 'jump'];
    
    // Pattern recognition storage
    this.playerPatterns = [];
    this.lastPlayerPositions = [];
    this.maxPatternHistory = 10;
  }
  
  // Load AI memory from data.json
  loadMemory() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.qTable = data.q_table || {};
        this.episodes = data.episodes || 0;
        this.epsilon = data.epsilon || 0.3; // Exploration rate
        this.learningRate = data.learning_rate || 0.1;
        this.discountFactor = data.discount_factor || 0.9;
      } else {
        // Initialize with default values
        this.qTable = {};
        this.episodes = 0;
        this.epsilon = 0.3;
        this.learningRate = 0.1;
        this.discountFactor = 0.9;
        this.saveMemory();
      }
    } catch (error) {
      console.error('Error loading AI memory:', error);
      this.qTable = {};
      this.episodes = 0;
      this.epsilon = 0.3;
      this.learningRate = 0.1;
      this.discountFactor = 0.9;
    }
  }
  
  // Save AI memory to data.json
  saveMemory() {
    try {
      const data = {
        q_table: this.qTable,
        episodes: this.episodes,
        epsilon: this.epsilon,
        learning_rate: this.learningRate,
        discount_factor: this.discountFactor
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving AI memory:', error);
    }
  }
  
  // Get state string for Q-learning
  getState(aiPos, target, role, player = null) {
    const dx = target.x - aiPos.x;
    const dy = target.y - aiPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Discretize the state
    let direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'target_right' : 'target_left';
    } else {
      direction = dy > 0 ? 'target_down' : 'target_up';
    }
    
    let distanceCategory;
    if (distance < 50) {
      distanceCategory = 'close';
    } else if (distance < 150) {
      distanceCategory = 'medium';
    } else {
      distanceCategory = 'far';
    }
    
    // Include role in state
    const state = `${role}_${direction}_${distanceCategory}`;
    
    // Add player proximity for runner mode
    if (role === 'runner' && player) {
      const playerDistance = Math.sqrt(
        Math.pow(aiPos.x - player.x, 2) + Math.pow(aiPos.y - player.y, 2)
      );
      
      if (playerDistance < 100) {
        return `${state}_danger`;
      }
    }
    
    return state;
  }
  
  // Get Q-value for state-action pair
  getQValue(state, action) {
    if (!this.qTable[state]) {
      this.qTable[state] = {};
      this.actions.forEach(a => {
        this.qTable[state][a] = 0;
      });
    }
    return this.qTable[state][action] || 0;
  }
  
  // Choose action using epsilon-greedy policy
  chooseAction(state) {
    // Epsilon-greedy exploration
    if (Math.random() < this.epsilon) {
      // Explore: choose random action
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    } else {
      // Exploit: choose best known action
      if (!this.qTable[state]) {
        return this.actions[Math.floor(Math.random() * this.actions.length)];
      }
      
      let bestAction = this.actions[0];
      let bestValue = this.getQValue(state, bestAction);
      
      for (const action of this.actions) {
        const value = this.getQValue(state, action);
        if (value > bestValue) {
          bestValue = value;
          bestAction = action;
        }
      }
      
      return bestAction;
    }
  }
  
  // Update Q-value based on reward
  updateQValue(state, action, reward, nextState) {
    const currentQ = this.getQValue(state, action);
    
    // Find max Q-value for next state
    let maxNextQ = 0;
    if (nextState && this.qTable[nextState]) {
      for (const nextAction of this.actions) {
        maxNextQ = Math.max(maxNextQ, this.getQValue(nextState, nextAction));
      }
    }
    
    // Q-learning update rule
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    
    if (!this.qTable[state]) {
      this.qTable[state] = {};
    }
    this.qTable[state][action] = newQ;
  }
  
  // Make AI move decision
  makeMove(aiPos, target, role, player = null) {
    const state = this.getState(aiPos, target, role, player);
    const action = this.chooseAction(state);
    
    // Store state for learning
    this.lastState = state;
    this.lastAction = action;
    
    // Convert action to movement
    const movement = this.actionToMovement(action, aiPos, target, role);
    
    // Record player pattern for learning
    if (player) {
      this.recordPlayerPattern(player);
    }
    
    // Calculate reward for this move
    const reward = this.calculateReward(aiPos, target, role, player, movement);
    
    // Update Q-learning if we have a previous state
    if (this.lastState && this.lastAction) {
      this.updateQValue(this.lastState, this.lastAction, reward, state);
    }
    
    return movement;
  }
  
  // Convert action to actual movement
  actionToMovement(action, aiPos, target, role) {
    const speed = 3;
    const jumpPower = 15;
    let movement = { x: aiPos.x, y: aiPos.y };
    
    switch (action) {
      case 'left':
        movement.x = Math.max(0, aiPos.x - speed);
        break;
      case 'right':
        movement.x = Math.min(800, aiPos.x + speed);
        break;
      case 'up':
        movement.y = Math.max(0, aiPos.y - speed);
        break;
      case 'down':
        movement.y = Math.min(600, aiPos.y + speed);
        break;
      case 'jump':
        movement.y = Math.max(0, aiPos.y - jumpPower);
        break;
    }
    
    return movement;
  }
  
  // Calculate reward for current move
  calculateReward(aiPos, target, role, player, newPos) {
    let reward = 0;
    
    // Distance-based reward
    const oldDistance = Math.sqrt(Math.pow(aiPos.x - target.x, 2) + Math.pow(aiPos.y - target.y, 2));
    const newDistance = Math.sqrt(Math.pow(newPos.x - target.x, 2) + Math.pow(newPos.y - target.y, 2));
    
    if (role === 'chaser') {
      // Reward for getting closer to target
      if (newDistance < oldDistance) {
        reward += 1;
      } else {
        reward -= 0.5;
      }
    } else if (role === 'runner') {
      // For runner, reward for getting closer to stars but away from player
      if (target !== player && newDistance < oldDistance) {
        reward += 1; // Getting closer to star
      }
      
      if (player) {
        const oldPlayerDistance = Math.sqrt(Math.pow(aiPos.x - player.x, 2) + Math.pow(aiPos.y - player.y, 2));
        const newPlayerDistance = Math.sqrt(Math.pow(newPos.x - player.x, 2) + Math.pow(newPos.y - player.y, 2));
        
        if (newPlayerDistance > oldPlayerDistance) {
          reward += 0.5; // Getting away from chasing player
        } else {
          reward -= 1; // Getting closer to danger
        }
      }
    }
    
    // Boundary penalties
    if (newPos.x <= 0 || newPos.x >= 800 || newPos.y <= 0 || newPos.y >= 600) {
      reward -= 2;
    }
    
    return reward;
  }
  
  // Give external reward (for tagging, collecting stars)
  giveReward(reward) {
    if (this.lastState && this.lastAction) {
      const currentQ = this.getQValue(this.lastState, this.lastAction);
      const newQ = currentQ + this.learningRate * reward;
      
      if (!this.qTable[this.lastState]) {
        this.qTable[this.lastState] = {};
      }
      this.qTable[this.lastState][this.lastAction] = newQ;
    }
  }
  
  // Record player movement patterns
  recordPlayerPattern(player) {
    this.lastPlayerPositions.push({ x: player.x, y: player.y, timestamp: Date.now() });
    
    // Keep only recent positions
    if (this.lastPlayerPositions.length > this.maxPatternHistory) {
      this.lastPlayerPositions.shift();
    }
    
    // Analyze patterns if we have enough data
    if (this.lastPlayerPositions.length >= 3) {
      this.analyzePlayerPattern();
    }
  }
  
  // Analyze player movement patterns
  analyzePlayerPattern() {
    if (this.lastPlayerPositions.length < 3) return;
    
    const recent = this.lastPlayerPositions.slice(-3);
    
    // Calculate movement direction
    const dx1 = recent[1].x - recent[0].x;
    const dy1 = recent[1].y - recent[0].y;
    const dx2 = recent[2].x - recent[1].x;
    const dy2 = recent[2].y - recent[1].y;
    
    // Detect consistent movement patterns
    let pattern = 'random';
    
    if (Math.abs(dx1) > Math.abs(dy1) && Math.abs(dx2) > Math.abs(dy2)) {
      pattern = (dx1 > 0 && dx2 > 0) ? 'moving_right' : 
               (dx1 < 0 && dx2 < 0) ? 'moving_left' : 'horizontal';
    } else if (Math.abs(dy1) > Math.abs(dx1) && Math.abs(dy2) > Math.abs(dx2)) {
      pattern = (dy1 > 0 && dy2 > 0) ? 'moving_down' : 
               (dy1 < 0 && dy2 < 0) ? 'moving_up' : 'vertical';
    }
    
    this.playerPatterns.push(pattern);
    if (this.playerPatterns.length > 20) {
      this.playerPatterns.shift();
    }
  }
  
  // Predict player movement
  predictPlayerMovement() {
    if (this.playerPatterns.length < 3) return null;
    
    // Find most common recent pattern
    const recentPatterns = this.playerPatterns.slice(-5);
    const patternCount = {};
    
    recentPatterns.forEach(pattern => {
      patternCount[pattern] = (patternCount[pattern] || 0) + 1;
    });
    
    const mostCommon = Object.keys(patternCount).reduce((a, b) => 
      patternCount[a] > patternCount[b] ? a : b
    );
    
    return mostCommon;
  }
  
  // Decay epsilon over time (less exploration as AI learns)
  decayEpsilon() {
    this.epsilon = Math.max(0.1, this.epsilon * 0.995);
    this.episodes++;
  }
}

module.exports = AI;