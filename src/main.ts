import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Chess } from 'chess.js';
import { Checkers } from './checkers';
import gsap from 'gsap';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

// Setup DOM
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="game-canvas"></canvas>
  <div id="ui-layer">
    <div id="loading-screen" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 100; background: var(--bg-dark); gap: 1.5rem;">
      <h1 style="color: var(--accent); font-family: 'Playfair Display', serif;">Carregando Modelos 3D...</h1>
      <div style="width: 280px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
        <div id="loading-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #d4af37, #fcd34d); border-radius: 3px; transition: width 0.3s ease;"></div>
      </div>
      <span id="loading-percent" style="color: var(--text-muted); font-size: 0.9rem;">0%</span>
    </div>
    
    <header>
      <div class="logo-area">
        <div class="logo-icon">♔</div>
        <div class="logo-text">
          <h1>Grandmaster 3D</h1>
          <p>Xadrez real • motor local</p>
        </div>
      </div>
      <div class="status-indicator">
        <div class="dot"></div>
        <span>Motor local pronto</span>
      </div>
      <button id="menu-btn">☰</button>
    </header>

    <div class="main-content">
      <aside class="right-panel" id="right-panel">
        <button id="close-menu-btn">&times;</button>
        <div class="panel-header">
          <h3>Partida</h3>
          <h2 id="turn-title">Sua vez</h2>
          <p id="turn-subtitle">Brancas jogam.</p>
          <div class="clocks-container">
            <div class="clock active" id="clock-w">
              <span class="label">Brancas</span>
              <span class="time">10:00</span>
            </div>
            <div class="clock" id="clock-b">
              <span class="label">Pretas</span>
              <span class="time">10:00</span>
            </div>
          </div>
        </div>
        
        <div class="divider"></div>

        <div class="section-label">Jogo</div>
        <div class="segmented-control" id="game-control">
          <button class="seg-btn active" data-game="chess">Xadrez</button>
          <button class="seg-btn" data-game="checkers">Damas</button>
        </div>
        
        <div class="section-label">Modo</div>
        <div class="segmented-control" id="mode-control">
          <button class="seg-btn active" data-mode="ai">Contra IA</button>
          <button class="seg-btn" data-mode="friend">Contra Amigo</button>
          <button class="seg-btn" data-mode="online">Online</button>
        </div>

        <div id="online-panel" style="display: none; margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
          <div style="margin-bottom: 10px;">
            <button class="btn-secondary" id="btn-host" style="width: 100%;">Criar Sala (Host)</button>
          </div>
          <div style="display: flex; gap: 5px;">
            <input type="text" id="input-join" placeholder="Código" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-light); text-transform: uppercase;">
            <button class="btn-secondary" id="btn-join">Entrar</button>
          </div>
          <p id="online-status" style="margin-top: 10px; font-size: 12px; color: var(--text-dim); text-align: center;">Desconectado</p>
        </div>
        
        <div class="section-label" id="diff-label">Dificuldade</div>
        <div class="segmented-control" id="diff-control">
          <button class="seg-btn" data-diff="amador">Amador</button>
          <button class="seg-btn active" data-diff="semi">Semiprofissional</button>
          <button class="seg-btn" data-diff="pro">Profissional</button>
        </div>
        
        <div class="section-label">Você joga com</div>
        <div class="segmented-control" id="color-control">
          <button class="seg-btn active" data-color="w">Brancas</button>
          <button class="seg-btn" data-color="b">Pretas</button>
          <button class="seg-btn" data-color="r">Aleatório</button>
        </div>
        
        <button class="btn-primary" id="btn-new">Nova partida</button>
        
        <div class="secondary-actions">
          <button class="btn-secondary" id="btn-undo">↶ Desfazer</button>
          <button class="btn-secondary" id="btn-flip">↺ Virar</button>
        </div>
        
        <div class="divider"></div>
        
        <div class="history-header">
          <span class="section-label" style="margin:0;">Histórico</span>
          <button class="btn-small" id="btn-pgn">Copiar PGN</button>
        </div>
        <div class="history-list" id="history-list">Nenhum lance ainda.</div>
      </aside>
    </div>
    
    <button id="btn-lock-camera" class="btn-lock-camera" title="Travar Câmera">🔓 Travar Câmera</button>
    <footer>Arraste para girar • roda do mouse para zoom • clique para jogar</footer>
    <div id="alert-center" class="alert-center"></div>
  </div>
