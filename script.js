// Enhanced Chess Game with Advanced Features
const pieces = {
    'white': {
        'king': '♔', 'queen': '♕', 'rook': '♖', 
        'bishop': '♗', 'knight': '♘', 'pawn': '♙'
    },
    'black': {
        'king': '♚', 'queen': '♛', 'rook': '♜', 
        'bishop': '♝', 'knight': '♞', 'pawn': '♟'
    }
};

let board = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖']
];

let currentPlayer = 'white';
let selectedSquare = null;
let gameOver = false;
let soundEnabled = true;
let moveHistory = [];
let gameMode = 'classic';
let playMode = 'human';
let whiteTime = Infinity;
let blackTime = Infinity;
let timerInterval = null;
let isInCheck = false;
let botThinking = false;
let currentHint = null;
let stockfishError = false;

// Initialize particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Sound effects
function playSound(type) {
    if (!soundEnabled) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'move':
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            break;
        case 'capture':
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
            break;
        case 'select':
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            break;
        case 'win':
            oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.2);
            oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.4);
            break;
    }
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Create explosion effect
function createExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = x + 'px';
    explosion.style.top = y + 'px';
    document.body.appendChild(explosion);

    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'explosion-particle';
        const angle = (i / 12) * Math.PI * 2;
        const distance = 50 + Math.random() * 50;
        particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
        particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
        explosion.appendChild(particle);
    }

    setTimeout(() => explosion.remove(), 800);
}

function createBoard() {
    const boardElement = document.getElementById('chessBoard');
    boardElement.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            
            if (board[row][col]) {
                const piece = document.createElement('div');
                piece.className = 'piece';
                piece.textContent = board[row][col];
                square.appendChild(piece);
            }
            
            square.addEventListener('click', handleSquareClick);
            boardElement.appendChild(square);
        }
    }
}

function handleSquareClick(event) {
    if (gameOver) return;

    const square = event.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const piece = board[row][col];

    // Clear previous highlights
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'possible-move', 'hint-from', 'hint-to');
    });

    if (selectedSquare) {
        const [selectedRow, selectedCol] = selectedSquare;
        
        if (selectedRow === row && selectedCol === col) {
            selectedSquare = null;
            return;
        }

        if (isValidMove(selectedRow, selectedCol, row, col)) {
            const capturedPiece = board[row][col];
            makeMove(selectedRow, selectedCol, row, col);
            
            if (capturedPiece) {
                playSound('capture');
                const rect = square.getBoundingClientRect();
                createExplosion(rect.left + rect.width/2, rect.top + rect.height/2);
            } else {
                playSound('move');
            }
            
            selectedSquare = null;
            switchPlayer();
            checkGameEnd();
        } else if (piece && isPieceOwnedByCurrentPlayer(piece)) {
            selectedSquare = [row, col];
            square.classList.add('selected');
            highlightPossibleMoves(row, col);
            playSound('select');
        } else {
            selectedSquare = null;
        }
    } else if (piece && isPieceOwnedByCurrentPlayer(piece)) {
        selectedSquare = [row, col];
        square.classList.add('selected');
        highlightPossibleMoves(row, col);
        playSound('select');
    }
}

function isPieceOwnedByCurrentPlayer(piece) {
    const whitePieces = Object.values(pieces.white);
    const blackPieces = Object.values(pieces.black);
    
    if (currentPlayer === 'white') {
        return whitePieces.includes(piece);
    } else {
        return blackPieces.includes(piece);
    }
}

