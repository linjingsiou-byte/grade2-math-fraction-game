/* ==========================================================================
   分數魔法烘焙屋 - 核心邏輯控制 (app.js)
   ========================================================================== */

// 中文數字對照
const numToChinese = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];

// 直接傳回原始文字 (注音加註功能已移除)
function autoAnnotate(text) {
  return text;
}

// 輔助函數：生成垂直分數 HTML (OMML格式)
function getFractionHTML(num, den) {
  return `<span class="math-fraction"><span class="num">${num}</span><span class="bar"></span><span class="den">${den}</span></span>`;
}

// 輔助函數：洗牌演算法 (Fisher-Yates Shuffle)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 2. 音效系統 (Web Audio API)
const AudioSynth = {
  ctx: null,
  enabled: true,
  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  playBuzzerOpen() {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 大三和弦
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      const startTime = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  },
  playSoftClick() {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  },
  play(type) {
    if (!this.enabled) return;
    if (type === 'buzzerOpen') {
      this.playBuzzerOpen();
      return;
    }
    if (type === 'softClick') {
      this.playSoftClick();
      return;
    }
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const now = this.ctx.currentTime;
    
    if (type === 'click') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } 
    else if (type === 'correct') {
      const playNote = (freq, time, duration) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.start(time);
        osc.stop(time + duration);
      };
      playNote(523.25, now, 0.15);      // C5
      playNote(659.25, now + 0.08, 0.25); // E5
      playNote(783.99, now + 0.16, 0.35); // G5
    } 
    else if (type === 'wrong') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
    else if (type === 'victory') {
      const melody = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      melody.forEach((freq, i) => {
        const start = now + i * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    }
  }
};

// 3. 語音朗讀系統 (Web Speech API)
const SpeechEngine = {
  speak(htmlOrPlainText) {
    // 1. 先將 HTML 形式的分數轉換回標準 "1/N" 格式方便朗讀
    let text = htmlOrPlainText.replace(/<span class="math-fraction"><span class="num">1<\/span><span class="bar"><\/span><span class="den">(\d+)<\/span><\/span>/g, "1/$1");
    
    // 2. 移除所有 HTML 標記以利純文字朗讀
    text = text.replace(/<[^>]*>/g, "");
    
    // 3. 將分數標記換成好聽的唸法，如 1/4 個蛋糕 -> 「四分之一個蛋糕」
    text = text.replace(/1\/(\d+)/g, (match, p1) => {
      const num = parseInt(p1);
      return (numToChinese[num] || num) + "分之一";
    });
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    
    // 設定合適的台灣華語語音
    const voices = window.speechSynthesis.getVoices();
    const twVoice = voices.find(v => v.lang.includes("zh-TW") || v.name.includes("Taiwan") || v.name.includes("Yating"));
    if (twVoice) utterance.voice = twVoice;
    
    utterance.rate = 0.82; // 稍微放慢速度
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  }
};

// 3.5 雙人對戰標準化控制器 (BattleManager)
const BattleManager = {
  thinkingTimer: null,
  answerTimer: null,
  isThinkingPhase: false,
  isAnswerPhase: false,
  activeGame: null,
  answeringPlayer: null,
  hasPassedOn: false,

  cleanup() {
    this.clearThinkingTimer();
    this.clearAnswerTimer();
    this.isThinkingPhase = false;
    this.isAnswerPhase = false;
    this.activeGame = null;
    this.answeringPlayer = null;
    this.hasPassedOn = false;
    if (window.pvpActiveKeyHandler) {
      window.removeEventListener('keydown', window.pvpActiveKeyHandler);
      window.pvpActiveKeyHandler = null;
    }
  },

  clearThinkingTimer() {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  },

  clearAnswerTimer() {
    if (this.answerTimer) {
      clearInterval(this.answerTimer);
      this.answerTimer = null;
    }
  },

  triggerShake(el) {
    if (!el) return;
    el.classList.remove('shake-warn');
    void el.offsetWidth;
    el.classList.add('shake-warn');
    AudioSynth.playSoftClick();
    setTimeout(() => {
      el.classList.remove('shake-warn');
    }, 450);
  },

  startThinkingPhase(options) {
    this.cleanup();
    this.isThinkingPhase = true;
    this.activeGame = options.game;
    const durationSec = options.durationSec || 3.0;

    const statusBar = document.getElementById('battle-status-bar');
    const statusIcon = document.getElementById('battle-status-icon');
    const statusText = document.getElementById('battle-status-text');
    const progressFill = document.getElementById('battle-status-progress-fill');

    if (statusBar) {
      statusBar.className = 'battle-status-bar';
    }
    if (statusIcon) statusIcon.textContent = '⏳';
    if (statusText) {
      const modeHint = options.game === 'game2' ? '開放競速' : '開放搶答';
      statusText.innerHTML = `仔細看題思考中... <strong id="battle-status-timer">${durationSec.toFixed(1)}</strong> 秒後${modeHint}！`;
    }
    if (progressFill) {
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
      progressFill.style.background = 'linear-gradient(90deg, #ff9f43, #ee5253)';
    }

    if (options.onSetCooling) {
      options.onSetCooling(true);
    }

    const totalMs = durationSec * 1000;
    const intervalMs = 100;
    let elapsedMs = 0;

    this.thinkingTimer = setInterval(() => {
      elapsedMs += intervalMs;
      const remainingSec = Math.max(0, (totalMs - elapsedMs) / 1000);
      const percent = Math.min(100, (elapsedMs / totalMs) * 100);

      const timerEl = document.getElementById('battle-status-timer');
      if (timerEl) {
        timerEl.textContent = remainingSec.toFixed(1);
      }
      if (progressFill) {
        progressFill.style.transition = 'width 0.1s linear';
        progressFill.style.width = `${percent}%`;
      }

      if (elapsedMs >= totalMs) {
        this.clearThinkingTimer();
        this.isThinkingPhase = false;
        AudioSynth.playBuzzerOpen();

        if (statusBar) {
          statusBar.className = 'battle-status-bar ready';
        }
        if (statusIcon) statusIcon.textContent = '⚡';
        if (statusText) {
          if (options.game === 'game2') {
            statusText.innerHTML = '⚡ <strong>烘焙競速開始！</strong>快動手切割點心並送出！';
          } else {
            statusText.innerHTML = '⚡ <strong>搶答開始！</strong>快按搶答鈕（貓咪 A鍵/空白鍵 ｜ 兔子 L鍵/Enter鍵）！';
          }
        }

        if (options.onSetCooling) {
          options.onSetCooling(false);
        }

        if (options.onThinkingComplete) {
          options.onThinkingComplete();
        }
      }
    }, intervalMs);
  },

  startAnswerPhase(options) {
    this.clearAnswerTimer();
    this.isAnswerPhase = true;
    this.answeringPlayer = options.player;
    this.hasPassedOn = options.isPassOn || false;

    const durationSec = options.durationSec || 10;
    const pName = options.player === 'p1' ? '🐱 藍貓隊' : '🐰 紅兔隊';
    const turnTitle = this.hasPassedOn ? '🔄【接力作答】' : '🎉【搶答成功】';

    const statusBar = document.getElementById('battle-status-bar');
    const statusIcon = document.getElementById('battle-status-icon');
    const statusText = document.getElementById('battle-status-text');
    const progressFill = document.getElementById('battle-status-progress-fill');

    if (statusBar) {
      statusBar.className = 'battle-status-bar winner';
    }
    if (statusIcon) statusIcon.textContent = '⏱️';
    if (statusText) {
      const hint = options.shortcutHint ? `（${options.shortcutHint}）` : '';
      statusText.innerHTML = `${turnTitle} <strong>${pName} 請作答！</strong> 剩餘時間：<strong id="battle-answer-timer">${durationSec.toFixed(1)}</strong> 秒 ${hint}`;
    }
    if (progressFill) {
      progressFill.style.transition = 'none';
      progressFill.style.width = '100%';
      progressFill.style.background = 'linear-gradient(90deg, #ff9f43, #2ed573)';
    }

    const totalMs = durationSec * 1000;
    const intervalMs = 100;
    let remainingMs = totalMs;

    this.answerTimer = setInterval(() => {
      remainingMs -= intervalMs;
      const remainingSec = Math.max(0, remainingMs / 1000);
      const percent = Math.max(0, (remainingMs / totalMs) * 100);

      const timerEl = document.getElementById('battle-answer-timer');
      if (timerEl) {
        timerEl.textContent = remainingSec.toFixed(1);
      }
      if (progressFill) {
        progressFill.style.transition = 'width 0.1s linear';
        progressFill.style.width = `${percent}%`;
        if (remainingSec <= 3.0) {
          progressFill.style.background = 'linear-gradient(90deg, #ee5253, #ff4757)';
        }
      }

      if (statusBar && remainingSec <= 3.0 && remainingSec > 0) {
        statusBar.classList.add('warning');
      }

      if (remainingMs <= 0) {
        this.clearAnswerTimer();
        this.isAnswerPhase = false;
        if (statusBar) statusBar.classList.remove('warning');
        if (options.onTimeout) {
          options.onTimeout();
        }
      }
    }, intervalMs);
  }
};

// 4. 全域遊戲狀態
const GameState = {
  currentScreen: 'screen-welcome',
  gameMode: 'single', // 'single' 或 'pvp'
  selectedGame: null, // 'explorer', 'game1', 'game2', 'game3'
  autoRead: true,
  
  // 單人模式狀態
  singleScore: 0,
  singleQuestionIndex: 0,
  maxQuestions: 5,
  
  // 雙人對戰狀態
  p1Score: 0,
  p2Score: 0,
  pvpMaxScore: 5,
  pvpQuestionIndex: 0,
  pvpTurn: null, // 用於搶答鎖定，如 'p1' 或 'p2'
  pvpLocked: false, // 是否答題中凍結
  
  // 核心資料快取 (如當前題目資訊)
  currentQuestionData: null
};

// 5. 動態 SVG 渲染庫 (披薩蛋糕與長條巧克力)
const SVGRenderer = {
  // 繪製圓形點心 (蛋糕/披薩)
  // divider: 等分份數
  // highlightedIndex: 被選取的份數索引 (null 表示沒有，0 到 divider-1 表示有選)
  // onClickSlice: 點擊切片的回呼函式 (sliceIndex)
  drawCircleFraction(divider, highlightedIndex = null, onClickSlice = null) {
    const size = 240;
    const cx = 120;
    const cy = 120;
    const r = 100;
    
    let svgContent = `<svg viewBox="0 0 ${size} ${size}">`;
    
    // 繪製蛋糕底盤陰影與外盤
    svgContent += `<circle cx="${cx}" cy="${cy + 4}" r="${r + 6}" fill="#D7CCC8" opacity="0.6"/>`;
    svgContent += `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#EEEEEE" stroke="#E0E0E0" stroke-width="3"/>`;
    svgContent += `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#FFF8E1" stroke="#FFE082" stroke-width="2"/>`;
    
    const sliceAngle = 360 / divider;
    
    for (let i = 0; i < divider; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = (i + 1) * sliceAngle;
      
      const isHighlighted = (highlightedIndex === i);
      const fillColor = isHighlighted ? "url(#strawberry-cream)" : "#FFF3E0";
      const strokeColor = isHighlighted ? "#D50000" : "#D7CCC8";
      const strokeWidth = isHighlighted ? 4 : 2;
      
      // 計算扇形路徑
      const pathData = this.getSectorPath(cx, cy, r, startAngle, endAngle);
      
      svgContent += `
        <path d="${pathData}" 
              fill="${fillColor}" 
              stroke="${strokeColor}" 
              stroke-width="${strokeWidth}" 
              style="cursor: ${onClickSlice ? 'pointer' : 'default'}; transition: fill 0.25s ease;"
              class="slice-path" 
              data-index="${i}"
        />
      `;
      
      // 如果是被點選的單位分數切片，加入草莓裝飾
      if (isHighlighted) {
        // 計算剖對稱角的中線
        const midAngle = startAngle + sliceAngle / 2;
        const rad = (midAngle - 90) * Math.PI / 180;
        // 將草莓擺放在半徑的一半處
        const decR = r * 0.55;
        const decX = cx + decR * Math.cos(rad);
        const decY = cy + decR * Math.sin(rad);
        
        // 畫一個小草莓圖案
        svgContent += `
          <g transform="translate(${decX}, ${decY}) scale(0.8)">
            <path d="M 0,-8 C 3,-12 8,-8 5,0 C 3,5 0,10 0,10 C 0,10 -3,5 -5,0 C -8,-8 -3,-12 0,-8 Z" fill="#E53935"/>
            <circle cx="-1" cy="-2" r="0.6" fill="#FFEE58"/>
            <circle cx="2" cy="1" r="0.6" fill="#FFEE58"/>
            <circle cx="-2" cy="2" r="0.6" fill="#FFEE58"/>
            <circle cx="1" cy="-4" r="0.6" fill="#FFEE58"/>
            <path d="M -3,-8 C -1,-6 1,-6 3,-8 L 0,-4 Z" fill="#4CAF50"/>
          </g>
        `;
      }
    }
    
    // 定義草莓醬漸層與過濾器
    svgContent += `
      <defs>
        <radialGradient id="strawberry-cream" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
          <stop offset="0%" stop-color="#FF8A80" />
          <stop offset="100%" stop-color="#D50000" />
        </radialGradient>
      </defs>
    </svg>`;
    
    return svgContent;
  },
  
  getSectorPath(cx, cy, r, startAngle, endAngle) {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    
    // 如果剛好是 360 度 (即 divider 為 1)
    if (endAngle - startAngle >= 360) {
      return `M ${cx-r} ${cy} A ${r} ${r} 0 1 0 ${cx+r} ${cy} A ${r} ${r} 0 1 0 ${cx-r} ${cy}`;
    }
    
    const largeArcFlag = (endAngle - startAngle <= 180) ? 0 : 1;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  },
  
  // 繪製長方形點心 (巧克力)
  drawRectFraction(divider, highlightedIndex = null, onClickSlice = null) {
    const width = 240;
    const height = 90;
    const blockW = width / divider;
    
    let svgContent = `<svg viewBox="0 0 250 110">`;
    // 巧克力底盤陰影
    svgContent += `<rect x="5" y="15" width="${width}" height="${height}" rx="8" fill="#D7CCC8" opacity="0.6"/>`;
    
    for (let i = 0; i < divider; i++) {
      const isHighlighted = (highlightedIndex === i);
      const fillMain = isHighlighted ? "url(#chocolate-highlight)" : "#E0D4C5";
      const fillBevel = isHighlighted ? "#4E342E" : "#CFD8DC";
      const borderStroke = isHighlighted ? "#2D150F" : "#B0BEC5";
      
      const x = 5 + i * blockW;
      const y = 10;
      
      // 巧克力塊主體
      svgContent += `
        <g class="slice-path" data-index="${i}" style="cursor: ${onClickSlice ? 'pointer' : 'default'};">
          <rect x="${x}" y="${y}" width="${blockW}" height="${height}" 
                fill="${fillMain}" 
                stroke="${borderStroke}" 
                stroke-width="2" 
                rx="6"
                style="transition: fill 0.2s ease;"
          />
          <!-- 內部壓紋(做出巧克力塊層次) -->
          <rect x="${x + blockW * 0.15}" y="${y + height * 0.15}" width="${blockW * 0.7}" height="${height * 0.7}" 
                fill="none" 
                stroke="${fillBevel}" 
                stroke-width="2" 
                rx="4"
                opacity="0.8"
          />
        </g>
      `;
    }
    
    svgContent += `
      <defs>
        <linearGradient id="chocolate-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5D4037" />
          <stop offset="100%" stop-color="#2D150F" />
        </linearGradient>
      </defs>
    </svg>`;
    
    return svgContent;
  }
};