`;

// Three.js Setup
const isMobile = window.innerWidth <= 768;
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: !isMobile, // Desliga antialias no celular
    powerPreference: isMobile ? "low-power" : "default",
    precision: isMobile ? "mediump" : "highp" // Usa precisão menor de shader no celular
  });
} catch (e) {
  document.getElementById('loading-screen')!.innerHTML = `
    <div style="text-align: center; padding: 2.5rem; max-width: 450px; margin: 0 auto; background: var(--bg-panel); border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
      <div style="font-size: 3.5rem; margin-bottom: 1rem;">⚙️</div>
      <h2 style="font-family: 'Playfair Display', serif; color: var(--accent); margin-bottom: 1rem; font-size: 1.8rem;">Ajuste Necessário</h2>
      <p style="color: var(--text-main); font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem;">
        Para rodar os gráficos 3D incríveis do jogo, o seu navegador precisa de uma pequena permissão chamada <b>Aceleração de Hardware</b>.
      </p>
      <div style="background: var(--bg-input); padding: 1rem; border-radius: 10px; text-align: left; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.05);">
        <b>Como ativar rápido:</b><br><br>
        1. Vá nas <b>Configurações</b> do seu navegador.<br>
        2. Busque por <b>"Sistema e Desempenho"</b>.<br>
        3. Ative <b>"Usar aceleração de hardware"</b>.<br>
        4. Clique em reiniciar e volte aqui!
      </div>
      <button onclick="location.reload()" style="background: var(--accent); color: #000; border: none; border-radius: 10px; padding: 0.8rem 2rem; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; transition: opacity 0.2s;">Tentar Novamente</button>
    </div>
  `;
  throw e;
}
renderer.setSize(window.innerWidth, window.innerHeight);
// Força pixelRatio 1 no mobile (salva MUITA memória RAM de vídeo)
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
// Sombra apenas em telas maiores
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1115);

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4, 8, 12);
scene.add(camera);

function updateCameraOffset() {
  // Mobile / Tablet usa breakpoint 1024
  if (window.innerWidth > 1024) {
    // Shift the projection 190px right, which moves the scene 190px left
    // to avoid the 400px wide UI panel on the right.
    camera.setViewOffset(window.innerWidth, window.innerHeight, 200, 0, window.innerWidth, window.innerHeight);
  } else {
    camera.clearViewOffset();
  }
}
updateCameraOffset();

// Add a light attached to the camera so pieces are always visible from any angle
const cameraLight = new THREE.PointLight(0xffffff, 1.2, 50);
cameraLight.position.set(0, 2, 0); // slightly above the camera
camera.add(cameraLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.6; // Reduzido para ficar mais fácil no touch/tablet
controls.target.set(4, 0, 4); // Center of 8x8 board
controls.update();

const btnLock = document.getElementById('btn-lock-camera')!;
let cameraLocked = false;
btnLock.addEventListener('click', () => {
  cameraLocked = !cameraLocked;
  controls.enabled = !cameraLocked;
  if (cameraLocked) {
    btnLock.innerHTML = '🔒 Câmera Travada';
    btnLock.style.background = 'rgba(212, 175, 55, 0.2)';
  } else {
    btnLock.innerHTML = '🔓 Travar Câmera';
    btnLock.style.background = 'rgba(20,20,20,0.8)';
  }
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased ambient
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 12, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// Add a subtle rim light for the black pieces
const backLight = new THREE.DirectionalLight(0xaaccff, 0.8);
backLight.position.set(-5, 5, -5);
scene.add(backLight);

// Luxury Board Generation
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const squareSize = 1;

// Gerador de textura processual de mármore leve
function createMarbleTexture(baseColor: string, veinColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);
  
  for (let i = 0; i < 300; i++) {
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = veinColor;
    ctx.lineWidth = Math.random() * 1.5;
    ctx.globalAlpha = Math.random() * 0.4;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

const darkMarbleTex = createMarbleTexture('#0a0a0a', '#333333');
const lightMarbleTex = createMarbleTexture('#e8e3d9', '#b5a38c');

const darkMat = new THREE.MeshPhysicalMaterial({ 
  map: darkMarbleTex, color: 0x111111, metalness: 0.1, roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.1 
});
const lightMat = new THREE.MeshPhysicalMaterial({ 
  map: lightMarbleTex, color: 0xffffff, metalness: 0.1, roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.1 
});
const borderMat = new THREE.MeshPhysicalMaterial({ 
  color: 0x050505, metalness: 0.3, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05 
});
const goldMat = new THREE.MeshStandardMaterial({
  color: 0xd4af37, metalness: 1.0, roughness: 0.2
});

// Base do Tabuleiro (Laca Preta)
const borderGeom = new THREE.BoxGeometry(9.2, 0.6, 9.2);
const borderMesh = new THREE.Mesh(borderGeom, borderMat);
borderMesh.position.set(4, -0.3, 4);
borderMesh.receiveShadow = true;
boardGroup.add(borderMesh);

// Frisos Dourados (Ouro Metálico)
const goldThickness = 0.08;
const trimGeom1 = new THREE.BoxGeometry(8.8, 0.2, goldThickness);
const trimN = new THREE.Mesh(trimGeom1, goldMat); trimN.position.set(4, 0.05, -0.44);
const trimS = new THREE.Mesh(trimGeom1, goldMat); trimS.position.set(4, 0.05, 8.44);

const trimGeom2 = new THREE.BoxGeometry(goldThickness, 0.2, 8.8 + goldThickness * 2);
const trimE = new THREE.Mesh(trimGeom2, goldMat); trimE.position.set(8.44, 0.05, 4);
const trimW = new THREE.Mesh(trimGeom2, goldMat); trimW.position.set(-0.44, 0.05, 4);
boardGroup.add(trimN, trimS, trimE, trimW);

// Casas de Mármore
const boardGeometry = new THREE.BoxGeometry(squareSize, 0.2, squareSize);

for (let rank = 0; rank < 8; rank++) {
  for (let file = 0; file < 8; file++) {
    const isDark = (rank + file) % 2 !== 0;
    const mesh = new THREE.Mesh(boardGeometry, isDark ? darkMat : lightMat);
    mesh.position.set(file + 0.5, 0.1, rank + 0.5);
    mesh.receiveShadow = true;
    boardGroup.add(mesh);
  }
}

// Logic
const chess = new Chess();
const checkers = new Checkers();

let isPlaying = false;
let playerColor = 'w';
let currentDifficulty = 'semi';
let gameMode = 'ai';
let activeGame: 'chess' | 'checkers' = 'chess';

const engine = new Worker(import.meta.env.BASE_URL + 'stockfish.js');
engine.postMessage('uci');
engine.postMessage('isready');

engine.onmessage = function (event) {
  const line = event.data;
  console.log('Stockfish:', line);
  if (line.startsWith('bestmove')) {
    const match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
    if (match) {
      const from = match[1];
      const to = match[2];
      const move = chess.move({
        from: from,
        to: to,
        promotion: match[3] || 'q',
      });
      
      animateMove(from, to, () => {
        syncBoard();
        checkGameOver();
      });
    }
  }
};

function triggerEngine() {
  if (gameMode === 'friend') return;
  if (!isPlaying) return;
  
  const turnColor = activeGame === 'chess' ? chess.turn() : checkers.turn();
  if (turnColor === playerColor) return;
  
  if (activeGame === 'chess') {
    if (chess.isCheckmate() || chess.isDraw()) return;
    
    updateTurnUI();
    
    engine.postMessage('position fen ' + chess.fen());
    
    let depth = 3;
    if (currentDifficulty === 'semi') {
      depth = 8;
      engine.postMessage('setoption name Skill Level value 10');
    } else if (currentDifficulty === 'pro') {
      depth = 15;
      engine.postMessage('setoption name Skill Level value 20');
    } else {
      engine.postMessage('setoption name Skill Level value 0');
    }
    
    engine.postMessage('go depth ' + depth);
  } else {
    if (checkers.isGameOver()) return;
    updateTurnUI();
    
    setTimeout(() => {
      let depth = 4;
      if (currentDifficulty === 'amador') depth = 2;
      if (currentDifficulty === 'semi') depth = 4;
      if (currentDifficulty === 'pro') depth = 6;
      
      const bestMove = checkers.getBestMove(depth);
      if (bestMove) {
        checkers.move(bestMove);
        animateMove(bestMove.from, bestMove.to, () => {
          syncBoard();
          checkGameOver();
          triggerEngine();
        });
      }
    }, 100);
  }
}

function updateTurnUI() {
  const title = document.getElementById('turn-title')!;
  const subtitle = document.getElementById('turn-subtitle')!;
  const historyList = document.getElementById('history-list')!;
  
  const gameRef = activeGame === 'chess' ? chess : checkers;
  const turnColor = gameRef.turn();
  
  if (activeGame === 'chess') {
    historyList.innerText = chess.pgn() || 'Nenhum lance ainda.';
  } else {
    historyList.innerText = 'Damas em andamento...';
  }
  
  const isGameOver = activeGame === 'chess' ? (chess.isCheckmate() || chess.isDraw()) : checkers.isGameOver();
  
  if (timeW <= 0 || timeB <= 0) {
    title.innerText = 'Fim de Jogo';
    subtitle.innerText = 'Tempo Esgotado.';
  } else if (isGameOver) {
    title.innerText = 'Fim de Jogo';
    subtitle.innerText = activeGame === 'chess' ? (chess.isCheckmate() ? 'Xeque-mate!' : 'Empate.') : 'Sem lances válidos!';
  } else if (gameMode === 'friend') {
    title.innerText = 'Sua vez';
    subtitle.innerText = turnColor === 'w' ? 'Brancas jogam.' : 'Pretas jogam.';
  } else if (turnColor === playerColor) {
    title.innerText = 'Sua vez';
    subtitle.innerText = turnColor === 'w' ? 'Brancas jogam.' : 'Pretas jogam.';
  } else {
    title.innerText = 'Pensando...';
    subtitle.innerText = 'Oponente (' + currentDifficulty + ') está jogando.';
  }
  updateClocksUI();
}

function checkGameOver() {
  updateTurnUI();
  const isGameOver = activeGame === 'chess' ? (chess.isCheckmate() || chess.isDraw()) : checkers.isGameOver();
  if (isGameOver) {
    isPlaying = false;
    stopClock();
    showAlert('GAME OVER');
  }
}

function showAlert(text: string) {
  const alertCenter = document.getElementById('alert-center')!;
  alertCenter.innerText = text;
  alertCenter.classList.add('show');
  setTimeout(() => {
    alertCenter.classList.remove('show');
  }, 4000);
}

// Piece Generation (GLTF Models)
const piecesGroup = new THREE.Group();
scene.add(piecesGroup);
const pieceMeshes = new Map<string, THREE.Group | THREE.Mesh>();

let loadedPieces: Record<string, Record<string, THREE.Object3D>> = {
  w: {},
  b: {}
};

const loader = new GLTFLoader();
MeshoptDecoder.ready.then(() => {
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    import.meta.env.BASE_URL + 'chess.glb',
  // onLoad
  (gltf) => {
    const model = gltf.scene;
    
    // Se for celular, simplifica os materiais de vidro/físicos para evitar estouro de memória (Ah, não!)
    if (isMobile) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const isWhite = child.name.includes('_W') || (child.parent && child.parent.name.includes('_W'));
          child.material = new THREE.MeshStandardMaterial({
            color: isWhite ? 0xe2e8f0 : 0x1e293b,
            roughness: 0.3,
            metalness: 0.1
          });
        }
      });
    }
    
    // Extract base pieces
    const extractPiece = (name: string) => {
      const obj = model.getObjectByName(name);
      if (!obj) return new THREE.Group();
      const clone = obj.clone();
      
      // Reset local transforms that came from Blender's scene placement
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.scale.set(1, 1, 1);
      clone.updateMatrixWorld(true);
      
      // Calculate precise bounding box of actual meshes only (ignoring lights/cameras)
      const box = new THREE.Box3();
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const meshBox = child.geometry.boundingBox.clone();
          meshBox.applyMatrix4(child.matrixWorld);
          box.union(meshBox);
        }
      });
      
      const center = box.getCenter(new THREE.Vector3());
      const min = box.min;
      
      const pivot = new THREE.Group();
      // Shift clone so the pivot origin is at the bottom-center of the meshes
      clone.position.x -= center.x;
      clone.position.y -= min.y;
      clone.position.z -= center.z;
      
      pivot.add(clone);
      return pivot;
    };
    
    loadedPieces.w = {
      k: extractPiece('Queen_W'), // Trocado na origem do modelo 3D
      q: extractPiece('King_W'),
      r: extractPiece('Castle_W1'),
      n: extractPiece('Knight_W1'),
      b: extractPiece('Bishop_W1'),
      p: extractPiece('Pawn_Body_W1')
    };
    
    loadedPieces.b = {
      k: extractPiece('Queen_B'), // Trocado na origem do modelo 3D
      q: extractPiece('King_B'),
      r: extractPiece('Castle_B1'),
      n: extractPiece('Knight_B1'),
      b: extractPiece('Bishop_B1'),
      p: extractPiece('Pawn_Body_B1')
    };
    
    piecesGroup.scale.set(10.5, 10.5, 10.5);
    piecesGroup.position.y = 0.2; 

    document.getElementById('loading-screen')!.style.display = 'none';
    startGame();
  },
  // onProgress — atualiza barra de carregamento
  (xhr) => {
    if (xhr.lengthComputable) {
      const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
      const bar = document.getElementById('loading-bar');
      const txt = document.getElementById('loading-percent');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = pct + '%';
    }
  },
  // onError — mostra mensagem em vez de travar
  (error) => {
    console.error('Erro ao carregar modelo 3D:', error);
    const screen = document.getElementById('loading-screen');
    if (screen) {
      screen.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <h1 style="color: #ef4444; font-family: 'Playfair Display', serif; margin-bottom: 1rem;">Erro ao carregar</h1>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Não foi possível baixar as peças 3D.<br>Verifique sua conexão e tente novamente.</p>
          <button onclick="location.reload()" style="padding: 0.8rem 2rem; background: var(--accent); color: #000; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; font-weight: 600;">Recarregar</button>
        </div>
      `;
    }
  }
);
});