// Check if a king is in check
function isKingInCheck(player) {
    const kingSymbol = player === 'white' ? '♔' : '♚';
    let kingPos = null;
    
    // Find king position
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === kingSymbol) {
                kingPos = [row, col];
                break;
            }
        }
        if (kingPos) break;
    }
    
    if (!kingPos) return false;
    
    // Check if any opponent piece can attack the king
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && !isPieceOwnedByPlayer(piece, player)) {
                if (canPieceAttack(row, col, kingPos[0], kingPos[1])) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

function isPieceOwnedByPlayer(piece, player) {
    const whitePieces = Object.values(pieces.white);
    const blackPieces = Object.values(pieces.black);
    
    if (player === 'white') {
        return whitePieces.includes(piece);
    } else {
        return blackPieces.includes(piece);
    }
}

function canPieceAttack(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;

    switch(piece) {
        case '♙': // White pawn
            return Math.abs(colDiff) === 1 && rowDiff === -1;
        case '♟': // Black pawn
            return Math.abs(colDiff) === 1 && rowDiff === 1;
        case '♖': case '♜': // Rook
            return (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, toRow, toCol);
        case '♗': case '♝': // Bishop
            return Math.abs(rowDiff) === Math.abs(colDiff) && isPathClear(fromRow, fromCol, toRow, toCol);
        case '♕': case '♛': // Queen
            return (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) && 
                   isPathClear(fromRow, fromCol, toRow, toCol);
        case '♔': case '♚': // King
            return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        case '♘': case '♞': // Knight
            return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || 
                   (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
        default:
            return false;
    }
}

function wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol) {
    // Make temporary move
    const originalPiece = board[toRow][toCol];
    const movingPiece = board[fromRow][fromCol];
    board[toRow][toCol] = movingPiece;
    board[fromRow][fromCol] = '';
    
    // Check if king is in check after this move
    const inCheck = isKingInCheck(currentPlayer);
    
    // Restore board
    board[fromRow][fromCol] = movingPiece;
    board[toRow][toCol] = originalPiece;
    
    return inCheck;
}

function isValidMove(fromRow, fromCol, toRow, toCol) {
    if (fromRow === toRow && fromCol === toCol) return false;
    if (!board[fromRow][fromCol]) return false;
    
    const targetPiece = board[toRow][toCol];
    if (targetPiece && isPieceOwnedByCurrentPlayer(targetPiece)) return false;

    const piece = board[fromRow][fromCol];
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;

    // Check basic piece movement rules
    let validBasicMove = false;
    switch(piece) {
        case '♙': // White pawn
            if (colDiff === 0 && !targetPiece) {
                validBasicMove = (rowDiff === -1) || (fromRow === 6 && rowDiff === -2);
            } else if (Math.abs(colDiff) === 1 && rowDiff === -1 && targetPiece) {
                validBasicMove = true;
            }
            break;

        case '♟': // Black pawn
            if (colDiff === 0 && !targetPiece) {
                validBasicMove = (rowDiff === 1) || (fromRow === 1 && rowDiff === 2);
            } else if (Math.abs(colDiff) === 1 && rowDiff === 1 && targetPiece) {
                validBasicMove = true;
            }
            break;

        case '♖': case '♜': // Rook
            validBasicMove = (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, toRow, toCol);
            break;

        case '♗': case '♝': // Bishop
            validBasicMove = Math.abs(rowDiff) === Math.abs(colDiff) && isPathClear(fromRow, fromCol, toRow, toCol);
            break;

        case '♕': case '♛': // Queen
            validBasicMove = (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) && 
                   isPathClear(fromRow, fromCol, toRow, toCol);
            break;

        case '♔': case '♚': // King
            validBasicMove = Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
            break;

        case '♘': case '♞': // Knight
            validBasicMove = (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || 
                   (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
            break;

        default:
            validBasicMove = false;
    }
    
    // If basic move is invalid, return false
    if (!validBasicMove) return false;
    
    // Check if this move would leave the king in check
    return !wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol);
}

function isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
        if (board[currentRow][currentCol]) return false;
        currentRow += rowStep;
        currentCol += colStep;
    }
    
    return true;
}

function highlightPossibleMoves(row, col) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(row, col, r, c)) {
                const square = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                square.classList.add('possible-move');
            }
        }
    }
}

function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol];
    
    // Add to move history
    const moveNotation = `${piece} ${String.fromCharCode(97 + fromCol)}${8 - fromRow} → ${String.fromCharCode(97 + toCol)}${8 - toRow}`;
    moveHistory.push({
        from: [fromRow, fromCol],
        to: [toRow, toCol],
        piece: piece,
        captured: capturedPiece,
        notation: moveNotation
    });
    
    board[toRow][toCol] = board[fromRow][fromCol];
    board[fromRow][fromCol] = '';
    
    updateMoveHistory();
    createBoard();
}

function updateMoveHistory() {
    const moveList = document.getElementById('moveList');
    moveList.innerHTML = '';
    
    moveHistory.slice(-10).forEach((move, index) => {
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.textContent = `${moveHistory.length - 9 + index}. ${move.notation}`;
        moveList.appendChild(moveItem);
    });
    
    moveList.scrollTop = moveList.scrollHeight;
}

