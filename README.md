
# Ultimate Tic-Tac-Toe with AI

![CI](https://img.shields.io/github/actions/workflow/status/MatALass/ultimate-ttt/ci.yml)
![License](https://img.shields.io/github/license/MatALass/ultimate-ttt)
![Repo Size](https://img.shields.io/github/repo-size/MatALass/ultimate-ttt)
![Language](https://img.shields.io/badge/language-JavaScript-yellow)
![AI](https://img.shields.io/badge/AI-Minimax%20%2B%20MCTS-blue)

A modern browser implementation of **Ultimate Tic‑Tac‑Toe** featuring multiple AI algorithms,
analysis tools, replay functionality and simulation capabilities.

---

## Demo

Once deployed with GitHub Pages:

https://MatALass.github.io/ultimate-ttt/

---

## Preview

Add a gameplay GIF here:

![Gameplay](docs/gameplay.gif)

---

# Features

## Game modes

• Human vs AI  
• Human vs Human  
• AI vs AI  

## AI algorithms

• Minimax with alpha‑beta pruning  
• Transposition tables  
• Iterative deepening  
• Monte‑Carlo Tree Search (UCT)

## Analysis tools

• Best move suggestions  
• Heatmap of promising moves  
• AI statistics (depth, nodes, cache hits)

## Game utilities

• Undo / Redo  
• Replay system  
• Export / Import game state  
• Local save  
• Simulation mode (100 or 1000 AI games)

---

# Rules

Ultimate Tic‑Tac‑Toe is a 3×3 grid of Tic‑Tac‑Toe boards.

When a player places a mark:

The **position of the move determines the board where the opponent must play next**.

Example:

If you play in square **5**, the opponent must play in **board 5**.

If the destination board is already finished:

The opponent may play **anywhere**.

To win the game you must:

Win **three small boards in a row**.

---

# Project structure

```
ultimate-ttt

index.html
css/
    style.css

js/
    main.js
    game.js
    ui.js
    ai.js
    hash.js
    storage.js
    replay.js

tests/
    game.test.js
```

---

# AI overview

## Minimax

The Minimax algorithm explores the game tree and evaluates positions using heuristics.

Enhancements:

• Alpha‑beta pruning  
• Move ordering  
• Transposition table caching  
• Iterative deepening  

This allows deeper searches while keeping response time acceptable.

## Monte‑Carlo Tree Search

The project also includes a **UCT‑based MCTS implementation**.

Steps:

1. Selection  
2. Expansion  
3. Simulation  
4. Backpropagation  

UCT formula:

value = win_rate + C * sqrt(log(parent_visits) / visits)

---

# Running locally

Because the project uses ES modules, run a local server.

Example with Python:

python -m http.server 5500

Then open:

http://localhost:5500

---

# Development

Install dependencies:

npm install

Run tests:

npm test

Run full checks:

npm run check

---

# Continuous Integration

GitHub Actions automatically runs:

• Prettier formatting check  
• ESLint  
• Stylelint  
• HTML validation  
• Unit tests  

---

# Possible future improvements

• neural network evaluation  
• stronger MCTS rollout policy  
• online multiplayer  
• AI tournament visualization  
• advanced heatmap visualization

---

# License

MIT

---

# Author

Mathieu Alassoeur  
Computer Engineering Student – Data / AI