const piecePool: Record<string, THREE.Group[]> = {};

function getPieceMesh(color: string, type: string): THREE.Group {
  const key = color + type;
  if (!piecePool[key]) piecePool[key] = [];
  
  // Tenta encontrar uma peça que não está em uso
  const unused = piecePool[key].find(m => !m.visible);
  if (unused) {
    unused.visible = true;
    return unused;
  }
  
  // Se não tiver, clona uma nova (só ocorre na 1ª vez ou em promoções)
  const prototype = loadedPieces[color][type];
  const mesh = prototype.clone() as THREE.Group;
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  piecesGroup.add(mesh);
  piecePool[key].push(mesh);
  return mesh;
}

function syncBoard() {
  // Esconde todas as peças do pool
  for (const key in piecePool) {
    piecePool[key].forEach(m => { m.visible = false; m.userData = {}; });
  }
  pieceMeshes.clear();

  if (activeGame === 'chess') {
    const board = chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const mesh = getPieceMesh(piece.color, piece.type);
          
          const x = (file + 0.5) / 10.5;
          const z = (rank + 0.5) / 10.5; 
          
          mesh.position.set(x, 0, z);
          
          if (piece.type === 'n') {
            mesh.rotation.y = Math.PI;
          } else {
            mesh.rotation.y = 0;
          }

          const square = String.fromCharCode(97 + file) + (8 - rank);
          
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.userData = { square, piece: piece.type, color: piece.color };
            }
          });
          
          mesh.userData = { square, piece: piece.type, color: piece.color };
          
          pieceMeshes.set(square, mesh);
        }
      }
    }
  } else {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = checkers.board[r][c];
        if (piece) {
          // Use Pawn for Men, Queen for King
          const type = piece.type === 'k' ? 'q' : 'p';
          const mesh = getPieceMesh(piece.color, type);
          
          const x = (c + 0.5) / 10.5;
          const z = (r + 0.5) / 10.5;
          
          mesh.position.set(x, 0, z);
          mesh.rotation.y = 0;
          
          const sq = checkers.rcToSq(r, c);
          
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.userData = { square: sq, piece: piece.type, color: piece.color, isCheckers: true };
            }
          });
          
          mesh.userData = { square: sq, piece: piece.type, color: piece.color, isCheckers: true };
          
          pieceMeshes.set(sq, mesh);
        }
      }
    }
  }
}