// Bot AI Functions
function getAllValidMoves(player) {
    const moves = [];
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = board[fromRow][fromCol];
            if (piece && isPieceOwnedByPlayer(piece, player)) {
                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        if (isValidMove(fromRow, fromCol, toRow, toCol)) {
                            moves.push({
                                from: [fromRow, fromCol],
                                to: [toRow, toCol],
                                piece: piece,
                                capture: board[toRow][toCol]
                            });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

// Simple opening book for black (hard mode)
const openingBook = [
    // e4 e5
    {white: [[6,4],[4,4]], black: [[1,4],[3,4]]},
    // d4 d5
    {white: [[6,3],[4,3]], black: [[1,3],[3,3]]},
    // Nf3 Nf6
    {white: [[7,6],[5,5]], black: [[0,6],[2,5]]},
    // Nc3 Nc6
    {white: [[7,1],[5,2]], black: [[0,1],[2,2]]}
];

function getOpeningMove() {
    // Only for first 4 moves, only for hard mode, only for black
    if (moveHistory.length % 2 !== 0 || moveHistory.length > 7) return null;
    for (const entry of openingBook) {
        if (moveHistory.length === 0 && board[6][4] === '' && board[4][4] === '♙') {
            // e4 e5
            return {from: [1,4], to: [3,4]};
        }
        if (moveHistory.length === 2 && board[6][3] === '' && board[4][3] === '♙') {
            // d4 d5
            return {from: [1,3], to: [3,3]};
        }
        if (moveHistory.length === 4 && board[7][6] === '' && board[5][5] === '♘') {
            // Nf3 Nf6
            return {from: [0,6], to: [2,5]};
        }
        if (moveHistory.length === 6 && board[7][1] === '' && board[5][2] === '♘') {
            // Nc3 Nc6
            return {from: [0,1], to: [2,2]};
        }
    }
    return null;
}

function evaluatePosition() {
    const pieceValues = {
        '♙': 1, '♟': -1,
        '♘': 3, '♞': -3,
        '♗': 3, '♝': -3,
        '♖': 5, '♜': -5,
        '♕': 9, '♛': -9,
        '♔': 1000, '♚': -1000
    };
    let score = 0;
    let whiteDeveloped = 0, blackDeveloped = 0;
    let whiteCenter = 0, blackCenter = 0;
    let whiteKingMoved = false, blackKingMoved = false;
    let whiteMobility = 0, blackMobility = 0;
    let whitePawns = 0, blackPawns = 0;
    let whiteDoubledPawns = 0, blackDoubledPawns = 0;
    // Center squares
    const centerSquares = [ [3,3], [3,4], [4,3], [4,4] ];
    // Pawn files for doubled pawn detection
    let pawnFiles = {white: Array(8).fill(0), black: Array(8).fill(0)};
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                score += pieceValues[piece] || 0;
                // Piece development bonus
                if (piece === '♘' && row < 7) whiteDeveloped++;
                if (piece === '♗' && row < 7) whiteDeveloped++;
                if (piece === '♞' && row > 0) blackDeveloped++;
                if (piece === '♝' && row > 0) blackDeveloped++;
                // Center control
                for (const [cr, cc] of centerSquares) {
                    if (row === cr && col === cc) {
                        if (pieceValues[piece] > 0) whiteCenter++;
                        if (pieceValues[piece] < 0) blackCenter++;
                    }
                }
                // King moved
                if (piece === '♔' && row !== 7 && col !== 4) whiteKingMoved = true;
                if (piece === '♚' && row !== 0 && col !== 4) blackKingMoved = true;
                // Pawn structure
                if (piece === '♙') { whitePawns++; pawnFiles.white[col]++; }
                if (piece === '♟') { blackPawns++; pawnFiles.black[col]++; }
            }
        }
    }
    // Mobility
    whiteMobility = getAllValidMoves('white').length;
    blackMobility = getAllValidMoves('black').length;
    // Doubled pawns
    whiteDoubledPawns = pawnFiles.white.filter(x => x > 1).length;
    blackDoubledPawns = pawnFiles.black.filter(x => x > 1).length;
    // Encourage development
    score += 0.5 * (whiteDeveloped - blackDeveloped);
    // Encourage center control
    score += 0.3 * (whiteCenter - blackCenter);
    // Encourage mobility
    score += 0.05 * (whiteMobility - blackMobility);
    // Penalize doubled pawns
    score -= 0.3 * whiteDoubledPawns;
    score += 0.3 * blackDoubledPawns;
    // Penalize early king moves
    if (whiteKingMoved) score -= 0.5;
    if (blackKingMoved) score += 0.5;
    // Penalize repeated moves (threefold repetition)
    if (moveHistory.length >= 4) {
        const last = moveHistory[moveHistory.length-1];
        const prev = moveHistory[moveHistory.length-3];
        if (last && prev && last.from[0] === prev.from[0] && last.from[1] === prev.from[1] && last.to[0] === prev.to[0] && last.to[1] === prev.to[1]) {
            if (currentPlayer === 'white') score -= 1;
            else score += 1;
        }
    }
    // Add positional bonuses
    if (isKingInCheck('white')) score -= 50;
    if (isKingInCheck('black')) score += 50;
    return score;
}