// 6. UI 事件與流程管理 (Screen Switcher)
const AppManager = {
  init() {
    this.bindGlobalEvents();
    this.renderExplorer();
    this.showScreen('screen-welcome');
  },
  
  bindGlobalEvents() {
    // 頂部導覽控制
    document.getElementById('btn-nav-home').addEventListener('click', () => {
      AudioSynth.play('click');
      this.showScreen('screen-welcome');
    });
    document.getElementById('btn-home-logo').addEventListener('click', () => {
      AudioSynth.play('click');
      this.showScreen('screen-welcome');
    });
    
    // 切換自動報讀
    document.getElementById('btn-toggle-autoread').addEventListener('click', (e) => {
      AudioSynth.play('click');
      GameState.autoRead = !GameState.autoRead;
      const btn = document.getElementById('btn-toggle-autoread');
      if (GameState.autoRead) {
        btn.classList.add('active');
        btn.querySelector('.btn-text').innerText = "自動報讀: 開";
      } else {
        btn.classList.remove('active');
        btn.querySelector('.btn-text').innerText = "自動報讀: 關";
        window.speechSynthesis.cancel(); // 關閉時立即停止目前語音
      }
    });
    
    // 切換音效
    document.getElementById('btn-toggle-audio').addEventListener('click', () => {
      AudioSynth.play('click');
      AudioSynth.enabled = !AudioSynth.enabled;
      const btn = document.getElementById('btn-toggle-audio');
      if (AudioSynth.enabled) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 魔法秘笈彈出視窗控制
    document.getElementById('btn-toggle-secrets').addEventListener('click', () => {
      AudioSynth.play('click');
      document.getElementById('modal-secrets').classList.add('active');
    });
    
    document.getElementById('btn-close-secrets').addEventListener('click', () => {
      AudioSynth.play('click');
      document.getElementById('modal-secrets').classList.remove('active');
    });

    document.getElementById('modal-secrets').addEventListener('click', (e) => {
      if (e.target.id === 'modal-secrets') {
        AudioSynth.play('click');
        document.getElementById('modal-secrets').classList.remove('active');
      }
    });
    
    // 選擇單人/對戰模式
    document.getElementById('card-mode-single').addEventListener('click', () => {
      AudioSynth.play('click');
      GameState.gameMode = 'single';
      document.getElementById('player-mode-badge').innerText = "單人自主學習";
      document.getElementById('player-mode-badge').className = "badge bg-pink";
      this.showScreen('screen-menu');
    });
    
    document.getElementById('card-mode-pvp').addEventListener('click', () => {
      AudioSynth.play('click');
      GameState.gameMode = 'pvp';
      document.getElementById('player-mode-badge').innerText = "雙人烘焙對決";
      document.getElementById('player-mode-badge').className = "badge bg-blue";
      this.showScreen('screen-menu');
    });
    
    document.getElementById('btn-back-to-welcome').addEventListener('click', () => {
      AudioSynth.play('click');
      this.showScreen('screen-welcome');
    });
    
    // 選單內四個入口點擊
    document.getElementById('menu-btn-explorer').addEventListener('click', () => {
      AudioSynth.play('click');
      GameState.selectedGame = 'explorer';
      this.showScreen('screen-explorer');
    });
    
    document.getElementById('menu-btn-game1').addEventListener('click', () => {
      AudioSynth.play('click');
      GameState.selectedGame = 'game1';
      Game1Manager.start();
    });
    
    document.getElementById('menu-btn-game2').addEventListener('click', () => {
      AudioSynth.play('click');
      GameState.selectedGame = 'game2';
      Game2Manager.start();
    });
    
    document.getElementById('menu-btn-game3').addEventListener('click', () => {
      AudioSynth.play('click');
      GameState.selectedGame = 'game3';
      Game3Manager.start();
    });
    
    // 回到選單的通用按鈕
    document.querySelectorAll('.menu-back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSynth.play('click');
        this.showScreen('screen-menu');
      });
    });
  },
  
  showScreen(screenId) {
    // 隱藏全部畫面
    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.classList.remove('active');
    });
    
    // 顯示指定畫面
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
      activeScreen.classList.add('active');
    }
    
    // 回首頁按鈕顯示判定
    const homeBtn = document.getElementById('btn-nav-home');
    if (screenId === 'screen-welcome') {
      homeBtn.classList.add('hide');
    } else {
      homeBtn.classList.remove('hide');
    }
    
    GameState.currentScreen = screenId;
    window.speechSynthesis.cancel(); // 切換畫面時自動靜音 TTS
    BattleManager.cleanup(); // 清理對戰計時器與鍵盤事件
  },
  
  // Confetti 答對煙火效果
  spawnConfetti() {
    const container = document.getElementById('celebration-confetti-container');
    container.innerHTML = '';
    const colors = ['#FF8A80', '#FFD54F', '#81C784', '#64B5F6', '#BA68C8', '#FFB74D'];
    
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.style.left = Math.random() * 100 + 'vw';
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      const duration = Math.random() * 1.5 + 1.5;
      particle.style.animationDuration = duration + 's';
      particle.style.animationDelay = Math.random() * 0.3 + 's';
      particle.style.width = Math.random() * 8 + 8 + 'px';
      particle.style.height = particle.style.width;
      
      // 隨機旋轉角度
      particle.style.transform = `rotate(${Math.random() * 360}deg)`;
      
      container.appendChild(particle);
      
      // 動態移除
      setTimeout(() => {
        particle.remove();
      }, (duration + 0.3) * 1000);
    }
  },
  
  // --------------------------------------------------
  // 探索區邏輯 (Concept Explorer)
  // --------------------------------------------------
  explorerState: {
    shape: 'circle', // 'circle' 或 'rect'
    divider: 4,
    highlighted: 0   // 單位分數永遠選取 1 片 (預設第 0 片)
  },
  
  renderExplorer() {
    const es = this.explorerState;
    const container = document.getElementById('explorer-svg-container');
    
    // 繪製圖形
    let svgHtml = '';
    if (es.shape === 'circle') {
      svgHtml = SVGRenderer.drawCircleFraction(es.divider, es.highlighted, (idx) => {
        AudioSynth.play('click');
        es.highlighted = idx;
        this.renderExplorer();
      });
    } else {
      svgHtml = SVGRenderer.drawRectFraction(es.divider, es.highlighted, (idx) => {
        AudioSynth.play('click');
        es.highlighted = idx;
        this.renderExplorer();
      });
    }
    container.innerHTML = svgHtml;
    
    // 更新選取事件監聽 (動態加入 click)
    const paths = container.querySelectorAll('.slice-path');
    paths.forEach(path => {
      path.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        AudioSynth.play('click');
        es.highlighted = index;
        this.renderExplorer();
      });
    });
    
    // 更新數學公式標籤
    document.getElementById('exp-denominator').innerText = es.divider;
    const fractionNameStr = numToChinese[es.divider] + "分之一";
    document.getElementById('exp-fraction-name').innerHTML = autoAnnotate(fractionNameStr);
    
    // 更新說明文字
    const shapeWord = es.shape === 'circle' ? '個蛋糕' : '條巧克力';
    const shapeUnitStr = es.shape === 'circle' ? '個' : '條';
    const phraseStr = es.shape === 'circle' ? '份' : '塊';
    
    const explanationText = `把 <span class="unit-ge">1 ${shapeUnitStr}</span> ${es.shape === 'circle'?'蛋糕':'巧克力'}平分成 <span class="unit-fen">${es.divider} ${phraseStr}</span>，其中的 <span class="unit-fen">1 ${phraseStr}</span> 是 ${getFractionHTML(1, es.divider)} <span class="unit-ge">${shapeUnitStr}</span> ${es.shape === 'circle'?'蛋糕':'巧克力'}。`;
    document.getElementById('explorer-explanation').innerHTML = autoAnnotate(explanationText);
    
    // 綁定朗讀按鈕
    const speakBtn = document.getElementById('btn-explorer-speak');
    // 解除舊綁定
    const newSpeakBtn = speakBtn.cloneNode(true);
    speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);
    
    newSpeakBtn.addEventListener('click', () => {
      const readText = `把 1 ${shapeUnitStr} ${es.shape === 'circle'?'蛋糕':'巧克力'}平分成 ${es.divider} ${phraseStr}，其中的 1 ${phraseStr} 是 ${fractionNameStr} ${shapeUnitStr} ${es.shape === 'circle'?'蛋糕':'巧克力'}。`;
      SpeechEngine.speak(readText);
    });
    
    // 綁定形狀按鈕與拉桿
    const circleBtn = document.getElementById('btn-shape-circle');
    const rectBtn = document.getElementById('btn-shape-rect');
    
    circleBtn.onclick = () => {
      AudioSynth.play('click');
      es.shape = 'circle';
      circleBtn.classList.add('active');
      rectBtn.classList.remove('active');
      this.renderExplorer();
    };
    
    rectBtn.onclick = () => {
      AudioSynth.play('click');
      es.shape = 'rect';
      rectBtn.classList.add('active');
      circleBtn.classList.remove('active');
      this.renderExplorer();
    };
    
    const rangeInput = document.getElementById('explorer-divider-range');
    rangeInput.value = es.divider;
    document.getElementById('range-value-num').innerText = es.divider + " 份";
    
    rangeInput.oninput = (e) => {
      es.divider = parseInt(e.target.value);
      document.getElementById('range-value-num').innerText = es.divider + " 份";
      // 確保選取範圍不超出
      if (es.highlighted >= es.divider) {
        es.highlighted = 0;
      }
      this.renderExplorer();
    };
  }
};