// Raycasting (Interaction)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSquare: string | null = null;
const highlightMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.5 });
const mandatoryCaptureMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.45 });
let highlightMesh: THREE.Mesh | null = null;
let mandatoryHighlights: THREE.Mesh[] = [];

// Som de erro (beep curto) usando Web Audio API
function playErrorBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 220; // tom grave
    osc.type = 'square';
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* sem áudio, sem problema */ }
}

// Mostrar quais peças TÊM que capturar (vermelho)
function showMandatoryCaptures() {
  clearMandatoryHighlights();
  if (activeGame !== 'checkers') return;
  
  const allMoves = checkers.getValidMoves();
  const hasCaptures = allMoves.some((m: any) => m.captured && m.captured.length > 0);
  if (!hasCaptures) return;
  
  // Pegar as casas de origem das peças que podem capturar
  const captureSources = new Set(allMoves.filter((m: any) => m.captured && m.captured.length > 0).map((m: any) => m.from));
  
  captureSources.forEach((sq: string) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq[1]);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), mandatoryCaptureMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(file + 0.5, 0.206, rank + 0.5);
    scene.add(mesh);
    mandatoryHighlights.push(mesh);
  });
}

function clearMandatoryHighlights() {
  for (const m of mandatoryHighlights) {
    m.geometry.dispose();
    scene.remove(m);
  }
  mandatoryHighlights = [];
}