function evaluateMove(move) {
    const pieceValues = {
        '♙': 1, '♟': 1, '♘': 3, '♞': 3, '♗': 3, '♝': 3, 
        '♖': 5, '♜': 5, '♕': 9, '♛': 9, '♔': 100, '♚': 100
    };
    
    let score = 0;
    
    // Make temporary move
    const originalPiece = board[move.to[0]][move.to[1]];
    const movingPiece = board[move.from[0]][move.from[1]];
    board[move.to[0]][move.to[1]] = movingPiece;
    board[move.from[0]][move.from[1]] = '';
    
    // 1. Capture value
    if (originalPiece) {
        score += pieceValues[originalPiece] * 10;
    }
    
    // 2. Check if move puts opponent in check
    const opponentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    if (isKingInCheck(opponentPlayer)) {
        score += 15;
    }
    
    // 3. Check if move gets us out of check
    if (isInCheck && !isKingInCheck(currentPlayer)) {
        score += 20;
    }
    
    // 4. Center control bonus
    const [toRow, toCol] = move.to;
    if (toRow >= 3 && toRow <= 4 && toCol >= 3 && toCol <= 4) {
        score += 2;
    }
    
    // 5. Piece development (moving from starting position)
    const [fromRow, fromCol] = move.from;
    if (currentPlayer === 'white') {
        if ((movingPiece === '♘' || movingPiece === '♗') && fromRow === 7) score += 3;
        if (movingPiece === '♙' && fromRow === 6) score += 1;
    } else {
        if ((movingPiece === '♞' || movingPiece === '♝') && fromRow === 0) score += 3;
        if (movingPiece === '♟' && fromRow === 1) score += 1;
    }
    
    // 6. King safety - penalize moving king early
    if ((movingPiece === '♔' || movingPiece === '♚') && moveHistory.length < 10) {
        score -= 5;
    }
    
    // 7. Protect valuable pieces
    let pieceUnderAttack = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const enemyPiece = board[r][c];
            if (enemyPiece && !isPieceOwnedByPlayer(enemyPiece, currentPlayer)) {
                if (canPieceAttack(r, c, move.to[0], move.to[1])) {
                    pieceUnderAttack = true;
                    break;
                }
            }
        }
        if (pieceUnderAttack) break;
    }
    
    if (pieceUnderAttack) {
        score -= pieceValues[movingPiece] * 2;
    }
    
    // Restore board
    board[move.from[0]][move.from[1]] = movingPiece;
    board[move.to[0]][move.to[1]] = originalPiece;
    
    return score;
}

