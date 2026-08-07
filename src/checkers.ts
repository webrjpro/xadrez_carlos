export type PieceColor = 'w' | 'b';
export type PieceType = 'm' | 'k'; // man or king

export interface Piece {
  color: PieceColor;
  type: PieceType;
}

export interface Move {
  from: string;
  to: string;
  captured?: string[]; // squares of captured pieces
}

export class Checkers {
  board: (Piece | null)[][];
  currentTurn: PieceColor;
  history: any[];

  constructor() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.currentTurn = 'w';
    this.history = [];
    this.reset();
  }

  reset() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) this.board[r][c] = { color: 'b', type: 'm' };
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) this.board[r][c] = { color: 'w', type: 'm' };
      }
    }
    this.currentTurn = 'w';
    this.history = [];
  }

  turn() {
    return this.currentTurn;
  }

  get(square: string): Piece | null {
    const { r, c } = this.sqToRc(square);
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  sqToRc(sq: string) {
    const c = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1]);
    return { r, c };
  }

  rcToSq(r: number, c: number) {
    return String.fromCharCode(97 + c) + (8 - r);
  }

  // Simplified Brazilian rules move generation
  getValidMoves(player: PieceColor = this.currentTurn): Move[] {
    let moves: Move[] = [];
    let captures: Move[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === player) {
          const sq = this.rcToSq(r, c);
          const pieceCaps = this.getCapturesForPiece(r, c, p);
          captures.push(...pieceCaps);
          
          if (captures.length === 0) {
            const pieceMoves = this.getNormalMovesForPiece(r, c, p);
            moves.push(...pieceMoves);
          }
        }
      }
    }

    if (captures.length > 0) {
      let maxCaps = 0;
      for (const cap of captures) {
        if (cap.captured && cap.captured.length > maxCaps) maxCaps = cap.captured.length;
      }
      return captures.filter(cap => cap.captured && cap.captured.length === maxCaps);
    }

    return moves;
  }

  getNormalMovesForPiece(r: number, c: number, p: Piece): Move[] {
    const moves: Move[] = [];
    const sq = this.rcToSq(r, c);
    
    if (p.type === 'm') {
      const dirs = p.color === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (this.isValidEmpty(nr, nc)) {
          moves.push({ from: sq, to: this.rcToSq(nr, nc) });
        }
      }
    } else {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (this.isValidEmpty(nr, nc)) {
          moves.push({ from: sq, to: this.rcToSq(nr, nc) });
          nr += dr;
          nc += dc;
        }
      }
    }
    return moves;
  }

  getCapturesForPiece(r: number, c: number, p: Piece, currentPath: string[] = [], visited: Set<string> = new Set()): Move[] {
    const captures: Move[] = [];
    const sq = this.rcToSq(r, c);
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    if (p.type === 'm') {
      for (const [dr, dc] of dirs) {
        const jumpR = r + dr * 2;
        const jumpC = c + dc * 2;
        const capR = r + dr;
        const capC = c + dc;
        
        if (this.isValid(jumpR, jumpC) && this.isValid(capR, capC)) {
          const capSq = this.rcToSq(capR, capC);
          const capPiece = this.board[capR][capC];
          
          if (!visited.has(capSq) && capPiece && capPiece.color !== p.color && this.board[jumpR][jumpC] === null) {
            const newVisited = new Set(visited);
            newVisited.add(capSq);
            const newPath = [...currentPath, capSq];
            
            const originalDest = this.board[jumpR][jumpC];
            this.board[jumpR][jumpC] = p;
            this.board[r][c] = null;
            
            const furtherCaptures = this.getCapturesForPiece(jumpR, jumpC, p, newPath, newVisited);
            
            this.board[r][c] = p;
            this.board[jumpR][jumpC] = originalDest;
            
            if (furtherCaptures.length > 0) {
              for (const fc of furtherCaptures) {
                captures.push({ from: sq, to: fc.to, captured: fc.captured });
              }
            } else {
              captures.push({ from: sq, to: this.rcToSq(jumpR, jumpC), captured: newPath });
            }
          }
        }
      }
    } else {
      for (const [dr, dc] of dirs) {
        let capR = r + dr;
        let capC = c + dc;
        let foundEnemySq: string | null = null;
        
        while (this.isValid(capR, capC)) {
          const pSq = this.rcToSq(capR, capC);
          const cp = this.board[capR][capC];
          
          if (cp) {
            if (cp.color === p.color || visited.has(pSq)) break; 
            if (foundEnemySq) break; 
            foundEnemySq = pSq;
          } else if (foundEnemySq) {
            const newVisited = new Set(visited);
            newVisited.add(foundEnemySq);
            const newPath = [...currentPath, foundEnemySq];
            
            const originalDest = this.board[capR][capC];
            this.board[capR][capC] = p;
            this.board[r][c] = null;
            
            const furtherCaptures = this.getCapturesForPiece(capR, capC, p, newPath, newVisited);
            
            this.board[r][c] = p;
            this.board[capR][capC] = originalDest;
            
            if (furtherCaptures.length > 0) {
              for (const fc of furtherCaptures) {
                captures.push({ from: sq, to: fc.to, captured: fc.captured });
              }
            } else {
              captures.push({ from: sq, to: this.rcToSq(capR, capC), captured: newPath });
            }
          }
          capR += dr;
          capC += dc;
        }
      }
    }
    return captures;
  }

  isValid(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  isValidEmpty(r: number, c: number) {
    return this.isValid(r, c) && this.board[r][c] === null;
  }

  move(moveQuery: { from: string, to: string }) {
    const validMoves = this.getValidMoves();
    const move = validMoves.find(m => m.from === moveQuery.from && m.to === moveQuery.to);
    
    if (!move) return false;

    const fromRc = this.sqToRc(move.from);
    const toRc = this.sqToRc(move.to);
    const p = this.board[fromRc.r][fromRc.c]!;
    
    this.board[toRc.r][toRc.c] = p;
    this.board[fromRc.r][fromRc.c] = null;
    
    if (move.captured) {
      for (const capSq of move.captured) {
        const capRc = this.sqToRc(capSq);
        this.board[capRc.r][capRc.c] = null;
      }
    }
    
    if (p.type === 'm') {
      if ((p.color === 'w' && toRc.r === 0) || (p.color === 'b' && toRc.r === 7)) {
        p.type = 'k';
      }
    }
    
    this.history.push(move);
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
    return true;
  }
  
  moves(options: { square?: string } = {}) {
     const valid = this.getValidMoves();
     if (options.square) return valid.filter(m => m.from === options.square).map(m => m.to);
     return valid.map(m => m.to);
  }

  isGameOver() {
    return this.getValidMoves('w').length === 0 || this.getValidMoves('b').length === 0;
  }
  
  // Basic AI Evaluation
  evaluate(color: PieceColor): number {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) {
          const val = p.type === 'k' ? 30 : 10;
          if (p.color === color) score += val;
          else score -= val;
        }
      }
    }
    return score;
  }

  // Clone state for AI
  clone(): Checkers {
    const clone = new Checkers();
    clone.currentTurn = this.currentTurn;
    clone.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    return clone;
  }

  // Minimax with Alpha-Beta
  minimax(depth: number, alpha: number, beta: number, maximizingPlayer: boolean, aiColor: PieceColor): number {
    if (depth === 0 || this.isGameOver()) {
      return this.evaluate(aiColor);
    }

    const moves = this.getValidMoves();
    
    if (maximizingPlayer) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const temp = this.clone();
        temp.move(move);
        const evalScore = temp.minimax(depth - 1, alpha, beta, false, aiColor);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const temp = this.clone();
        temp.move(move);
        const evalScore = temp.minimax(depth - 1, alpha, beta, true, aiColor);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  getBestMove(depth: number = 4): Move | null {
    const moves = this.getValidMoves();
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0]; // Forced move

    let bestMove: Move | null = null;
    let maxEval = -Infinity;
    const aiColor = this.currentTurn;

    // Small randomization to vary opening moves
    moves.sort(() => Math.random() - 0.5);

    for (const move of moves) {
      const temp = this.clone();
      temp.move(move);
      const evalScore = temp.minimax(depth - 1, -Infinity, Infinity, false, aiColor);
      
      if (evalScore > maxEval) {
        maxEval = evalScore;
        bestMove = move;
      }
    }

    return bestMove;
  }
}