window.addEventListener('click', (event) => {
  if (!isPlaying) return;
  const turnColor = activeGame === 'chess' ? chess.turn() : checkers.turn();
  const isPlayerTurn = gameMode === 'friend' ? true : turnColor === playerColor;
  if (!isPlayerTurn) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects([...piecesGroup.children, ...boardGroup.children]);

  if (intersects.length > 0) {
    const object = intersects[0].object as THREE.Mesh;
    let clickedSquare: string | null = null;

    if (object.userData.square) {
      clickedSquare = object.userData.square;
    } else {
      const x = Math.floor(object.position.x);
      const z = Math.floor(object.position.z);
      clickedSquare = String.fromCharCode(97 + x) + (8 - z);
    }

    if (selectedSquare) {
      const moves = activeGame === 'chess' ? chess.moves({ square: selectedSquare as any, verbose: true }) : checkers.moves({ square: selectedSquare });
      const isMove = activeGame === 'chess' 
        ? (moves as any[]).find(m => m.to === clickedSquare)
        : (moves as string[]).includes(clickedSquare);

      if (isMove) {
          animateMove(selectedSquare, clickedSquare, () => {
            const moveResult = activeGame === 'chess' 
              ? chess.move({ from: selectedSquare!, to: clickedSquare, promotion: 'q' })
              : checkers.move({ from: selectedSquare!, to: clickedSquare });
    
            if (moveResult) {
              if (gameMode === 'online' && conn) {
                conn.send({ type: 'move', from: selectedSquare!, to: clickedSquare });
              }
              
              syncBoard();
              updateTurnUI();
              switchClock();
              
              if (gameMode === 'ai' && playerColor !== (activeGame === 'chess' ? chess.turn() : checkers.turn())) {
                triggerEngine();
              }
            }
            
            selectedSquare = null;
            removeHighlight();
          });
      } else {
        const piece = activeGame === 'chess' ? chess.get(clickedSquare as any) : checkers.get(clickedSquare);
        if (piece && (gameMode === 'friend' ? piece.color === turnColor : piece.color === playerColor)) {
          // Checkers: verificar se tem captura obrigatória com OUTRA peça
          if (activeGame === 'checkers') {
            const allMoves = checkers.getValidMoves();
            const hasCaptures = allMoves.some((m: any) => m.captured && m.captured.length > 0);
            const thisHasCapture = allMoves.some((m: any) => m.from === clickedSquare && m.captured && m.captured.length > 0);
            if (hasCaptures && !thisHasCapture) {
              playErrorBeep();
              showAlert('⚠️ Captura obrigatória! Clique na peça vermelha.');
              showMandatoryCaptures();
              return;
            }
          }
          selectedSquare = clickedSquare;
          clearMandatoryHighlights();
          highlightSquare(selectedSquare);
        } else {
          selectedSquare = null;
          removeHighlight();
        }
      }
    } else {
      const piece = activeGame === 'chess' ? chess.get(clickedSquare as any) : checkers.get(clickedSquare);
      if (piece && (gameMode === 'friend' ? piece.color === turnColor : piece.color === playerColor)) {
        // Checkers: verificar captura obrigatória
        if (activeGame === 'checkers') {
          const allMoves = checkers.getValidMoves();
          const hasCaptures = allMoves.some((m: any) => m.captured && m.captured.length > 0);
          const thisHasCapture = allMoves.some((m: any) => m.from === clickedSquare && m.captured && m.captured.length > 0);
          if (hasCaptures && !thisHasCapture) {
            playErrorBeep();
            showAlert('⚠️ Captura obrigatória! Clique na peça vermelha.');
            showMandatoryCaptures();
            return;
          }
        }
        selectedSquare = clickedSquare;
        clearMandatoryHighlights();
        highlightSquare(selectedSquare);
      }
    }
  } else {
    selectedSquare = null;
    removeHighlight();
  }
});