// Minimax for hard bot
function minimax(depth, isMaximizing, alpha, beta) {
    if (depth === 0) {
        return evaluatePosition();
    }
    const player = isMaximizing ? 'black' : 'white';
    const moves = getAllValidMoves(player);
    if (moves.length === 0) {
        // Checkmate or stalemate
        if (isKingInCheck(player)) {
            return isMaximizing ? -9999 : 9999;
        } else {
            return 0;
        }
    }
    let bestEval = isMaximizing ? -Infinity : Infinity;
    for (const move of moves) {
        // Make move
        const originalPiece = board[move.to[0]][move.to[1]];
        const movingPiece = board[move.from[0]][move.from[1]];
        board[move.to[0]][move.to[1]] = movingPiece;
        board[move.from[0]][move.from[1]] = '';
        const evalScore = minimax(depth - 1, !isMaximizing, alpha, beta);
        // Undo move
        board[move.from[0]][move.from[1]] = movingPiece;
        board[move.to[0]][move.to[1]] = originalPiece;
        if (isMaximizing) {
            bestEval = Math.max(bestEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        } else {
            bestEval = Math.min(bestEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
    }
    return bestEval;
}

// Stockfish integration for hard bot
let stockfishWorker = null;
function initStockfish() {
    if (stockfishWorker || stockfishError) return;
    try {
        stockfishWorker = new Worker('stockfish.js');
    } catch (e) {
        stockfishError = true;
    }
}
function getStockfishMove(fen, callback) {
    initStockfish();
    if (stockfishError || !stockfishWorker) {
        callback(null);
        return;
    }
    let received = false;
    let errorTimeout = setTimeout(() => {
        if (!received) {
            stockfishError = true;
            callback(null);
        }
    }, 2000);
    stockfishWorker.onmessage = function(event) {
        const line = event.data;
        if (typeof line === 'string' && line.startsWith('bestmove')) {
            const parts = line.split(' ');
            if (parts[1] && parts[1] !== '(none)') {
                received = true;
                clearTimeout(errorTimeout);
                callback(parts[1]);
            }
        }
    };
    try {
        stockfishWorker.postMessage('ucinewgame');
        stockfishWorker.postMessage('position fen ' + fen);
        stockfishWorker.postMessage('go depth 10');
    } catch (e) {
        stockfishError = true;
        clearTimeout(errorTimeout);
        callback(null);
    }
}
// Convert board to FEN
function boardToFEN() {
    let fen = '';
    for (let row = 0; row < 8; row++) {
        let empty = 0;
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) {
                empty++;
            } else {
                if (empty > 0) { fen += empty; empty = 0; }
                switch (piece) {
                    case '♙': fen += 'P'; break;
                    case '♟': fen += 'p'; break;
                    case '♖': fen += 'R'; break;
                    case '♜': fen += 'r'; break;
                    case '♘': fen += 'N'; break;
                    case '♞': fen += 'n'; break;
                    case '♗': fen += 'B'; break;
                    case '♝': fen += 'b'; break;
                    case '♕': fen += 'Q'; break;
                    case '♛': fen += 'q'; break;
                    case '♔': fen += 'K'; break;
                    case '♚': fen += 'k'; break;
                }
            }
        }
        if (empty > 0) fen += empty;
        if (row < 7) fen += '/';
    }
    fen += ' ' + (currentPlayer === 'white' ? 'w' : 'b');
    fen += ' - - 0 1'; // Simplified: no castling/en passant
    return fen;
}

function showStockfishInstructions() {
    const status = document.getElementById('gameStatus');
    status.innerHTML = `26a0 Stockfish engine not found or not running.<br>
    <b>To enable a strong hard bot:</b><br>
    1. <a href='https://github.com/niklasf/stockfish.js' target='_blank'>Download stockfish.js</a> (real engine, not a placeholder).<br>
    2. Place it in your <code>CHESS/</code> directory.<br>
    3. <b>Run your site from a local server</b> (not file://).<br>
    4. Refresh this page.<br>
    <i>When Stockfish is working, the hard bot will play at a real 1500+ level or higher.</i>`;
}

function makeBotMove() {
    if (playMode === 'human' || currentPlayer === 'white' || botThinking) return;
    botThinking = true;
    const statusElement = document.getElementById('gameStatus');
    statusElement.textContent = '🤖 Bot is thinking...';
    setTimeout(() => {
        if (playMode === 'bot-hard') {
            if (stockfishError) {
                showStockfishInstructions();
                makeBotMoveFallback();
                return;
            }
            const fen = boardToFEN();
            getStockfishMove(fen, function(bestmove) {
                if (bestmove && bestmove.length >= 4) {
                    const fromCol = bestmove.charCodeAt(0) - 97;
                    const fromRow = 8 - parseInt(bestmove[1]);
                    const toCol = bestmove.charCodeAt(2) - 97;
                    const toRow = 8 - parseInt(bestmove[3]);
                    const capturedPiece = board[toRow][toCol];
                    makeMove(fromRow, fromCol, toRow, toCol);
                    if (capturedPiece) {
                        playSound('capture');
                    } else {
                        playSound('move');
                    }
                    botThinking = false;
                    switchPlayer();
                    checkGameEnd();
                } else {
                    showStockfishInstructions();
                    makeBotMoveFallback();
                }
            });
            return;
        }
        makeBotMoveFallback();
    }, 1000);
}
function makeBotMoveFallback() {
    const moves = getAllValidMoves('black');
    if (moves.length === 0) {
        endGame('🎉 White Wins! Black has no valid moves!');
        botThinking = false;
        return;
    }
    // Prevent bot from repeating the last move (no immediate undo)
    let filteredMoves = moves;
    if (moveHistory.length > 0) {
        const lastMove = moveHistory[moveHistory.length - 1];
        filteredMoves = moves.filter(move => {
            return !(move.from[0] === lastMove.to[0] && move.from[1] === lastMove.to[1] && move.to[0] === lastMove.from[0] && move.to[1] === lastMove.from[1]);
        });
        if (filteredMoves.length === 0) filteredMoves = moves;
    }
    let bestMove;
    let moveFound = false;
    if (playMode === 'bot-easy') {
        bestMove = filteredMoves[Math.floor(Math.random() * filteredMoves.length)];
        moveFound = true;
    } else if (playMode === 'bot-medium') {
        // Prefer captures, avoid immediate loss
        let safeMoves = [];
        for (const move of filteredMoves) {
            const originalPiece = board[move.to[0]][move.to[1]];
            const movingPiece = board[move.from[0]][move.from[1]];
            board[move.to[0]][move.to[1]] = movingPiece;
            board[move.from[0]][move.from[1]] = '';
            let isSafe = true;
            const opponentMoves = getAllValidMoves('white');
            for (const oppMove of opponentMoves) {
                if (oppMove.to[0] === move.to[0] && oppMove.to[1] === move.to[1]) {
                    isSafe = false;
                    break;
                }
            }
            board[move.from[0]][move.from[1]] = movingPiece;
            board[move.to[0]][move.to[1]] = originalPiece;
            if (isSafe) safeMoves.push(move);
        }
        const captureMoves = safeMoves.filter(move => move.capture);
        if (captureMoves.length > 0) {
            bestMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
            moveFound = true;
        } else if (safeMoves.length > 0) {
            bestMove = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            moveFound = true;
        } else {
            bestMove = filteredMoves[Math.floor(Math.random() * filteredMoves.length)];
            moveFound = true;
        }
    } else {
        // Hard fallback: minimax 2-ply with timeout failsafe
        let bestScore = -Infinity;
        let start = Date.now();
        for (const move of filteredMoves) {
            if (Date.now() - start > 1000) break; // Failsafe: break if too slow
            const originalPiece = board[move.to[0]][move.to[1]];
            const movingPiece = board[move.from[0]][move.from[1]];
            board[move.to[0]][move.to[1]] = movingPiece;
            board[move.from[0]][move.from[1]] = '';
            const score = minimax(2, false, -Infinity, Infinity);
            board[move.from[0]][move.from[1]] = movingPiece;
            board[move.to[0]][move.to[1]] = originalPiece;
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                moveFound = true;
            }
        }
        if (!moveFound) {
            bestMove = filteredMoves[Math.floor(Math.random() * filteredMoves.length)];
        }
    }
    const capturedPiece = board[bestMove.to[0]][bestMove.to[1]];
    makeMove(bestMove.from[0], bestMove.from[1], bestMove.to[0], bestMove.to[1]);
    if (capturedPiece) {
        playSound('capture');
    } else {
        playSound('move');
    }
    botThinking = false;
    switchPlayer();
    checkGameEnd();
}