// ==========================================================================
// 7. 關卡一：平分小偵探 (Is it Equal Division?)
// ==========================================================================
const Game1Manager = {
  // 動態生成 8 種幾何等分與非等分圖形
  shapeTemplates: [
    {
      id: 'circle_eq_2',
      shape: 'circle',
      title: '圓形平分2份',
      isEqual: true,
      draw() { return SVGRenderer.drawCircleFraction(2, null); }
    },
    {
      id: 'circle_eq_3',
      shape: 'circle',
      title: '圓形平分3份',
      isEqual: true,
      draw() { return SVGRenderer.drawCircleFraction(3, null); }
    },
    {
      id: 'circle_eq_4',
      shape: 'circle',
      title: '圓形平分4份',
      isEqual: true,
      draw() { return SVGRenderer.drawCircleFraction(4, null); }
    },
    {
      id: 'rect_eq_2',
      shape: 'rect',
      title: '長方形平分2份',
      isEqual: true,
      draw() { return SVGRenderer.drawRectFraction(2, null); }
    },
    {
      id: 'rect_eq_3',
      shape: 'rect',
      title: '長方形平分3份',
      isEqual: true,
      draw() { return SVGRenderer.drawRectFraction(3, null); }
    },
    {
      id: 'rect_eq_4',
      shape: 'rect',
      title: '長方形平分4份',
      isEqual: true,
      draw() { return SVGRenderer.drawRectFraction(4, null); }
    },
    {
      id: 'square_eq_2_vert',
      shape: 'square',
      title: '正方形平分2份',
      isEqual: true,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <rect x="20" y="20" width="200" height="200" fill="#FFF8E1" stroke="#FFE082" stroke-width="2" rx="4"/>
            <line x1="120" y1="20" x2="120" y2="220" stroke="#FFE082" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'square_eq_2_diag',
      shape: 'square',
      title: '正方形平分2份',
      isEqual: true,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <rect x="20" y="20" width="200" height="200" fill="#FFF8E1" stroke="#FFE082" stroke-width="2" rx="4"/>
            <line x1="20" y1="20" x2="220" y2="220" stroke="#FFE082" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'square_eq_4',
      shape: 'square',
      title: '正方形平分4份',
      isEqual: true,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <rect x="20" y="20" width="200" height="200" fill="#FFF8E1" stroke="#FFE082" stroke-width="2" rx="4"/>
            <line x1="20" y1="20" x2="220" y2="220" stroke="#FFE082" stroke-width="2"/>
            <line x1="220" y1="20" x2="20" y2="220" stroke="#FFE082" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'triangle_eq_2',
      shape: 'triangle',
      title: '三角形平分2份',
      isEqual: true,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <polygon points="120,20 20,210 220,210" fill="#E8F5E9" stroke="#81C784" stroke-width="2"/>
            <line x1="120" y1="20" x2="120" y2="210" stroke="#81C784" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'circle_neq_2',
      shape: 'circle',
      title: '圓形不平分2份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="100" fill="#FFF3E0" stroke="#D7CCC8" stroke-width="2"/>
            <line x1="70" y1="22" x2="70" y2="218" stroke="#D7CCC8" stroke-width="2" stroke-dasharray="4"/>
          </svg>
        `;
      }
    },
    {
      id: 'circle_neq_3',
      shape: 'circle',
      title: '圓形不平分3份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="100" fill="#FFF3E0" stroke="#D7CCC8" stroke-width="2"/>
            <line x1="33" y1="70" x2="207" y2="70" stroke="#D7CCC8" stroke-width="2" stroke-dasharray="4"/>
            <line x1="33" y1="170" x2="207" y2="170" stroke="#D7CCC8" stroke-width="2" stroke-dasharray="4"/>
          </svg>
        `;
      }
    },
    {
      id: 'rect_neq_2',
      shape: 'rect',
      title: '長方形不平分2份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 250 110">
            <rect x="5" y="10" width="240" height="90" fill="#E0D4C5" stroke="#B0BEC5" stroke-width="2" rx="6"/>
            <line x1="70" y1="10" x2="70" y2="100" stroke="#B0BEC5" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'rect_neq_3',
      shape: 'rect',
      title: '長方形不平分3份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 250 110">
            <rect x="5" y="10" width="240" height="90" fill="#E0D4C5" stroke="#B0BEC5" stroke-width="2" rx="6"/>
            <line x1="55" y1="10" x2="55" y2="100" stroke="#B0BEC5" stroke-width="2"/>
            <line x1="175" y1="10" x2="175" y2="100" stroke="#B0BEC5" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'rect_neq_4',
      shape: 'rect',
      title: '長方形不平分4份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 250 110">
            <rect x="5" y="10" width="240" height="90" fill="#E0D4C5" stroke="#B0BEC5" stroke-width="2" rx="6"/>
            <line x1="40" y1="10" x2="40" y2="100" stroke="#B0BEC5" stroke-width="2"/>
            <line x1="130" y1="10" x2="130" y2="100" stroke="#B0BEC5" stroke-width="2"/>
            <line x1="210" y1="10" x2="210" y2="100" stroke="#B0BEC5" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'square_neq_2',
      shape: 'square',
      title: '正方形不平分2份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <rect x="20" y="20" width="200" height="200" fill="#FFF8E1" stroke="#FFE082" stroke-width="2" rx="4"/>
            <line x1="20" y1="80" x2="220" y2="160" stroke="#FFE082" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'square_neq_4_unequal',
      shape: 'square',
      title: '正方形不平分4份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <rect x="20" y="20" width="200" height="200" fill="#FFF8E1" stroke="#FFE082" stroke-width="2" rx="4"/>
            <line x1="70" y1="20" x2="70" y2="220" stroke="#FFE082" stroke-width="2"/>
            <line x1="20" y1="150" x2="220" y2="150" stroke="#FFE082" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'triangle_neq_2',
      shape: 'triangle',
      title: '三角形不平分2份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <polygon points="120,20 20,210 220,210" fill="#E8F5E9" stroke="#81C784" stroke-width="2"/>
            <line x1="70" y1="115" x2="170" y2="115" stroke="#81C784" stroke-width="2"/>
          </svg>
        `;
      }
    },
    {
      id: 'triangle_neq_3',
      shape: 'triangle',
      title: '三角形不平分3份',
      isEqual: false,
      draw() {
        return `
          <svg viewBox="0 0 240 240">
            <polygon points="120,20 20,210 220,210" fill="#E8F5E9" stroke="#81C784" stroke-width="2"/>
            <line x1="70" y1="115" x2="170" y2="115" stroke="#81C784" stroke-width="2"/>
            <line x1="95" y1="70" x2="145" y2="70" stroke="#81C784" stroke-width="2"/>
          </svg>
        `;
      }
    }
  ],
  
  start() {
    GameState.singleScore = 0;
    GameState.p1Score = 0;
    GameState.p2Score = 0;
    GameState.singleQuestionIndex = 0;
    GameState.pvpLocked = false;
    GameState.pvpTurn = null;
    
    AppManager.showScreen('screen-game-1');
    this.nextQuestion();
  },
  
  nextQuestion() {
    window.speechSynthesis.cancel();
    
    if (GameState.gameMode === 'single') {
      if (GameState.singleQuestionIndex >= GameState.maxQuestions) {
        this.showFinalScore();
        return;
      }
      this.renderSingleQuestion();
    } else {
      if (GameState.p1Score >= GameState.pvpMaxScore || GameState.p2Score >= GameState.pvpMaxScore) {
        this.showFinalScore();
        return;
      }
      // 重設搶答狀態，避免下一題無法搶答
      GameState.pvpLocked = false;
      GameState.pvpTurn = null;
      this.renderPvpQuestion();
    }
  },
  
  // --------------------------------------------------
  // 單人版題目渲染
  // --------------------------------------------------
  renderSingleQuestion() {
    const container = document.getElementById('game-1-container');
    
    // 分開平分與不平分的選項
    const equalShapes = this.shapeTemplates.filter(opt => opt.isEqual);
    const unequalShapes = this.shapeTemplates.filter(opt => !opt.isEqual);
    
    // 隨機選出 1 個平分的圖形
    const shuffledEqual = shuffleArray(equalShapes);
    const correctOpt = shuffledEqual[0];
    
    // 隨機選出 3 個不平分的圖形
    const shuffledUnequal = shuffleArray(unequalShapes);
    const wrongOpts = shuffledUnequal.slice(0, 3);
    
    // 合併並打亂順序，確保只有「剛好一個」正確答案
    let options = [correctOpt, ...wrongOpts];
    options = shuffleArray(options);
    
    const questionText = "找一找，哪一個圖形有平分？";
    
    let html = `
      <div class="single-game-layout">
        <div class="game-card-main">
          <!-- 狀態列 -->
          <div class="game-status-bar">
            <div class="game-title-info">🔍 平分小偵探 (第 ${GameState.singleQuestionIndex + 1}/${GameState.maxQuestions} 題)</div>
            <div class="game-score-stars">
              ${'⭐'.repeat(GameState.singleScore)}${'☆'.repeat(GameState.maxQuestions - GameState.singleScore)}
            </div>
          </div>
          
          <!-- 題目 -->
          <div class="question-text-box">
            <button class="question-speak-btn" id="btn-q1-speak">🔊</button>
            <span class="q-text-span">${autoAnnotate(questionText)}</span>
          </div>
          
          <!-- 選項網格 -->
          <div class="detective-choices">
            ${options.map((opt, i) => `
              <div class="detective-choice-card" data-equal="${opt.isEqual}" data-title="${opt.title}">
                <div class="choice-svg-wrap">${opt.draw()}</div>
                <div class="choice-label-text">${autoAnnotate('圖形 ' + numToChinese[i+1])}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 朗讀綁定
    document.getElementById('btn-q1-speak').addEventListener('click', () => {
      SpeechEngine.speak(questionText);
    });
    // 自動朗讀
    if (GameState.autoRead) {
      SpeechEngine.speak(questionText);
    }
    
    // 答題卡片點擊監聽
    container.querySelectorAll('.detective-choice-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const isEqual = e.currentTarget.getAttribute('data-equal') === 'true';
        const titleStr = e.currentTarget.getAttribute('data-title');
        
        // 顯示反饋覆蓋層
        this.showSingleFeedback(isEqual, titleStr);
      });
    });
  },
  
  showSingleFeedback(isCorrect, titleStr) {
    const container = document.querySelector('.game-card-main');
    
    // 避免重複點擊
    if (container.querySelector('.feedback-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    
    let titleHtml = '';
    let reasonHtml = '';
    
    if (isCorrect) {
      AudioSynth.play('correct');
      AppManager.spawnConfetti();
      GameState.singleScore++;
      titleHtml = `<div class="feedback-title correct">${autoAnnotate('答對了！')}</div>`;
      reasonHtml = `<div class="feedback-reason">${autoAnnotate('太棒了！這個圖形的每一份大小都一樣，這就是「平分」喔！')}</div>`;
    } else {
      AudioSynth.play('wrong');
      titleHtml = `<div class="feedback-title wrong">${autoAnnotate('答錯了～')}</div>`;
      reasonHtml = `<div class="feedback-reason">${autoAnnotate('哎呀！這個圖形切出來的大小不一樣，所以沒有「平分」喔。')}</div>`;
    }
    
    overlay.innerHTML = `
      <div class="feedback-emoji">${isCorrect ? '🎉' : '😢'}</div>
      ${titleHtml}
      ${reasonHtml}
      <button class="standard-btn primary-btn" id="btn-next-q">下一題 ➡️</button>
    `;
    
    container.appendChild(overlay);
    
    document.getElementById('btn-next-q').addEventListener('click', () => {
      GameState.singleQuestionIndex++;
      this.nextQuestion();
    });
  },
  
  // --------------------------------------------------
  // 雙人對戰版題目渲染 (搶答機制 - 標準化升級)
  // --------------------------------------------------
  renderPvpQuestion() {
    BattleManager.cleanup();
    const container = document.getElementById('game-1-container');
    
    // 分開平分與不平分的選項
    const equalShapes = this.shapeTemplates.filter(opt => opt.isEqual);
    const unequalShapes = this.shapeTemplates.filter(opt => !opt.isEqual);
    
    // 隨機選出 1 個平分的圖形
    const shuffledEqual = shuffleArray(equalShapes);
    const correctOpt = shuffledEqual[0];
    
    // 隨機選出 3 個不平分的圖形
    const shuffledUnequal = shuffleArray(unequalShapes);
    const wrongOpts = shuffledUnequal.slice(0, 3);
    
    // 合併並打亂順序，確保只有「剛好一個」正確答案
    let options = [correctOpt, ...wrongOpts];
    options = shuffleArray(options);
    
    // 快照當前題目資料
    GameState.currentQuestionData = {
      options: options,
      questionText: "找一找，哪一個圖形有平分？"
    };
    
    let html = `
      <!-- 雙人對戰標準狀態指示列 -->
      <div id="battle-status-bar" class="battle-status-bar">
        <span class="status-icon" id="battle-status-icon">⏳</span>
        <span class="status-text" id="battle-status-text">仔細看題思考中... <strong id="battle-status-timer">3.0</strong> 秒後開放搶答！</span>
        <div class="battle-status-progress">
          <div id="battle-status-progress-fill" class="battle-status-progress-fill"></div>
        </div>
      </div>

      <div class="pvp-split-layout">
        <!-- 玩家一 (藍貓) -->
        <div class="pvp-player-panel p1" id="pvp-panel-p1">
          <div class="player-panel-header">
            <div class="player-info p1-name">🐱 藍貓隊</div>
            <div class="player-score" id="pvp-score-p1">${GameState.p1Score} / ${GameState.pvpMaxScore} 分</div>
          </div>
          <div class="pvp-buzz-area">
            <button class="pvp-buzz-btn cooling" id="btn-buzz-p1">
              <span>🐱</span>
              <span>搶答</span>
            </button>
            <div class="pvp-action-msg" id="msg-p1">請看題思考...</div>
          </div>
        </div>
        
        <!-- 玩家二 (紅兔) -->
        <div class="pvp-player-panel p2" id="pvp-panel-p2">
          <div class="player-panel-header">
            <div class="player-info p2-name">🐰 紅兔隊</div>
            <div class="player-score" id="pvp-score-p2">${GameState.p2Score} / ${GameState.pvpMaxScore} 分</div>
          </div>
          <div class="pvp-buzz-area">
            <button class="pvp-buzz-btn cooling" id="btn-buzz-p2">
              <span>🐰</span>
              <span>搶答</span>
            </button>
            <div class="pvp-action-msg" id="msg-p2">請看題思考...</div>
          </div>
        </div>
      </div>
      
      <!-- 中央共用題目板 -->
      <div class="game-card-main" style="margin-top: 20px; min-height: 250px;">
        <div class="question-text-box">
          <button class="question-speak-btn" id="btn-pvp-q1-speak">🔊</button>
          <span>${autoAnnotate(GameState.currentQuestionData.questionText)}</span>
        </div>
        
        <!-- 選項顯示 (題目 100% 完整開源展示，尚未搶答前不可點擊) -->
        <div class="detective-choices" id="pvp-choices-grid" style="pointer-events: none; opacity: 0.85;">
          ${options.map((opt, i) => `
            <div class="detective-choice-card" data-index="${i}">
              <div class="choice-svg-wrap">${opt.draw()}</div>
              <div class="choice-label-text">
                <span class="key-badge">${i+1}</span>${autoAnnotate('圖形 ' + numToChinese[i+1])}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 朗讀
    document.getElementById('btn-pvp-q1-speak').addEventListener('click', () => {
      SpeechEngine.speak(GameState.currentQuestionData.questionText);
    });
    if (GameState.autoRead) {
      SpeechEngine.speak(GameState.currentQuestionData.questionText);
    }

    // 啟動 3.0 秒讀題思考緩衝期
    BattleManager.startThinkingPhase({
      game: 'game1',
      durationSec: 3.0,
      onSetCooling: (isCooling) => {
        const b1 = document.getElementById('btn-buzz-p1');
        const b2 = document.getElementById('btn-buzz-p2');
        if (b1) b1.classList.toggle('cooling', isCooling);
        if (b2) b2.classList.toggle('cooling', isCooling);
      },
      onThinkingComplete: () => {
        GameState.pvpLocked = false;
        const msg1 = document.getElementById('msg-p1');
        const msg2 = document.getElementById('msg-p2');
        if (msg1) msg1.innerHTML = autoAnnotate('⚡ 開放搶答！(按 A鍵 或 點擊)');
        if (msg2) msg2.innerHTML = autoAnnotate('⚡ 開放搶答！(按 L鍵 或 點擊)');
      }
    });
    
    // 鍵盤按鍵搶答輔助 (P1: 空白鍵 或 A, P2: Enter 或 L)
    const keyboardHandler = (e) => {
      if (e.code === 'KeyA' || e.code === 'Space') {
        e.preventDefault();
        this.attemptBuzz('p1');
      } else if (e.code === 'KeyL' || e.code === 'Enter') {
        e.preventDefault();
        this.attemptBuzz('p2');
      }
    };
    
    window.removeEventListener('keydown', window.pvpActiveKeyHandler);
    window.pvpActiveKeyHandler = keyboardHandler;
    window.addEventListener('keydown', window.pvpActiveKeyHandler);
    
    // 點擊觸控搶答
    document.getElementById('btn-buzz-p1').addEventListener('click', () => this.attemptBuzz('p1'));
    document.getElementById('btn-buzz-p2').addEventListener('click', () => this.attemptBuzz('p2'));
  },

  attemptBuzz(player) {
    if (BattleManager.isThinkingPhase) {
      // 思考期內偷按：震動警告與阻擋
      const btn = document.getElementById(`btn-buzz-${player}`);
      BattleManager.triggerShake(btn || document.getElementById(`pvp-panel-${player}`));
      return;
    }
    if (GameState.pvpLocked || BattleManager.isAnswerPhase) return;
    this.buzz(player, false);
  },
  
  buzz(player, isPassOn = false) {
    GameState.pvpLocked = true;
    GameState.pvpTurn = player;
    
    AudioSynth.play('click');
    
    const p1Panel = document.getElementById('pvp-panel-p1');
    const p2Panel = document.getElementById('pvp-panel-p2');
    const b1 = document.getElementById('btn-buzz-p1');
    const b2 = document.getElementById('btn-buzz-p2');
    
    if (b1) b1.classList.add('disabled');
    if (b2) b2.classList.add('disabled');
    
    if (player === 'p1') {
      if (p1Panel) p1Panel.classList.add('active-turn');
      if (p2Panel) p2Panel.classList.remove('active-turn');
      const m1 = document.getElementById('msg-p1');
      const m2 = document.getElementById('msg-p2');
      if (m1) m1.innerHTML = isPassOn ? autoAnnotate('接力作答！請點選答案！') : autoAnnotate('搶答成功！請點選答案！');
      if (m2) m2.innerHTML = autoAnnotate('對方正在答題...');
    } else {
      if (p2Panel) p2Panel.classList.add('active-turn');
      if (p1Panel) p1Panel.classList.remove('active-turn');
      const m2 = document.getElementById('msg-p2');
      const m1 = document.getElementById('msg-p1');
      if (m2) m2.innerHTML = isPassOn ? autoAnnotate('接力作答！請點選答案！') : autoAnnotate('搶答成功！請點選答案！');
      if (m1) m1.innerHTML = autoAnnotate('對方正在答題...');
    }
    
    // 啟用中央選項讓搶答者點擊
    const grid = document.getElementById('pvp-choices-grid');
    if (grid) {
      grid.style.pointerEvents = 'auto';
      grid.style.opacity = '1';
      grid.querySelectorAll('.detective-choice-card').forEach(card => {
        card.onclick = (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-index'));
          const opt = GameState.currentQuestionData.options[idx];
          this.submitPvpAnswer(player, opt.isEqual);
        };
      });
    }

    // 啟動 10 秒作答限時倒數
    BattleManager.startAnswerPhase({
      player: player,
      isPassOn: isPassOn,
      durationSec: 10,
      shortcutHint: '可用鍵盤 [1][2][3][4] 快速選答',
      onTimeout: () => this.handlePvpTimeout(player)
    });

    // 鍵盤數字快捷鍵作答監聽 [1][2][3][4]
    const answerKeyHandler = (e) => {
      let selectedIndex = null;
      if (e.code === 'Digit1' || e.code === 'Numpad1') selectedIndex = 0;
      else if (e.code === 'Digit2' || e.code === 'Numpad2') selectedIndex = 1;
      else if (e.code === 'Digit3' || e.code === 'Numpad3') selectedIndex = 2;
      else if (e.code === 'Digit4' || e.code === 'Numpad4') selectedIndex = 3;

      if (selectedIndex !== null && GameState.currentQuestionData && GameState.currentQuestionData.options[selectedIndex]) {
        e.preventDefault();
        const opt = GameState.currentQuestionData.options[selectedIndex];
        this.submitPvpAnswer(player, opt.isEqual);
      }
    };

    window.removeEventListener('keydown', window.pvpActiveKeyHandler);
    window.pvpActiveKeyHandler = answerKeyHandler;
    window.addEventListener('keydown', window.pvpActiveKeyHandler);
  },

  handlePvpTimeout(player) {
    AudioSynth.play('wrong');
    if (!BattleManager.hasPassedOn) {
      // 第一次超時：轉交給對手接力 10 秒作答
      const opponent = player === 'p1' ? 'p2' : 'p1';
      this.switchPvpTurn(opponent);
    } else {
      // 雙方皆超時
      BattleManager.cleanup();
      this.showPvpResultOverlay(null, false, true);
    }
  },

  switchPvpTurn(newPlayer) {
    this.buzz(newPlayer, true);
  },
  
  submitPvpAnswer(player, isCorrect) {
    if (isCorrect) {
      BattleManager.cleanup();
      AudioSynth.play('correct');
      AppManager.spawnConfetti();
      if (player === 'p1') GameState.p1Score++;
      else GameState.p2Score++;
      this.showPvpResultOverlay(player, true, false);
    } else {
      AudioSynth.play('wrong');
      // 答錯扣 1 分
      if (player === 'p1') GameState.p1Score = Math.max(0, GameState.p1Score - 1);
      else GameState.p2Score = Math.max(0, GameState.p2Score - 1);
      
      const s1 = document.getElementById('pvp-score-p1');
      const s2 = document.getElementById('pvp-score-p2');
      if (s1) s1.innerText = `${GameState.p1Score} / ${GameState.pvpMaxScore} 分`;
      if (s2) s2.innerText = `${GameState.p2Score} / ${GameState.pvpMaxScore} 分`;

      if (!BattleManager.hasPassedOn) {
        // 第一次答錯：接力交給對手作答！
        const opponent = player === 'p1' ? 'p2' : 'p1';
        this.switchPvpTurn(opponent);
      } else {
        // 雙方皆答錯
        BattleManager.cleanup();
        this.showPvpResultOverlay(player, false, false);
      }
    }
  },

  showPvpResultOverlay(player, isCorrect, isTimeout = false) {
    BattleManager.cleanup();
    const mainCard = document.querySelector('.game-card-main');
    if (!mainCard) return;

    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    
    const playerName = player === 'p1' ? '🐱 藍貓隊' : (player === 'p2' ? '🐰 紅兔隊' : '雙方');
    let titleStr = '';
    let reasonStr = '';

    if (isCorrect) {
      titleStr = `${playerName} ${autoAnnotate('答對了！加 1 分')}`;
      reasonStr = autoAnnotate('太厲害了！找對了平分的點心！');
    } else if (isTimeout) {
      titleStr = autoAnnotate('雙方作答皆超時！');
      reasonStr = autoAnnotate('時間到了！下一題要更快更專注喔！');
    } else {
      titleStr = autoAnnotate('雙方皆未答對～');
      reasonStr = autoAnnotate('哎呀！這幾種切法沒有平分，下一題再接再厲！');
    }
    
    overlay.innerHTML = `
      <div class="feedback-emoji">${isCorrect ? '🎉' : '😢'}</div>
      <div class="feedback-title ${isCorrect ? 'correct' : 'wrong'}">
        ${titleStr}
      </div>
      <div class="feedback-reason">
        ${reasonStr}
      </div>
      <button class="standard-btn primary-btn" id="btn-next-pvp-q">下一題 ➡️</button>
    `;
    mainCard.appendChild(overlay);
    
    document.getElementById('btn-next-pvp-q').addEventListener('click', () => {
      this.nextQuestion();
    });
  },
  
  showFinalScore() {
    BattleManager.cleanup();
    const container = document.getElementById('game-1-container');
    
    let html = '';
    if (GameState.gameMode === 'single') {
      AudioSynth.play('victory');
      html = `
        <div class="single-game-layout">
          <div class="game-complete-card">
            <div class="complete-badge">🏆</div>
            <h2>${autoAnnotate('挑戰完成！')}</h2>
            <div class="stars-container">
              ${'⭐'.repeat(GameState.singleScore)}${'☆'.repeat(GameState.maxQuestions - GameState.singleScore)}
            </div>
            <p style="font-size: 1.25rem;">
              你總共答對了 <span class="unit-fen" style="font-size: 1.5rem;">${GameState.singleScore}</span> 題喔！
            </p>
            <div style="display: flex; gap: 16px; margin-top: 16px;">
              <button class="standard-btn primary-btn" onclick="Game1Manager.start()">再玩一次 🔄</button>
              <button class="standard-btn secondary-btn" onclick="AppManager.showScreen('screen-menu')">返回選單 🔙</button>
            </div>
          </div>
        </div>
      `;
    } else {
      AudioSynth.play('victory');
      let winnerBadge = '';
      let winnerTitle = '';
      let celebrationMsg = '';
      
      if (GameState.p1Score > GameState.p2Score) {
        winnerBadge = '<div class="complete-badge" style="font-size: 6rem;">🐱</div>';
        winnerTitle = `<h2 class="p1-name">${autoAnnotate('🐱 藍貓隊獲勝！')}</h2>`;
        celebrationMsg = autoAnnotate('恭喜藍貓隊成為平分小偵探！');
      } else if (GameState.p2Score > GameState.p1Score) {
        winnerBadge = '<div class="complete-badge" style="font-size: 6rem;">🐰</div>';
        winnerTitle = `<h2 class="p2-name">${autoAnnotate('🐰 紅兔隊獲勝！')}</h2>`;
        celebrationMsg = autoAnnotate('恭喜紅兔隊成為平分小偵探！');
      } else {
        winnerBadge = '<div class="tie-badge-container"><span>🐱</span><span>🤝</span><span>🐰</span></div>';
        winnerTitle = `<h2 class="tie-title">${autoAnnotate('🤝 烘焙雙星！平分秋色！')}</h2>`;
        celebrationMsg = autoAnnotate('太厲害了！兩位小廚神實力相當，都是最棒的分數大師！');
      }
      
      html = `
        <div class="single-game-layout">
          <div class="game-complete-card">
            ${winnerBadge}
            ${winnerTitle}
            <div style="background: #F5F5F5; width: 100%; padding: 16px; border-radius: var(--radius-sm); margin: 12px 0;">
              <p style="font-size: 1.15rem; font-weight: 600;">藍貓隊：${GameState.p1Score} 分</p>
              <p style="font-size: 1.15rem; font-weight: 600;">紅兔隊：${GameState.p2Score} 分</p>
            </div>
            <p>${celebrationMsg}</p>
            <div style="display: flex; gap: 16px; margin-top: 16px;">
              <button class="standard-btn primary-btn" onclick="Game1Manager.start()">再對戰一次 🔄</button>
              <button class="standard-btn secondary-btn" onclick="AppManager.showScreen('screen-menu')">返回選單 🔙</button>
            </div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }
};


// ==========================================================================
// 8. 關卡二：點心魔法師 (Fraction Maker)
// ==========================================================================
const Game2Manager = {
  // 顧客訂單池
  orders: [
    { targetDen: 2, shape: 'circle', name: '二分之一', text: '二分之一' },
    { targetDen: 3, shape: 'rect', name: '三分之一', text: '三分之一' },
    { targetDen: 4, shape: 'circle', name: '四分之一', text: '四分之一' },
    { targetDen: 5, shape: 'rect', name: '五分之一', text: '五分之一' },
    { targetDen: 6, shape: 'circle', name: '六分之一', text: '六分之一' },
    { targetDen: 8, shape: 'circle', name: '八分之一', text: '八分之一' },
    { targetDen: 10, shape: 'rect', name: '十分之一', text: '十分之一' }
  ],
  
  currentOrder: null,
  p1State: { divider: 4, highlighted: null },
  p2State: { divider: 4, highlighted: null },
  singleState: { divider: 4, highlighted: null },
  shuffledOrders: [],
  
  start() {
    GameState.singleScore = 0;
    GameState.p1Score = 0;
    GameState.p2Score = 0;
    GameState.singleQuestionIndex = 0;
    GameState.pvpQuestionIndex = 0;
    
    // 每次開始闖關時都將訂單打亂隨機排序
    this.shuffledOrders = shuffleArray(this.orders);
    
    AppManager.showScreen('screen-game-2');
    this.nextQuestion();
  },
  
  nextQuestion() {
    window.speechSynthesis.cancel();
    
    // 重設切割狀態
    this.singleState = { divider: 4, highlighted: null };
    this.p1State = { divider: 4, highlighted: null };
    this.p2State = { divider: 4, highlighted: null };
    
    if (GameState.gameMode === 'single') {
      if (GameState.singleQuestionIndex >= GameState.maxQuestions) {
        this.showFinalScore();
        return;
      }
      // 單人闖關：依序從已打亂的陣列抽出，確保 5 題完全不重複
      this.currentOrder = this.shuffledOrders[GameState.singleQuestionIndex];
      this.renderSingleQuestion();
    } else {
      if (GameState.p1Score >= GameState.pvpMaxScore || GameState.p2Score >= GameState.pvpMaxScore) {
        this.showFinalScore();
        return;
      }
      // 雙人模式：以輪巡方式隨機出題，超出題庫長度則取餘數輪迴
      const idx = GameState.pvpQuestionIndex % this.shuffledOrders.length;
      this.currentOrder = this.shuffledOrders[idx];
      GameState.pvpQuestionIndex++;
      this.renderPvpQuestion();
    }
  },
  
  renderSingleQuestion() {
    const container = document.getElementById('game-2-container');
    const order = this.currentOrder;
    
    const shapeText = order.shape === 'circle' ? '個披薩' : '條巧克力';
    const shapeUnit = order.shape === 'circle' ? '個' : '條';
    const qText = `顧客小熊想要吃 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${order.targetDen}</span></span> <span class="unit-ge">${shapeUnit}</span>${order.shape === 'circle' ? '披薩' : '巧克力'}。請幫他切好並點選其中的 <span class="unit-fen">1 份</span> 送過去！`;
    const speechQ = `顧客小熊想要吃 ${order.name} ${shapeUnit} ${order.shape === 'circle' ? '披薩' : '巧克力'}。`;
    
    let html = `
      <div class="single-game-layout">
        <div class="game-card-main">
          <!-- 狀態列 -->
          <div class="game-status-bar">
            <div class="game-title-info">🧑‍🍳 點心魔法師 (第 ${GameState.singleQuestionIndex + 1}/${GameState.maxQuestions} 題)</div>
            <div class="game-score-stars">
              ${'⭐'.repeat(GameState.singleScore)}${'☆'.repeat(GameState.maxQuestions - GameState.singleScore)}
            </div>
          </div>
          
          <!-- 題目 -->
          <div class="question-text-box">
            <button class="question-speak-btn" id="btn-q2-speak">🔊</button>
            <span style="font-size: 1.15rem; line-height: 1.7;">${autoAnnotate(qText)}</span>
          </div>
          
          <!-- SVG 畫布 -->
          <div class="visual-panel" style="border: none; box-shadow: none; padding: 0; min-height: unset; margin: 16px 0;">
            <div class="svg-container" id="maker-svg-wrap" style="max-width: 200px; height: 200px;">
              <!-- 透過 renderMakerSvg 動態塞入 -->
            </div>
            
            <div class="fraction-display-card" style="margin-top: 12px; padding: 6px 18px;">
              <div class="fraction-formula" style="font-size: 1.4rem;">
                <div id="maker-num">0</div>
                <div class="fraction-bar" style="width: 22px;"></div>
                <div id="maker-den">${this.singleState.divider}</div>
              </div>
              <div class="fraction-name" id="maker-fraction-name" style="font-size: 1.1rem;">(請點選其中 1 份)</div>
            </div>
          </div>
          
          <!-- 操作控制區 -->
          <div class="maker-operation-area">
            <div class="maker-slider-group">
              <label>${autoAnnotate('切割份數：')}</label>
              <input type="range" id="maker-range" min="2" max="12" value="${this.singleState.divider}" step="1">
              <span class="range-value-bubble" id="maker-bubble" style="min-width: 50px;">${this.singleState.divider}</span>
            </div>
            <button class="play-btn pink-btn" id="btn-maker-submit" style="max-width: 250px; font-size: 1.15rem; padding: 10px 0;">
              ${autoAnnotate('把點心送給顧客 🍳')}
            </button>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 綁定朗讀與自動朗讀
    document.getElementById('btn-q2-speak').addEventListener('click', () => {
      SpeechEngine.speak(speechQ);
    });
    if (GameState.autoRead) {
      SpeechEngine.speak(speechQ);
    }
    
    this.renderMakerSvg('single');
    
    // 綁定拉桿與按鈕
    const range = document.getElementById('maker-range');
    range.oninput = (e) => {
      const val = parseInt(e.target.value);
      this.singleState.divider = val;
      // 重設選取，避免切分數時超出
      this.singleState.highlighted = null;
      document.getElementById('maker-bubble').innerText = val;
      this.renderMakerSvg('single');
    };
    
    document.getElementById('btn-maker-submit').addEventListener('click', () => {
      this.submitSingleAnswer();
    });
  },
  
  renderMakerSvg(player) {
    const order = this.currentOrder;
    let state, wrapId, numId, denId, nameId;
    
    if (player === 'single') {
      state = this.singleState;
      wrapId = 'maker-svg-wrap';
      numId = 'maker-num';
      denId = 'maker-den';
      nameId = 'maker-fraction-name';
    } else if (player === 'p1') {
      state = this.p1State;
      wrapId = 'pvp-svg-wrap-p1';
      numId = 'pvp-num-p1';
      denId = 'pvp-den-p1';
      nameId = 'pvp-name-p1';
    } else {
      state = this.p2State;
      wrapId = 'pvp-svg-wrap-p2';
      numId = 'pvp-num-p2';
      denId = 'pvp-den-p2';
      nameId = 'pvp-name-p2';
    }
    
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    
    let svgHtml = '';
    
    // 點擊點心切片回呼
    const clickHandler = (idx) => {
      if (player !== 'single' && BattleManager.isThinkingPhase) {
        const panel = document.getElementById(player === 'p1' ? 'maker-panel-p1' : 'maker-panel-p2');
        BattleManager.triggerShake(panel);
        return;
      }
      AudioSynth.play('click');
      state.highlighted = idx;
      this.renderMakerSvg(player);
    };
    
    if (order.shape === 'circle') {
      svgHtml = SVGRenderer.drawCircleFraction(state.divider, state.highlighted, clickHandler);
    } else {
      svgHtml = SVGRenderer.drawRectFraction(state.divider, state.highlighted, clickHandler);
    }
    
    wrap.innerHTML = svgHtml;
    
    // 重新為切片加點擊監聽 (動態 SVG 的 class)
    wrap.querySelectorAll('.slice-path').forEach(path => {
      path.onclick = (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        clickHandler(idx);
      };
    });
    
    // 更新分數介面
    const numEl = document.getElementById(numId);
    const denEl = document.getElementById(denId);
    const nameEl = document.getElementById(nameId);
    
    if (numEl && denEl) {
      denEl.innerText = state.divider;
      if (state.highlighted !== null) {
        numEl.innerText = "1";
        const textPhrase = numToChinese[state.divider] + "分之一";
        nameEl.innerHTML = autoAnnotate(textPhrase);
      } else {
        numEl.innerText = "0";
        nameEl.innerHTML = `<span style="color:#C62828;">${autoAnnotate('(請選取 1 份)')}</span>`;
      }
    }
  },
  
  submitSingleAnswer() {
    const order = this.currentOrder;
    const state = this.singleState;
    const mainCard = document.querySelector('.game-card-main');
    
    if (mainCard.querySelector('.feedback-overlay')) return;
    
    // 判定標準：分母正確，且確實選取 1 份做為單位分數
    const isCorrect = (state.divider === order.targetDen && state.highlighted !== null);
    
    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    
    let titleHtml = '';
    let reasonHtml = '';
    
    if (isCorrect) {
      AudioSynth.play('correct');
      AppManager.spawnConfetti();
      GameState.singleScore++;
      titleHtml = `<div class="feedback-title correct">${autoAnnotate('太厲害了！答對了')}</div>`;
      reasonHtml = `<div class="feedback-reason">${autoAnnotate(`成功做出了 ${order.name} 個點心給小熊吃！`)}</div>`;
    } else {
      AudioSynth.play('wrong');
      titleHtml = `<div class="feedback-title wrong">${autoAnnotate('切法不太對喔...')}</div>`;
      const shapeUnitStr = order.shape === 'circle' ? '個' : '條';
      const shapeName = order.shape === 'circle' ? '蛋糕' : '巧克力';
      
      if (state.highlighted === null) {
        reasonHtml = `<div class="feedback-reason">${autoAnnotate(`你把點心分好了，但別忘了點選其中的 1 份裝盤喔！`)}</div>`;
      } else {
        reasonHtml = `<div class="feedback-reason">${autoAnnotate(`要把點心平分成 ${order.targetDen} 份，其中的 1 份才是 ${order.name} ${shapeUnitStr}${shapeName} 喔！`)}</div>`;
      }
    }
    
    overlay.innerHTML = `
      <div class="feedback-emoji">${isCorrect ? '🧑‍🍳' : '🧁'}</div>
      ${titleHtml}
      ${reasonHtml}
      <button class="standard-btn primary-btn" id="btn-next-q2">下一題 ➡️</button>
    `;
    
    mainCard.appendChild(overlay);
    
    document.getElementById('btn-next-q2').addEventListener('click', () => {
      GameState.singleQuestionIndex++;
      this.nextQuestion();
    });
  },
  
  // --------------------------------------------------
  // 雙人對戰版題目渲染 (同屏分流競速型 - 標準化升級)
  // --------------------------------------------------
  renderPvpQuestion() {
    BattleManager.cleanup();
    const container = document.getElementById('game-2-container');
    const order = this.currentOrder;
    
    const shapeText = order.shape === 'circle' ? '個披薩' : '條巧克力';
    const shapeUnit = order.shape === 'circle' ? '個' : '條';
    const qText = `快！顧客想要吃 <span class="math-fraction" style="font-size: 1.3rem;"><span class="num">1</span><span class="bar"></span><span class="den">${order.targetDen}</span></span> <span class="unit-ge">${shapeUnit}</span>${order.shape === 'circle' ? '披薩' : '巧克力'}。誰先做好並送出就能得分！`;
    const speechQ = `請做 ${order.name} ${shapeUnit} ${order.shape === 'circle' ? '披薩' : '巧克力'}。`;
    
    let html = `
      <!-- 雙人對戰標準狀態指示列 -->
      <div id="battle-status-bar" class="battle-status-bar">
        <span class="status-icon" id="battle-status-icon">⏳</span>
        <span class="status-text" id="battle-status-text">仔細看題思考中... <strong id="battle-status-timer">3.0</strong> 秒後開放競速！</span>
        <div class="battle-status-progress">
          <div id="battle-status-progress-fill" class="battle-status-progress-fill"></div>
        </div>
      </div>

      <!-- 頂部共用題目區 (100% 開放清楚顯示) -->
      <div class="game-card-main" style="margin-bottom: 12px; padding: 16px 24px;">
        <div class="question-text-box" style="margin-bottom: 0;">
          <button class="question-speak-btn" id="btn-pvp-q2-speak">🔊</button>
          <span style="font-size:1.15rem;">${autoAnnotate(qText)}</span>
        </div>
      </div>
      
      <div class="pvp-split-layout">
        <!-- P1 (藍貓) -->
        <div class="pvp-player-panel p1 cooling" id="maker-panel-p1">
          <div class="player-panel-header">
            <div class="player-info p1-name">🐱 藍貓隊</div>
            <div class="player-score">${GameState.p1Score} / ${GameState.pvpMaxScore} 分</div>
          </div>
          
          <div class="svg-container" id="pvp-svg-wrap-p1" style="max-width: 160px; height: 160px;"></div>
          
          <div class="fraction-display-card" style="margin-top: 8px; padding: 4px 12px; gap: 10px;">
            <div class="fraction-formula" style="font-size: 1.15rem;">
              <div id="pvp-num-p1">0</div>
              <div class="fraction-bar" style="width: 18px;"></div>
              <div id="pvp-den-p1">4</div>
            </div>
            <div class="fraction-name" id="pvp-name-p1" style="font-size: 0.9rem;">(請點選 1 份)</div>
          </div>
          
          <div class="maker-operation-area" style="margin-top: 16px;">
            <div class="maker-slider-group" style="padding: 6px 12px; gap: 8px; max-width: 260px;">
              <label style="font-size:0.9rem;">切割：</label>
              <input type="range" id="pvp-range-p1" min="2" max="12" value="4" step="1">
              <span class="range-value-bubble" id="pvp-bubble-p1" style="min-width: 38px; padding: 3px 6px; font-size: 0.85rem;">4</span>
            </div>
            <button class="play-btn blue-btn" id="btn-pvp-submit-p1" style="font-size: 1rem; padding: 8px 0; margin-top: 10px;">
              送出點心 🐱
            </button>
            <div id="pvp-lock-msg-p1" style="color: red; font-size: 0.85rem; height: 20px;"></div>
          </div>
        </div>
        
        <!-- P2 (紅兔) -->
        <div class="pvp-player-panel p2 cooling" id="maker-panel-p2">
          <div class="player-panel-header">
            <div class="player-info p2-name">🐰 紅兔隊</div>
            <div class="player-score">${GameState.p2Score} / ${GameState.pvpMaxScore} 分</div>
          </div>
          
          <div class="svg-container" id="pvp-svg-wrap-p2" style="max-width: 160px; height: 160px;"></div>
          
          <div class="fraction-display-card" style="margin-top: 8px; padding: 4px 12px; gap: 10px;">
            <div class="fraction-formula" style="font-size: 1.15rem;">
              <div id="pvp-num-p2">0</div>
              <div class="fraction-bar" style="width: 18px;"></div>
              <div id="pvp-den-p2">4</div>
            </div>
            <div class="fraction-name" id="pvp-name-p2" style="font-size: 0.9rem;">(請點選 1 份)</div>
          </div>
          
          <div class="maker-operation-area" style="margin-top: 16px;">
            <div class="maker-slider-group" style="padding: 6px 12px; gap: 8px; max-width: 260px;">
              <label style="font-size:0.9rem;">切割：</label>
              <input type="range" id="pvp-range-p2" min="2" max="12" value="4" step="1">
              <span class="range-value-bubble" id="pvp-bubble-p2" style="min-width: 38px; padding: 3px 6px; font-size: 0.85rem;">4</span>
            </div>
            <button class="play-btn pink-btn" id="btn-pvp-submit-p2" style="font-size: 1rem; padding: 8px 0; margin-top: 10px;">
              送出點心 🐰
            </button>
            <div id="pvp-lock-msg-p2" style="color: red; font-size: 0.85rem; height: 20px;"></div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 朗讀
    document.getElementById('btn-pvp-q2-speak').addEventListener('click', () => {
      SpeechEngine.speak(speechQ);
    });
    if (GameState.autoRead) {
      SpeechEngine.speak(speechQ);
    }
    
    // 渲染兩個玩家的畫布
    this.renderMakerSvg('p1');
    this.renderMakerSvg('p2');

    // 啟動 3.0 秒讀題思考緩衝期
    BattleManager.startThinkingPhase({
      game: 'game2',
      durationSec: 3.0,
      onSetCooling: (isCooling) => {
        const p1 = document.getElementById('maker-panel-p1');
        const p2 = document.getElementById('maker-panel-p2');
        if (p1) p1.classList.toggle('cooling', isCooling);
        if (p2) p2.classList.toggle('cooling', isCooling);
      },
      onThinkingComplete: () => {
        // 雙方面板解鎖，競速開始
      }
    });
    
    // 綁定 P1 拉桿與送出 (具備思考期防偷跑檢查)
    const r1 = document.getElementById('pvp-range-p1');
    r1.oninput = (e) => {
      if (BattleManager.isThinkingPhase) {
        e.target.value = this.p1State.divider;
        const panel = document.getElementById('maker-panel-p1');
        BattleManager.triggerShake(panel);
        return;
      }
      this.p1State.divider = parseInt(e.target.value);
      this.p1State.highlighted = null;
      document.getElementById('pvp-bubble-p1').innerText = this.p1State.divider;
      this.renderMakerSvg('p1');
    };
    
    // 綁定 P2 拉桿與送出 (具備思考期防偷跑檢查)
    const r2 = document.getElementById('pvp-range-p2');
    r2.oninput = (e) => {
      if (BattleManager.isThinkingPhase) {
        e.target.value = this.p2State.divider;
        const panel = document.getElementById('maker-panel-p2');
        BattleManager.triggerShake(panel);
        return;
      }
      this.p2State.divider = parseInt(e.target.value);
      this.p2State.highlighted = null;
      document.getElementById('pvp-bubble-p2').innerText = this.p2State.divider;
      this.renderMakerSvg('p2');
    };
    
    document.getElementById('btn-pvp-submit-p1').onclick = () => {
      if (BattleManager.isThinkingPhase) {
        const panel = document.getElementById('maker-panel-p1');
        BattleManager.triggerShake(panel);
        return;
      }
      this.submitPvpMaker('p1');
    };

    document.getElementById('btn-pvp-submit-p2').onclick = () => {
      if (BattleManager.isThinkingPhase) {
        const panel = document.getElementById('maker-panel-p2');
        BattleManager.triggerShake(panel);
        return;
      }
      this.submitPvpMaker('p2');
    };
  },
  
  submitPvpMaker(player) {
    if (BattleManager.isThinkingPhase) return;
    const order = this.currentOrder;
    const state = player === 'p1' ? this.p1State : this.p2State;
    const btn = document.getElementById(`btn-pvp-submit-${player}`);
    const lockMsg = document.getElementById(`pvp-lock-msg-${player}`);
    
    // 判定
    const isCorrect = (state.divider === order.targetDen && state.highlighted !== null);
    
    if (isCorrect) {
      BattleManager.cleanup();
      AudioSynth.play('correct');
      AppManager.spawnConfetti();
      
      if (player === 'p1') GameState.p1Score++;
      else GameState.p2Score++;
      
      // 答對，直接進結算
      const container = document.getElementById('game-2-container');
      const overlay = document.createElement('div');
      overlay.className = 'feedback-overlay';
      overlay.style.position = 'fixed';
      
      const winnerName = player === 'p1' ? '🐱 藍貓隊' : '🐰 紅兔隊';
      overlay.innerHTML = `
        <div class="feedback-emoji">🏆</div>
        <div class="feedback-title correct">${winnerName} ${autoAnnotate('答對了！')}</div>
        <div class="feedback-reason">${autoAnnotate(`成功做出了正確的單位分數，加 1 分！`)}</div>
        <button class="standard-btn primary-btn" id="btn-next-pvp-q2">下一題 ➡️</button>
      `;
      container.appendChild(overlay);
      
      document.getElementById('btn-next-pvp-q2').addEventListener('click', () => {
        this.nextQuestion();
      });
    } else {
      // 答錯，浮現童趣冰凍思考覆蓋層，鎖定該玩家 3 秒
      AudioSynth.play('wrong');
      const panel = document.getElementById(`maker-panel-${player}`);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
      
      // 建立或取得冰凍覆蓋層
      let freezeOverlay = panel ? panel.querySelector('.freeze-overlay') : null;
      if (!freezeOverlay && panel) {
        freezeOverlay = document.createElement('div');
        freezeOverlay.className = 'freeze-overlay';
        freezeOverlay.innerHTML = `
          <div class="freeze-icon">❄️</div>
          <div class="freeze-title">${autoAnnotate('冰凍思考中...')}</div>
          <div class="freeze-countdown" id="freeze-timer-${player}">3 秒後解凍</div>
        `;
        panel.appendChild(freezeOverlay);
      }
      
      let sec = 3;
      if (lockMsg) lockMsg.innerHTML = autoAnnotate(`答錯了！凍結 ${sec} 秒`);
      
      const interval = setInterval(() => {
        sec--;
        const timerEl = document.getElementById(`freeze-timer-${player}`);
        if (sec <= 0) {
          clearInterval(interval);
          if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
          }
          if (lockMsg) lockMsg.innerHTML = '';
          if (freezeOverlay && freezeOverlay.parentNode) {
            freezeOverlay.remove();
          }
        } else {
          if (timerEl) timerEl.innerText = `${sec} 秒後解凍`;
          if (lockMsg) lockMsg.innerHTML = autoAnnotate(`答錯了！凍結 ${sec} 秒`);
        }
      }, 1000);
    }
  },
  
  showFinalScore() {
    BattleManager.cleanup();
    const container = document.getElementById('game-2-container');
    let html = '';
    
    if (GameState.gameMode === 'single') {
      AudioSynth.play('victory');
      html = `
        <div class="single-game-layout">
          <div class="game-complete-card">
            <div class="complete-badge">🏆</div>
            <h2>${autoAnnotate('廚神修煉完成！')}</h2>
            <div class="stars-container">
              ${'⭐'.repeat(GameState.singleScore)}${'☆'.repeat(GameState.maxQuestions - GameState.singleScore)}
            </div>
            <p>${autoAnnotate(`你成功服務了 ${GameState.singleScore} 位點心客人喔！`)}</p>
            <div style="display: flex; gap: 16px; margin-top: 16px;">
              <button class="standard-btn primary-btn" onclick="Game2Manager.start()">再玩一次 🔄</button>
              <button class="standard-btn secondary-btn" onclick="AppManager.showScreen('screen-menu')">返回選單 🔙</button>
            </div>
          </div>
        </div>
      `;
    } else {
      AudioSynth.play('victory');
      let winnerBadge = '';
      let winnerTitle = '';
      let celebrationMsg = '';
      
      if (GameState.p1Score > GameState.p2Score) {
        winnerBadge = '<div class="complete-badge" style="font-size: 6rem;">🐱</div>';
        winnerTitle = `<h2 class="p1-name">${autoAnnotate('🐱 藍貓隊獲勝！')}</h2>`;
        celebrationMsg = autoAnnotate('恭喜藍貓隊成為頂尖分數魔法師！');
      } else if (GameState.p2Score > GameState.p1Score) {
        winnerBadge = '<div class="complete-badge" style="font-size: 6rem;">🐰</div>';
        winnerTitle = `<h2 class="p2-name">${autoAnnotate('🐰 紅兔隊獲勝！')}</h2>`;
        celebrationMsg = autoAnnotate('恭喜紅兔隊成為頂尖分數魔法師！');
      } else {
        winnerBadge = '<div class="tie-badge-container"><span>🐱</span><span>🤝</span><span>🐰</span></div>';
        winnerTitle = `<h2 class="tie-title">${autoAnnotate('🤝 烘焙雙星！平分秋色！')}</h2>`;
        celebrationMsg = autoAnnotate('太厲害了！兩位魔法廚師手藝難分高下，都是頂尖點心大師！');
      }
      
      html = `
        <div class="single-game-layout">
          <div class="game-complete-card">
            ${winnerBadge}
            ${winnerTitle}
            <div style="background: #F5F5F5; width: 100%; padding: 16px; border-radius: var(--radius-sm); margin: 12px 0;">
              <p style="font-size: 1.15rem; font-weight: 600;">藍貓隊：${GameState.p1Score} 分</p>
              <p style="font-size: 1.15rem; font-weight: 600;">紅兔隊：${GameState.p2Score} 分</p>
            </div>
            <p>${celebrationMsg}</p>
            <div style="display: flex; gap: 16px; margin-top: 16px;">
              <button class="standard-btn primary-btn" onclick="Game2Manager.start()">再對戰一次 🔄</button>
              <button class="standard-btn secondary-btn" onclick="AppManager.showScreen('screen-menu')">返回選單 🔙</button>
            </div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
};


// ==========================================================================
// 9. 關卡三：貪吃熊比大小 (Fraction Comparison)
// ==========================================================================
const Game3Manager = {
  // 比大小題目池 (等分切法)
  questions: [
    { den1: 2, den2: 3, shape: 'circle' },
    { den1: 3, den2: 4, shape: 'rect' },
    { den1: 4, den2: 2, shape: 'circle' },
    { den1: 5, den2: 8, shape: 'circle' },
    { den1: 6, den2: 3, shape: 'rect' },
    { den1: 10, den2: 5, shape: 'rect' },
    { den1: 4, den2: 6, shape: 'circle' },
    { den1: 8, den2: 12, shape: 'circle' }
  ],
  
  shuffledQuestions: [],
  
  start() {
    GameState.singleScore = 0;
    GameState.p1Score = 0;
    GameState.p2Score = 0;
    GameState.singleQuestionIndex = 0;
    GameState.pvpQuestionIndex = 0;
    GameState.pvpLocked = false;
    
    // 洗牌打亂比大小題目池
    this.shuffledQuestions = shuffleArray(this.questions);
    
    AppManager.showScreen('screen-game-3');
    this.nextQuestion();
  },
  
  nextQuestion() {
    window.speechSynthesis.cancel();
    
    if (GameState.gameMode === 'single') {
      if (GameState.singleQuestionIndex >= GameState.maxQuestions) {
        this.showFinalScore();
        return;
      }
      this.renderSingleQuestion();
    } else {
      if (GameState.p1Score >= GameState.pvpMaxScore || GameState.p2Score >= GameState.pvpMaxScore) {
        this.showFinalScore();
        return;
      }
      // 重設搶答狀態，避免下一題無法搶答
      GameState.pvpLocked = false;
      GameState.pvpTurn = null;
      this.renderPvpQuestion();
    }
  },
  
  renderSingleQuestion() {
    const container = document.getElementById('game-3-container');
    
    // 依序取出打亂後的題目，確保 5 題完全不重複
    const q = this.shuffledQuestions[GameState.singleQuestionIndex];
    GameState.currentQuestionData = q;
    
    const shapeUnitStr = q.shape === 'circle' ? '個' : '條';
    const shapeNameStr = q.shape === 'circle' ? '蛋糕' : '巧克力';
    
    const questionText = `小熊樂樂和小貓咪咪拿了相同大小的${shapeNameStr}。小熊樂樂吃了 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${q.den1}</span></span> <span class="unit-ge">${shapeUnitStr}</span>${shapeNameStr}，小貓咪咪吃了 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${q.den2}</span></span> <span class="unit-ge">${shapeUnitStr}</span>${shapeNameStr}。誰吃得比較多？`;
    const speechText = `小熊樂樂和小貓咪咪拿了相同大小的${shapeNameStr}。小熊樂樂吃了 ${numToChinese[q.den1]}分之一 ${shapeUnitStr}${shapeNameStr}，小貓咪咪吃了 ${numToChinese[q.den2]}分之一 ${shapeUnitStr}${shapeNameStr}。誰吃得比較多？`;
    
    const html = `
      <div class="single-game-layout">
        <div class="game-card-main">
          <!-- 狀態列 -->
          <div class="game-status-bar">
            <div class="game-title-info">🐻 貪吃熊比大小 (第 ${GameState.singleQuestionIndex + 1}/${GameState.maxQuestions} 題)</div>
            <div class="game-score-stars">
              ${'⭐'.repeat(GameState.singleScore)}${'☆'.repeat(GameState.maxQuestions - GameState.singleScore)}
            </div>
          </div>
          
          <!-- 題目 -->
          <div class="question-text-box" style="flex-direction: column; align-items: center; gap: 8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="question-speak-btn" id="btn-q3-speak">🔊</button>
              <span style="font-weight:700; font-size:1.3rem;">${autoAnnotate('誰吃得比較多？')}</span>
            </div>
            <p style="font-size: 1.05rem; color: var(--color-text-muted); line-height: 1.7;">
              ${autoAnnotate(`小熊樂樂和小貓咪咪拿了相同大小的${shapeNameStr}。<br>小熊樂樂吃了 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${q.den1}</span></span> <span class="unit-ge">${shapeUnitStr}</span>${shapeNameStr}，小貓咪咪吃了 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${q.den2}</span></span> <span class="unit-ge">${shapeUnitStr}</span>${shapeNameStr}。`)}
            </p>
          </div>
          
          <!-- 卡片選項比較 -->
          <div class="comparison-layout">
            <div class="comparison-options">
              <!-- 小熊樂樂 (1/den1) -->
              <div class="comparison-option-card" id="opt-bear" data-target="bear">
                <span class="option-character">🐻</span>
                <span class="choice-label-text" style="color: #8D6E63;">${autoAnnotate('小熊樂樂')}</span>
                <div class="option-svg-wrap">
                  ${q.shape === 'circle' ? SVGRenderer.drawCircleFraction(q.den1, 0) : SVGRenderer.drawRectFraction(q.den1, 0)}
                </div>
                <div class="option-fraction-label">
                  <div class="text-fraction"><span>1</span><span></span><span>${q.den1}</span></div>
                  <span class="text-phrase">${autoAnnotate(shapeUnitStr + shapeNameStr)}</span>
                </div>
              </div>
              
              <!-- 小貓咪咪 (1/den2) -->
              <div class="comparison-option-card" id="opt-cat" data-target="cat">
                <span class="option-character">🐱</span>
                <span class="choice-label-text" style="color: #FF8A80;">${autoAnnotate('小貓咪咪')}</span>
                <div class="option-svg-wrap">
                  ${q.shape === 'circle' ? SVGRenderer.drawCircleFraction(q.den2, 0) : SVGRenderer.drawRectFraction(q.den2, 0)}
                </div>
                <div class="option-fraction-label">
                  <div class="text-fraction"><span>1</span><span></span><span>${q.den2}</span></div>
                  <span class="text-phrase">${autoAnnotate(shapeUnitStr + shapeNameStr)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 朗讀與自動朗讀
    document.getElementById('btn-q3-speak').addEventListener('click', () => {
      SpeechEngine.speak(speechText);
    });
    if (GameState.autoRead) {
      SpeechEngine.speak(speechText);
    }
    
    // 點擊事件
    const ansBear = document.getElementById('opt-bear');
    const ansCat = document.getElementById('opt-cat');
    
    ansBear.onclick = () => this.submitSingleAnswer('bear');
    ansCat.onclick = () => this.submitSingleAnswer('cat');
  },
  
  submitSingleAnswer(choice) {
    const q = GameState.currentQuestionData;
    const mainCard = document.querySelector('.game-card-main');
    if (mainCard.querySelector('.feedback-overlay')) return;
    
    // 分母越小，單位分數越大！
    const correctAns = q.den1 < q.den2 ? 'bear' : 'cat';
    const isCorrect = (choice === correctAns);
    
    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    
    let titleHtml = '';
    let reasonHtml = '';
    
    if (isCorrect) {
      AudioSynth.play('correct');
      AppManager.spawnConfetti();
      GameState.singleScore++;
      
      const bigDen = choice === 'bear' ? q.den1 : q.den2;
      const smallDen = choice === 'bear' ? q.den2 : q.den1;
      
      titleHtml = `<div class="feedback-title correct">${autoAnnotate('答對了！太棒了')}</div>`;
      reasonHtml = `<div class="feedback-reason">
        ${autoAnnotate('沒錯！')} ${getFractionHTML(1, bigDen)} ${autoAnnotate('比')} ${getFractionHTML(1, smallDen)} ${autoAnnotate('還要大喔！')}<br>
        <span style="font-size:0.95rem; color:#4CAF50;">
          💡 ${autoAnnotate('小秘笈：平分給越少人（分母越小），每個人分到的那一份就會越大喔！')}
        </span>
      </div>`;
    } else {
      AudioSynth.play('wrong');
      const correctCharacter = correctAns === 'bear' ? '小熊樂樂' : '小貓咪咪';
      const wrongDen = choice === 'bear' ? q.den1 : q.den2;
      const rightDen = correctAns === 'bear' ? q.den1 : q.den2;
      
      titleHtml = `<div class="feedback-title wrong">${autoAnnotate('哎呀！猜錯了～')}</div>`;
      reasonHtml = `<div class="feedback-reason">
        ${autoAnnotate(`答案應該是 ${correctCharacter} 喔。`)}<br>
        ${autoAnnotate('因為')} ${getFractionHTML(1, rightDen)} ${autoAnnotate('比')} ${getFractionHTML(1, wrongDen)} ${autoAnnotate('還要大！平分成越少份，每一份才會越大。')}
      </div>`;
    }
    
    overlay.innerHTML = `
      <div class="feedback-emoji">${isCorrect ? '🌟' : '🤔'}</div>
      ${titleHtml}
      ${reasonHtml}
      <button class="standard-btn primary-btn" id="btn-next-q3">下一題 ➡️</button>
    `;
    mainCard.appendChild(overlay);
    
    document.getElementById('btn-next-q3').addEventListener('click', () => {
      GameState.singleQuestionIndex++;
      this.nextQuestion();
    });
  },
  
  // --------------------------------------------------
  // 雙人對戰版題目渲染 (搶答比大小 - 標準化升級)
  // --------------------------------------------------
  renderPvpQuestion() {
    BattleManager.cleanup();
    const container = document.getElementById('game-3-container');
    
    // 依序取出打亂後的題目，避免重複
    const idx = GameState.pvpQuestionIndex % this.shuffledQuestions.length;
    const q = this.shuffledQuestions[idx];
    GameState.pvpQuestionIndex++;
    GameState.currentQuestionData = q;
    
    const shapeUnitStr = q.shape === 'circle' ? '個' : '條';
    const shapeNameStr = q.shape === 'circle' ? '蛋糕' : '巧克力';
    
    const speechText = `小熊樂樂和小貓咪咪拿了相同大小的${shapeNameStr}。小熊樂樂吃了 ${numToChinese[q.den1]}分之一 ${shapeUnitStr}，小貓咪咪吃了 ${numToChinese[q.den2]}分之一 ${shapeUnitStr}。誰吃得比較多？`;
    
    let html = `
      <!-- 雙人對戰標準狀態指示列 -->
      <div id="battle-status-bar" class="battle-status-bar">
        <span class="status-icon" id="battle-status-icon">⏳</span>
        <span class="status-text" id="battle-status-text">仔細看題思考中... <strong id="battle-status-timer">3.0</strong> 秒後開放搶答！</span>
        <div class="battle-status-progress">
          <div id="battle-status-progress-fill" class="battle-status-progress-fill"></div>
        </div>
      </div>

      <div class="pvp-split-layout">
        <!-- 玩家一 (藍貓) -->
        <div class="pvp-player-panel p1" id="pvp3-panel-p1">
          <div class="player-panel-header">
            <div class="player-info p1-name">🐱 藍貓隊</div>
            <div class="player-score" id="pvp3-score-p1">${GameState.p1Score} / ${GameState.pvpMaxScore} 分</div>
          </div>
          <div class="pvp-buzz-area">
            <button class="pvp-buzz-btn cooling" id="btn-buzz3-p1">
              <span>🐱</span>
              <span>搶答</span>
            </button>
            <div class="pvp-action-msg" id="msg3-p1">請看題思考...</div>
          </div>
        </div>
        
        <!-- 玩家二 (紅兔) -->
        <div class="pvp-player-panel p2" id="pvp3-panel-p2">
          <div class="player-panel-header">
            <div class="player-info p2-name">🐰 紅兔隊</div>
            <div class="player-score" id="pvp3-score-p2">${GameState.p2Score} / ${GameState.pvpMaxScore} 分</div>
          </div>
          <div class="pvp-buzz-area">
            <button class="pvp-buzz-btn cooling" id="btn-buzz3-p2">
              <span>🐰</span>
              <span>搶答</span>
            </button>
            <div class="pvp-action-msg" id="msg3-p2">請看題思考...</div>
          </div>
        </div>
      </div>
      
      <!-- 中央比對板 (100% 完整開源展示) -->
      <div class="game-card-main" style="margin-top: 20px; min-height: 280px;">
        <div class="question-text-box" style="flex-direction: column; gap: 4px; margin-bottom: 16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="question-speak-btn" id="btn-pvp-q3-speak">🔊</button>
            <span style="font-weight:700; font-size:1.2rem;">${autoAnnotate('誰吃得比較多？')}</span>
          </div>
          <p style="font-size:0.95rem; color:var(--color-text-muted); line-height:1.7;">
            ${autoAnnotate(`小熊樂樂和小貓咪咪拿了相同大小的${shapeNameStr}。<br>小熊樂樂吃了 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${q.den1}</span></span> <span class="unit-ge">${shapeUnitStr}</span>，小貓咪咪吃了 <span class="math-fraction"><span class="num">1</span><span class="bar"></span><span class="den">${q.den2}</span></span> <span class="unit-ge">${shapeUnitStr}</span>。`)}
          </p>
        </div>
        
        <!-- 左右卡片選項 (搶答前不可點擊) -->
        <div class="comparison-options" id="pvp3-choices" style="pointer-events: none; opacity: 0.85; width:100%;">
          <!-- 小熊樂樂 (1/den1) -->
          <div class="comparison-option-card" id="pvp3-opt-bear" data-target="bear" style="flex:1;">
            <span class="option-character">🐻</span>
            <span class="choice-label-text"><span class="key-badge">1</span>小熊樂樂</span>
            <div class="option-svg-wrap" style="width:90px; height:90px;">
              ${q.shape === 'circle' ? SVGRenderer.drawCircleFraction(q.den1, 0) : SVGRenderer.drawRectFraction(q.den1, 0)}
            </div>
            <div class="option-fraction-label">
              <div class="text-fraction" style="font-size:1.15rem;"><span>1</span><span></span><span>${q.den1}</span></div>
            </div>
          </div>
          
          <!-- 小貓咪咪 (1/den2) -->
          <div class="comparison-option-card" id="pvp3-opt-cat" data-target="cat" style="flex:1;">
            <span class="option-character">🐱</span>
            <span class="choice-label-text"><span class="key-badge">2</span>小貓咪咪</span>
            <div class="option-svg-wrap" style="width:90px; height:90px;">
              ${q.shape === 'circle' ? SVGRenderer.drawCircleFraction(q.den2, 0) : SVGRenderer.drawRectFraction(q.den2, 0)}
            </div>
            <div class="option-fraction-label">
              <div class="text-fraction" style="font-size:1.15rem;"><span>1</span><span></span><span>${q.den2}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 朗讀
    document.getElementById('btn-pvp-q3-speak').addEventListener('click', () => {
      SpeechEngine.speak(speechText);
    });
    if (GameState.autoRead) {
      SpeechEngine.speak(speechText);
    }

    // 啟動 4.0 秒讀題思考緩衝期 (長故事題幹充裕兼顧 TTS 朗讀)
    BattleManager.startThinkingPhase({
      game: 'game3',
      durationSec: 4.0,
      onSetCooling: (isCooling) => {
        const b1 = document.getElementById('btn-buzz3-p1');
        const b2 = document.getElementById('btn-buzz3-p2');
        if (b1) b1.classList.toggle('cooling', isCooling);
        if (b2) b2.classList.toggle('cooling', isCooling);
      },
      onThinkingComplete: () => {
        GameState.pvpLocked = false;
        const msg1 = document.getElementById('msg3-p1');
        const msg2 = document.getElementById('msg3-p2');
        if (msg1) msg1.innerHTML = autoAnnotate('⚡ 開放搶答！(按 A鍵 或 點擊)');
        if (msg2) msg2.innerHTML = autoAnnotate('⚡ 開放搶答！(按 L鍵 或 點擊)');
      }
    });
    
    // 鍵盤輔助搶答
    const keyboardHandler = (e) => {
      if (e.code === 'KeyA' || e.code === 'Space') {
        e.preventDefault();
        this.attemptBuzz('p1');
      } else if (e.code === 'KeyL' || e.code === 'Enter') {
        e.preventDefault();
        this.attemptBuzz('p2');
      }
    };
    
    window.removeEventListener('keydown', window.pvpActiveKeyHandler);
    window.pvpActiveKeyHandler = keyboardHandler;
    window.addEventListener('keydown', window.pvpActiveKeyHandler);
    
    document.getElementById('btn-buzz3-p1').onclick = () => this.attemptBuzz('p1');
    document.getElementById('btn-buzz3-p2').onclick = () => this.attemptBuzz('p2');
  },

  attemptBuzz(player) {
    if (BattleManager.isThinkingPhase) {
      const btn = document.getElementById(`btn-buzz3-${player}`);
      BattleManager.triggerShake(btn || document.getElementById(`pvp3-panel-${player}`));
      return;
    }
    if (GameState.pvpLocked || BattleManager.isAnswerPhase) return;
    this.buzz(player, false);
  },
  
  buzz(player, isPassOn = false) {
    GameState.pvpLocked = true;
    GameState.pvpTurn = player;
    
    AudioSynth.play('click');
    
    const p1Panel = document.getElementById('pvp3-panel-p1');
    const p2Panel = document.getElementById('pvp3-panel-p2');
    const b1 = document.getElementById('btn-buzz3-p1');
    const b2 = document.getElementById('btn-buzz3-p2');
    
    if (b1) b1.classList.add('disabled');
    if (b2) b2.classList.add('disabled');
    
    if (player === 'p1') {
      if (p1Panel) p1Panel.classList.add('active-turn');
      if (p2Panel) p2Panel.classList.remove('active-turn');
      const m1 = document.getElementById('msg3-p1');
      const m2 = document.getElementById('msg3-p2');
      if (m1) m1.innerHTML = isPassOn ? autoAnnotate('接力作答！請點選答案！') : autoAnnotate('搶答成功！請點選答案！');
      if (m2) m2.innerHTML = autoAnnotate('對方正在答題...');
    } else {
      if (p2Panel) p2Panel.classList.add('active-turn');
      if (p1Panel) p1Panel.classList.remove('active-turn');
      const m2 = document.getElementById('msg3-p2');
      const m1 = document.getElementById('msg3-p1');
      if (m2) m2.innerHTML = isPassOn ? autoAnnotate('接力作答！請點選答案！') : autoAnnotate('搶答成功！請點選答案！');
      if (m1) m1.innerHTML = autoAnnotate('對方正在答題...');
    }
    
    // 啟用卡片點擊
    const choices = document.getElementById('pvp3-choices');
    if (choices) {
      choices.style.pointerEvents = 'auto';
      choices.style.opacity = '1';
    }
    
    const bearCard = document.getElementById('pvp3-opt-bear');
    const catCard = document.getElementById('pvp3-opt-cat');
    if (bearCard) {
      bearCard.classList.remove('p1-hover', 'p2-hover');
      bearCard.classList.add(player === 'p1' ? 'p1-hover' : 'p2-hover');
      bearCard.onclick = () => this.submitPvpAnswer(player, 'bear');
    }
    if (catCard) {
      catCard.classList.remove('p1-hover', 'p2-hover');
      catCard.classList.add(player === 'p1' ? 'p1-hover' : 'p2-hover');
      catCard.onclick = () => this.submitPvpAnswer(player, 'cat');
    }

    // 啟動 10 秒作答倒數
    BattleManager.startAnswerPhase({
      player: player,
      isPassOn: isPassOn,
      durationSec: 10,
      shortcutHint: '可用鍵盤 [1][2] 或 [←][→] 選答',
      onTimeout: () => this.handlePvpTimeout(player)
    });

    // 鍵盤數字快捷鍵 [1] / [2] 或 [ArrowLeft] / [ArrowRight]
    const answerKeyHandler = (e) => {
      if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'ArrowLeft') {
        e.preventDefault();
        this.submitPvpAnswer(player, 'bear');
      } else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.code === 'ArrowRight') {
        e.preventDefault();
        this.submitPvpAnswer(player, 'cat');
      }
    };

    window.removeEventListener('keydown', window.pvpActiveKeyHandler);
    window.pvpActiveKeyHandler = answerKeyHandler;
    window.addEventListener('keydown', window.pvpActiveKeyHandler);
  },

  handlePvpTimeout(player) {
    AudioSynth.play('wrong');
    if (!BattleManager.hasPassedOn) {
      const opponent = player === 'p1' ? 'p2' : 'p1';
      this.switchPvpTurn(opponent);
    } else {
      BattleManager.cleanup();
      this.showPvpResultOverlay(null, false, true);
    }
  },

  switchPvpTurn(newPlayer) {
    this.buzz(newPlayer, true);
  },
  
  submitPvpAnswer(player, choice) {
    const q = GameState.currentQuestionData;
    const correctAns = q.den1 < q.den2 ? 'bear' : 'cat';
    const isCorrect = (choice === correctAns);
    
    if (isCorrect) {
      BattleManager.cleanup();
      AudioSynth.play('correct');
      AppManager.spawnConfetti();
      if (player === 'p1') GameState.p1Score++;
      else GameState.p2Score++;
      this.showPvpResultOverlay(player, true, false, correctAns);
    } else {
      AudioSynth.play('wrong');
      if (player === 'p1') GameState.p1Score = Math.max(0, GameState.p1Score - 1);
      else GameState.p2Score = Math.max(0, GameState.p2Score - 1);

      const s1 = document.getElementById('pvp3-score-p1');
      const s2 = document.getElementById('pvp3-score-p2');
      if (s1) s1.innerText = `${GameState.p1Score} / ${GameState.pvpMaxScore} 分`;
      if (s2) s2.innerText = `${GameState.p2Score} / ${GameState.pvpMaxScore} 分`;

      if (!BattleManager.hasPassedOn) {
        const opponent = player === 'p1' ? 'p2' : 'p1';
        this.switchPvpTurn(opponent);
      } else {
        BattleManager.cleanup();
        this.showPvpResultOverlay(player, false, false, correctAns);
      }
    }
  },

  showPvpResultOverlay(player, isCorrect, isTimeout = false, correctAns = null) {
    BattleManager.cleanup();
    const q = GameState.currentQuestionData;
    const resolvedCorrectAns = correctAns || (q.den1 < q.den2 ? 'bear' : 'cat');
    const mainCard = document.querySelector('.game-card-main');
    if (!mainCard) return;

    const overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    
    const playerName = player === 'p1' ? '🐱 藍貓隊' : (player === 'p2' ? '🐰 紅兔隊' : '雙方');
    const correctCharStr = resolvedCorrectAns === 'bear' ? '小熊樂樂' : '小貓咪咪';
    const bigDen = resolvedCorrectAns === 'bear' ? q.den1 : q.den2;
    const smallDen = resolvedCorrectAns === 'bear' ? q.den2 : q.den1;
    const shapeUnitStr = q.shape === 'circle' ? '個' : '條';

    let titleStr = '';
    let reasonStr = '';

    if (isCorrect) {
      titleStr = `${playerName} ${autoAnnotate('答對了！加 1 分')}`;
      reasonStr = `${autoAnnotate('因為')} ${getFractionHTML(1, bigDen)} <span class="unit-ge">${shapeUnitStr}</span> ${autoAnnotate('大於')} ${getFractionHTML(1, smallDen)} <span class="unit-ge">${shapeUnitStr}</span>，${autoAnnotate(`所以是 ${correctCharStr} 吃得比較多喔！`)}`;
    } else if (isTimeout) {
      titleStr = autoAnnotate('雙方作答皆超時！');
      reasonStr = `${autoAnnotate(`正確答案是 ${correctCharStr}。因為`)} ${getFractionHTML(1, bigDen)} <span class="unit-ge">${shapeUnitStr}</span> ${autoAnnotate('大於')} ${getFractionHTML(1, smallDen)} <span class="unit-ge">${shapeUnitStr}</span>。`;
    } else {
      titleStr = autoAnnotate('雙方皆未答對～');
      reasonStr = `${autoAnnotate(`正確答案是 ${correctCharStr}。因為平分越少份（分母越小），每一份越大：`)} ${getFractionHTML(1, bigDen)} > ${getFractionHTML(1, smallDen)}。`;
    }
    
    overlay.innerHTML = `
      <div class="feedback-emoji">${isCorrect ? '🎉' : '😢'}</div>
      <div class="feedback-title ${isCorrect ? 'correct' : 'wrong'}">
        ${titleStr}
      </div>
      <div class="feedback-reason">
        ${reasonStr}
      </div>
      <button class="standard-btn primary-btn" id="btn-next-pvp-q3">下一題 ➡️</button>
    `;
    mainCard.appendChild(overlay);
    
    document.getElementById('btn-next-pvp-q3').addEventListener('click', () => {
      this.nextQuestion();
    });
  },
  
  showFinalScore() {
    BattleManager.cleanup();
    window.removeEventListener('keydown', window.pvp3KeyHandler);
    const container = document.getElementById('game-3-container');
    let html = '';
    
    if (GameState.gameMode === 'single') {
      AudioSynth.play('victory');
      html = `
        <div class="single-game-layout">
          <div class="game-complete-card">
            <div class="complete-badge">🏆</div>
            <h2>${autoAnnotate('挑戰完成！')}</h2>
            <div class="stars-container">
              ${'⭐'.repeat(GameState.singleScore)}${'☆'.repeat(GameState.maxQuestions - GameState.singleScore)}
            </div>
            <p>${autoAnnotate(`你順利通過了比大小考驗，得到 ${GameState.singleScore} 顆星星！`)}</p>
            <div style="display: flex; gap: 16px; margin-top: 16px;">
              <button class="standard-btn primary-btn" onclick="Game3Manager.start()">再玩一次 🔄</button>
              <button class="standard-btn secondary-btn" onclick="AppManager.showScreen('screen-menu')">返回選單 🔙</button>
            </div>
          </div>
        </div>
      `;
    } else {
      AudioSynth.play('victory');
      let winnerBadge = '';
      let winnerTitle = '';
      let celebrationMsg = '';
      
      if (GameState.p1Score > GameState.p2Score) {
        winnerBadge = '<div class="complete-badge" style="font-size: 6rem;">🐱</div>';
        winnerTitle = `<h2 class="p1-name">${autoAnnotate('🐱 藍貓隊獲勝！')}</h2>`;
        celebrationMsg = autoAnnotate('恭喜藍貓隊成為分數比大小大師！');
      } else if (GameState.p2Score > GameState.p1Score) {
        winnerBadge = '<div class="complete-badge" style="font-size: 6rem;">🐰</div>';
        winnerTitle = `<h2 class="p2-name">${autoAnnotate('🐰 紅兔隊獲勝！')}</h2>`;
        celebrationMsg = autoAnnotate('恭喜紅兔隊成為分數比大小大師！');
      } else {
        winnerBadge = '<div class="tie-badge-container"><span>🐱</span><span>🤝</span><span>🐰</span></div>';
        winnerTitle = `<h2 class="tie-title">${autoAnnotate('🤝 烘焙雙星！平分秋色！')}</h2>`;
        celebrationMsg = autoAnnotate('太厲害了！兩位小廚神比大小不相上下，都是最棒的分數大師！');
      }
      
      html = `
        <div class="single-game-layout">
          <div class="game-complete-card">
            ${winnerBadge}
            ${winnerTitle}
            <div style="background: #F5F5F5; width: 100%; padding: 16px; border-radius: var(--radius-sm); margin: 12px 0;">
              <p style="font-size: 1.15rem; font-weight: 600;">藍貓隊：${GameState.p1Score} 分</p>
              <p style="font-size: 1.15rem; font-weight: 600;">紅兔隊：${GameState.p2Score} 分</p>
            </div>
            <p>${celebrationMsg}</p>
            <div style="display: flex; gap: 16px; margin-top: 16px;">
              <button class="standard-btn primary-btn" onclick="Game3Manager.start()">再對戰一次 🔄</button>
              <button class="standard-btn secondary-btn" onclick="AppManager.showScreen('screen-menu')">返回選單 🔙</button>
            </div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
};


// 10. 初始化專案啟動
window.addEventListener('DOMContentLoaded', () => {
  AppManager.init();
});