function highlightSquare(square: string) {
  removeHighlight();
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1]);
  highlightMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), highlightMat);
  highlightMesh.rotation.x = -Math.PI / 2;
  highlightMesh.position.set(file + 0.5, 0.205, rank + 0.5);
  scene.add(highlightMesh);
}

function removeHighlight() {
  if (highlightMesh) {
    highlightMesh.geometry.dispose();
    scene.remove(highlightMesh);
    highlightMesh = null;
  }
  clearMandatoryHighlights();
}

function animateMove(from: string, to: string, callback: () => void) {
  const mesh = pieceMeshes.get(from);
  const targetMesh = pieceMeshes.get(to);

  if (!mesh) {
    callback();
    return;
  }

  // Calculate target X, Z coordinates
  const file = to.charCodeAt(0) - 97;
  const rank = 8 - parseInt(to[1]);
  const x = (file + 0.5) / 10.5;
  const z = (rank + 0.5) / 10.5;

  const timeline = gsap.timeline({ onComplete: callback });

  if (targetMesh) {
    // Sink the captured piece
    timeline.to(targetMesh.position, { y: -0.5, duration: 0.3, ease: 'power2.in' }, 0);
    timeline.to(targetMesh.scale, { x: 0, y: 0, z: 0, duration: 0.3 }, 0);
  }

  // Slide the moving piece
  // We add a tiny hop (y axis) for a cinematic feel
  timeline.to(mesh.position, {
    x: x,
    z: z,
    duration: 0.5,
    ease: 'power2.inOut'
  }, 0);
  
  // The hop
  timeline.to(mesh.position, {
    y: 0.15,
    duration: 0.25,
    ease: 'power1.out',
    yoyo: true,
    repeat: 1
  }, 0);
}