function switchPlayer() {
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    const playerElement = document.getElementById('currentPlayer');
    const avatarElement = document.getElementById('currentPlayerAvatar');
    
    // Check for check status
    isInCheck = isKingInCheck(currentPlayer);
    
    if (currentPlayer === 'white') {
        playerElement.textContent = isInCheck ? "White's Turn (CHECK!)" : "White's Turn";
        avatarElement.textContent = '♔';
    } else {
        playerElement.textContent = isInCheck ? "Black's Turn (CHECK!)" : "Black's Turn";
        avatarElement.textContent = '♚';
    }
    
    // Update status message
    const statusElement = document.getElementById('gameStatus');
    if (isInCheck) {
        statusElement.textContent = `⚠️ ${currentPlayer === 'white' ? 'White' : 'Black'} King is in CHECK! You must move to safety!`;
        statusElement.style.background = 'linear-gradient(45deg, #ff6b6b, #ffa500)';
        statusElement.style.color = 'white';
        playSound('capture'); // Play warning sound for check
    } else {
        statusElement.textContent = '🎯 Make your move! Click a piece to select it, then click where you want to move.';
        statusElement.style.background = 'var(--glass-bg)';
        statusElement.style.color = 'var(--text-primary)';
    }
    
    startTimer();
    
    // Make bot move if it's bot's turn
    if (playMode !== 'human' && currentPlayer === 'black') {
        makeBotMove();
    }
}

function startTimer() {
    if (gameMode === 'classic') return;
    
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (currentPlayer === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                endGame('🎉 Black wins by timeout!');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                endGame('🎉 White wins by timeout!');
                return;
            }
        }
        
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const whiteTimerElement = document.getElementById('whiteTimer');
    const blackTimerElement = document.getElementById('blackTimer');
    
    // Update white timer
    if (whiteTime === Infinity) {
        whiteTimerElement.textContent = '∞';
    } else {
        const whiteMinutes = Math.floor(whiteTime / 60);
        const whiteSeconds = whiteTime % 60;
        whiteTimerElement.textContent = `${whiteMinutes}:${whiteSeconds.toString().padStart(2, '0')}`;
        
        // Highlight active player's timer
        if (currentPlayer === 'white') {
            whiteTimerElement.style.color = 'var(--accent)';
            whiteTimerElement.style.textShadow = '0 0 10px var(--accent)';
            whiteTimerElement.style.fontWeight = 'bold';
        } else {
            whiteTimerElement.style.color = 'var(--text-primary)';
            whiteTimerElement.style.textShadow = 'none';
            whiteTimerElement.style.fontWeight = 'normal';
        }
    }
    
    // Update black timer
    if (blackTime === Infinity) {
        blackTimerElement.textContent = '∞';
    } else {
        const blackMinutes = Math.floor(blackTime / 60);
        const blackSeconds = blackTime % 60;
        blackTimerElement.textContent = `${blackMinutes}:${blackSeconds.toString().padStart(2, '0')}`;
        
        // Highlight active player's timer
        if (currentPlayer === 'black') {
            blackTimerElement.style.color = 'var(--accent)';
            blackTimerElement.style.textShadow = '0 0 10px var(--accent)';
            blackTimerElement.style.fontWeight = 'bold';
        } else {
            blackTimerElement.style.color = 'var(--text-primary)';
            blackTimerElement.style.textShadow = 'none';
            blackTimerElement.style.fontWeight = 'normal';
        }
    }
}

function checkGameEnd() {
    // Check if current player has any valid moves
    const validMoves = getAllValidMoves(currentPlayer);
    
    if (validMoves.length === 0) {
        if (isKingInCheck(currentPlayer)) {
            // Checkmate
            const winner = currentPlayer === 'white' ? 'Black' : 'White';
            endGame(`🎉 ${winner} Wins by Checkmate!`);
        } else {
            // Stalemate
            endGame('🤝 Game ends in Stalemate! It\'s a draw!');
        }
        return;
    }
    
    // Check for king capture (shouldn't happen with proper check rules, but just in case)
    let whiteKing = false, blackKing = false;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === '♔') whiteKing = true;
            if (board[row][col] === '♚') blackKing = true;
        }
    }

    if (!whiteKing) {
        endGame('🎉 Black Wins! The White King has been captured!');
    } else if (!blackKing) {
        endGame('🎉 White Wins! The Black King has been captured!');
    }
}

function endGame(message) {
    gameOver = true;
    clearInterval(timerInterval);
    
    const statusElement = document.getElementById('gameStatus');
    statusElement.textContent = message;
    statusElement.classList.add('winner');
    
    playSound('win');
    
    // Create celebration particles
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            createExplosion(x, y);
        }, i * 100);
    }
}

function resetGame() {
    board = [
        ['♜','♞','♝','♛','♚','♝','♞','♜'],
        ['♟','♟','♟','♟','♟','♟','♟','♟'],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['♙','♙','♙','♙','♙','♙','♙','♙'],
        ['♖','♘','♗','♕','♔','♗','♘','♖']
    ];
    
    currentPlayer = 'white';
    selectedSquare = null;
    gameOver = false;
    moveHistory = [];
    isInCheck = false;
    botThinking = false;
    
    // Reset timers based on game mode
    switch(gameMode) {
        case 'blitz':
            whiteTime = blackTime = 300; // 5 minutes
            break;
        case 'rapid':
            whiteTime = blackTime = 600; // 10 minutes
            break;
        case 'bullet':
            whiteTime = blackTime = 180; // 3 minutes
            break;
        case 'correspondence':
            whiteTime = blackTime = 86400; // 1 day
            break;
        default:
            whiteTime = blackTime = Infinity;
    }
    
    clearInterval(timerInterval);
    
    document.getElementById('currentPlayer').textContent = "White's Turn";
    document.getElementById('currentPlayerAvatar').textContent = '♔';
    const statusElement = document.getElementById('gameStatus');
    statusElement.textContent = '🎯 Make your move! Click a piece to select it, then click where you want to move.';
    statusElement.classList.remove('winner');
    statusElement.style.background = 'var(--glass-bg)';
    statusElement.style.color = 'var(--text-primary)';
    document.getElementById('moveList').innerHTML = '';
    
    updateTimerDisplay();
    createBoard();
}