// --- CLOCK LOGIC ---
let timeW = 600;
let timeB = 600;
let clockInterval: number | null = null;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = window.setInterval(() => {
    if (!isPlaying) return;
    const turnColor = activeGame === 'chess' ? chess.turn() : checkers.turn();
    if (turnColor === 'w') {
      timeW--;
      if (timeW <= 0) handleTimeout();
    } else {
      timeB--;
      if (timeB <= 0) handleTimeout();
    }
    updateClocksUI();
  }, 1000);
}

function stopClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = null;
}

function handleTimeout() {
  isPlaying = false;
  stopClock();
  updateClocksUI();
  updateTurnUI();
  showAlert('TEMPO ESGOTADO');
}

function updateClocksUI() {
  const cw = document.getElementById('clock-w');
  const cb = document.getElementById('clock-b');
  if (!cw || !cb) return;

  cw.querySelector('.time')!.textContent = formatTime(timeW);
  cb.querySelector('.time')!.textContent = formatTime(timeB);
  
  if (isPlaying) {
    switchClock();
  } else {
    cw.classList.remove('active');
    cb.classList.remove('active');
  }
}
// -------------------
// PeerJS Online Multiplayer
let peer: Peer | null = null;
let conn: DataConnection | null = null;
let isHost = false;

function setupOnlineUI() {
  const btnHost = document.getElementById('btn-host') as HTMLButtonElement;
  const btnJoin = document.getElementById('btn-join') as HTMLButtonElement;
  const inputJoin = document.getElementById('input-join') as HTMLInputElement;
  const statusTxt = document.getElementById('online-status')!;

  btnHost.addEventListener('click', () => {
    btnHost.disabled = true;
    statusTxt.textContent = 'Gerando código...';
    
    if (peer) {
      peer.destroy();
      peer = null;
    }
    
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    peer = new Peer('gmaster-' + code);
    
    peer.on('open', () => {
      statusTxt.innerHTML = `Criado! Envie o código: <strong style="color:var(--accent);font-size:16px;">${code}</strong>`;
      isHost = true;
    });

    peer.on('connection', (c) => {
      if (conn) { c.close(); return; }
      conn = c;
      setupConnection(conn);
      statusTxt.textContent = 'Conectado! O jogo vai começar...';
      
      setTimeout(() => {
         startGame(true); // isHost starting
         conn?.send({
           type: 'init',
           game: activeGame,
           color: playerColor === 'w' ? 'b' : 'w' // give client opposite color
         });
      }, 1000);
    });
    
    peer.on('error', (err) => {
      statusTxt.textContent = 'Erro: ' + err.message;
      btnHost.disabled = false;
    });
  });

  btnJoin.addEventListener('click', () => {
    const code = inputJoin.value.trim().toUpperCase();
    if (!code) return;
    
    btnJoin.disabled = true;
    statusTxt.textContent = 'Conectando...';
    
    if (peer) {
      peer.destroy();
      peer = null;
    }
    
    peer = new Peer();
    
    peer.on('open', () => {
      conn = peer!.connect('gmaster-' + code);
      
      conn.on('open', () => {
        isHost = false;
        setupConnection(conn!);
        statusTxt.textContent = 'Conectado! Aguardando o Host...';
      });
      
      conn.on('error', () => {
         statusTxt.textContent = 'Erro na conexão com o host.';
         btnJoin.disabled = false;
      });
    });
    
    peer.on('error', (err) => {
       statusTxt.textContent = 'Erro: ' + err.message;
       btnJoin.disabled = false;
    });
  });
}

function setupConnection(c: DataConnection) {
  c.on('data', (data: any) => {
    if (data.type === 'init') {
      activeGame = data.game;
      playerColor = data.color;
      
      document.querySelectorAll('#game-control .seg-btn').forEach((b: any) => {
        b.classList.toggle('active', b.dataset.game === activeGame);
      });
      
      startGame(false); // client starting
    } else if (data.type === 'move') {
       animateMove(data.from, data.to, () => {
         if (activeGame === 'chess') {
           chess.move({ from: data.from, to: data.to, promotion: 'q' });
         } else {
           checkers.move({ from: data.from, to: data.to });
         }
         syncBoard();
         updateTurnUI();
         switchClock();
       });
    }
  });

  c.on('close', () => {
     document.getElementById('online-status')!.textContent = 'Desconectado do oponente.';
     conn = null;
  });
}