function changePlayMode() {
    playMode = document.getElementById('playMode').value;
    resetGame();
}

function undoMove() {
    if (moveHistory.length === 0) return;
    
    const lastMove = moveHistory.pop();
    board[lastMove.from[0]][lastMove.from[1]] = lastMove.piece;
    board[lastMove.to[0]][lastMove.to[1]] = lastMove.captured || '';
    
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    switchPlayer();
    updateMoveHistory();
    createBoard();
}

function changeTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const soundToggle = document.getElementById('soundToggle');
    soundToggle.textContent = soundEnabled ? '🔊 ON' : '🔇 OFF';
}

function changeGameMode() {
    gameMode = document.getElementById('gameMode').value;
    resetGame();
}

function showHint() {
    if (gameOver || (playMode !== 'human' && currentPlayer === 'black')) return;
    
    // Clear previous hints
    clearHints();
    
    const validMoves = getAllValidMoves(currentPlayer);
    if (validMoves.length === 0) return;
    
    // Evaluate all moves and pick the best one
    let bestMove = validMoves[0];
    let bestScore = -Infinity;
    
    for (const move of validMoves) {
        const score = evaluateMove(move);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    // Highlight the hint
    currentHint = bestMove;
    const fromSquare = document.querySelector(`[data-row="${bestMove.from[0]}"][data-col="${bestMove.from[1]}"]`);
    const toSquare = document.querySelector(`[data-row="${bestMove.to[0]}"][data-col="${bestMove.to[1]}"]`);
    
    fromSquare.classList.add('hint-from');
    toSquare.classList.add('hint-to');
    
    // Update status with hint message
    const statusElement = document.getElementById('gameStatus');
    const originalStatus = statusElement.textContent;
    
    let hintMessage = '💡 Hint: ';
    
    // Make temporary move to analyze the hint
    const originalPiece = board[bestMove.to[0]][bestMove.to[1]];
    const movingPiece = board[bestMove.from[0]][bestMove.from[1]];
    board[bestMove.to[0]][bestMove.to[1]] = movingPiece;
    board[bestMove.from[0]][bestMove.from[1]] = '';
    
    const opponentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    const putsInCheck = isKingInCheck(opponentPlayer);
    
    // Restore board
    board[bestMove.from[0]][bestMove.from[1]] = movingPiece;
    board[bestMove.to[0]][bestMove.to[1]] = originalPiece;
    
    if (isInCheck) {
        hintMessage += 'Get your king to safety!';
    } else if (bestMove.capture) {
        const pieceNames = {
            '♙': 'pawn', '♟': 'pawn', '♘': 'knight', '♞': 'knight',
            '♗': 'bishop', '♝': 'bishop', '♖': 'rook', '♜': 'rook',
            '♕': 'queen', '♛': 'queen', '♔': 'king', '♚': 'king'
        };
        hintMessage += `Capture the ${pieceNames[bestMove.capture] || 'piece'}!`;
    } else if (putsInCheck) {
        hintMessage += 'Put the opponent in check!';
    } else if (bestScore >= 3) {
        hintMessage += 'Great tactical move!';
    } else if (bestScore >= 1) {
        hintMessage += 'Good positional play!';
    } else {
        hintMessage += 'Develop your pieces!';
    }
    
    statusElement.textContent = hintMessage;
    statusElement.style.background = 'linear-gradient(45deg, #ffd700, #ffa500)';
    statusElement.style.color = 'white';
    
    // Clear hint after 5 seconds
    setTimeout(() => {
        clearHints();
        statusElement.textContent = originalStatus;
        statusElement.style.background = 'var(--glass-bg)';
        statusElement.style.color = 'var(--text-primary)';
    }, 5000);
    
    playSound('select');
}

function clearHints() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('hint-from', 'hint-to');
    });
    currentHint = null;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Initialize the game
createParticles();
createBoard();
updateTimerDisplay(); 