function switchClock() {
  const turnColor = activeGame === 'chess' ? chess.turn() : checkers.turn();
  const cw = document.getElementById('clock-w');
  const cb = document.getElementById('clock-b');
  if (turnColor === 'w') {
    cw?.classList.add('active');
    cb?.classList.remove('active');
  } else {
    cb?.classList.add('active');
    cw?.classList.remove('active');
  }
}

setupOnlineUI();
// -------------------

// UI Events
let selectedColorOpt = 'w';

document.getElementById('game-control')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.seg-btn') as HTMLElement;
  if (btn) {
    document.querySelectorAll('#game-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGame = (btn.dataset.game as 'chess' | 'checkers') || 'chess';
    
    // Now Checkers has an AI, no need to force 'friend' mode!
    const modeLabel = document.getElementById('mode-control')!;
    modeLabel.style.opacity = '1';
    modeLabel.style.pointerEvents = 'auto';

    startGame();
  }
});

document.getElementById('mode-control')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.seg-btn') as HTMLElement;
  if (btn) {
    document.querySelectorAll('#mode-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameMode = btn.dataset.mode || 'ai';
    
    const diffLabel = document.getElementById('diff-label')!;
    const diffControl = document.getElementById('diff-control')!;
    const onlinePanel = document.getElementById('online-panel')!;
    
    if (gameMode === 'online') {
      onlinePanel.style.display = 'block';
      diffLabel.style.opacity = '0.3';
      diffControl.style.opacity = '0.3';
      diffControl.style.pointerEvents = 'none';
    } else {
      onlinePanel.style.display = 'none';
      if (gameMode === 'friend') {
        diffLabel.style.opacity = '0.3';
        diffControl.style.opacity = '0.3';
        diffControl.style.pointerEvents = 'none';
      } else {
        diffLabel.style.opacity = '1';
        diffControl.style.opacity = '1';
        diffControl.style.pointerEvents = 'auto';
      }
    }
  }
});

document.getElementById('diff-control')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.seg-btn') as HTMLElement;
  if (btn) {
    document.querySelectorAll('#diff-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDifficulty = btn.dataset.diff || 'amador';
  }
});

document.getElementById('color-control')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.seg-btn') as HTMLElement;
  if (btn) {
    document.querySelectorAll('#color-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedColorOpt = btn.dataset.color || 'w';
  }
});

document.getElementById('btn-new')?.addEventListener('click', () => {
  startGame();
});

document.getElementById('btn-flip')?.addEventListener('click', () => {
  const targetZ = -camera.position.z + 8; // Center is at 4
  const targetX = -camera.position.x + 8; // Center is at 4
  
  gsap.to(camera.position, {
    x: targetX,
    z: targetZ,
    duration: 1.5,
    ease: 'power2.inOut',
    onUpdate: () => controls.update()
  });
});

document.getElementById('btn-undo')?.addEventListener('click', () => {
  if (!isPlaying) return;
  if (activeGame === 'checkers') {
     // No undo implemented for checkers yet
     return;
  }
  // Undo twice to get back to player's turn
  chess.undo();
  if (chess.turn() !== playerColor) {
    chess.undo();
  }
  syncBoard();
  updateTurnUI();
  selectedSquare = null;
  removeHighlight();
});

document.getElementById('btn-pgn')?.addEventListener('click', () => {
  navigator.clipboard.writeText(chess.pgn());
  showAlert('PGN COPIADO');
});

function startGame(fromOnline = false) {
  if (gameMode === 'online' && !fromOnline && !isHost) {
    // se estiver no modo online, só o Host ou o sistema pode iniciar
    return;
  }
  
  console.log('Starting game with difficulty:', currentDifficulty);
  
  if (gameMode !== 'online') {
    if (selectedColorOpt === 'r') {
      playerColor = Math.random() > 0.5 ? 'w' : 'b';
    } else {
      playerColor = selectedColorOpt;
    }
  }
  
  isPlaying = true;
  if (activeGame === 'chess') chess.reset();
  else checkers.reset();
  
  syncBoard();
  
  timeW = 600;
  timeB = 600;
  startClock();
  
  updateTurnUI();
  
  // Orient camera based on color
  if (playerColor === 'b') {
    camera.position.set(4, 8, -4);
  } else {
    camera.position.set(4, 8, 12);
  }
  controls.target.set(4, 0, 4);
  controls.update();
  
  if (gameMode === 'ai' && playerColor === 'b') {
    triggerEngine();
  }
}


// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCameraOffset();
});

// Menu Hambúrguer Logic
const menuBtn = document.getElementById('menu-btn');
const closeBtn = document.getElementById('close-menu-btn');
const rightPanel = document.getElementById('right-panel');

menuBtn?.addEventListener('click', () => {
  rightPanel?.classList.add('open');
});

closeBtn?.addEventListener('click', () => {
  rightPanel?.classList.remove('open');
});

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
