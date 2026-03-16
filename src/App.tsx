/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ExternalLink, Timer as TimerIcon, Settings, X, Plus, Trash2, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeInput, setTimeInput] = useState('05:00');
  const [showSettings, setShowSettings] = useState(true);
  const [timerColor, setTimerColor] = useState(() => {
    return localStorage.getItem('timer_color') || '#00FF00';
  });
  const [presets, setPresets] = useState<string[]>(() => {
    const saved = localStorage.getItem('timer_presets');
    return saved ? JSON.parse(saved) : ['01:00', '02:00', '05:00', '10:00'];
  });

  const colors = [
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#00A3FF' },
    { name: 'Red', value: '#FF4B4B' },
    { name: 'Yellow', value: '#FFD600' },
    { name: 'Purple', value: '#BF00FF' },
    { name: 'White', value: '#FFFFFF' },
  ];
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  // Persist presets and color
  useEffect(() => {
    localStorage.setItem('timer_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('timer_color', timerColor);
  }, [timerColor]);

  // Parse MM:SS to seconds
  const parseInput = (input: string) => {
    const parts = input.split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0]) || 0;
      const s = parseInt(parts[1]) || 0;
      return m * 60 + s;
    }
    return parseInt(input) * 60 || 0;
  };

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Canvas Drawing for PiP (Circular Design)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const size = Math.min(canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = size * 0.4;

      // Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Circular Track
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 12;
      ctx.stroke();

      // Progress Ring
      if (totalSeconds > 0) {
        const progress = timeLeft / totalSeconds;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
        ctx.strokeStyle = isRunning ? timerColor : '#ffffff';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Time Text
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      ctx.font = 'bold 40px "JetBrains Mono", monospace';
      ctx.fillStyle = isRunning ? timerColor : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeStr, centerX, centerY);

      requestRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [timeLeft, isRunning, totalSeconds]);

  const lastClickTime = useRef<number>(0);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);

  // Media Session API for PiP controls
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => setIsRunning(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsRunning(false));
      navigator.mediaSession.setActionHandler('stop', resetTimer);
    }
  }, []);

  // Update Media Session state
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';
    }
  }, [isRunning]);

  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_CLICK_DELAY = 300;

    if (now - lastClickTime.current < DOUBLE_CLICK_DELAY) {
      // Double Click detected
      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current);
        clickTimeout.current = null;
      }
      resetTimer();
      lastClickTime.current = 0;
    } else {
      // Potential Single Click
      lastClickTime.current = now;
      clickTimeout.current = setTimeout(() => {
        toggleTimer();
        clickTimeout.current = null;
      }, DOUBLE_CLICK_DELAY);
    }
  };

  const startTimer = () => {
    if (timeLeft === 0) {
      const seconds = parseInput(timeInput);
      if (seconds <= 0) return;
      setTimeLeft(seconds);
      setTotalSeconds(seconds);
    }
    setIsRunning(true);
    setShowSettings(false);
  };

  const toggleTimer = () => {
    if (timeLeft === 0) {
      startTimer();
    } else {
      setIsRunning(prev => !prev);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    const seconds = parseInput(timeInput);
    setTimeLeft(seconds);
    setTotalSeconds(seconds);
  };

  const savePreset = () => {
    if (!presets.includes(timeInput)) {
      setPresets([...presets, timeInput]);
    }
  };

  const deletePreset = (preset: string) => {
    setPresets(presets.filter(p => p !== preset));
  };

  const loadPreset = (preset: string) => {
    setTimeInput(preset);
  };

  const toggleFloating = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        const stream = canvasRef.current.captureStream(30);
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP Error:', error);
      alert('Il tuo browser non supporta il PiP o è necessaria un\'interazione utente.');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 font-mono text-white overflow-hidden">
      {/* Hidden elements for PiP */}
      <canvas ref={canvasRef} width={300} height={300} className="hidden" />
      <video ref={videoRef} className="hidden" muted playsInline />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm aspect-square flex flex-col items-center justify-center"
      >
        {/* Circular Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform">
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            className="stroke-white/5 fill-none"
            strokeWidth="8"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r="45%"
            style={{ stroke: isRunning ? timerColor : 'rgba(255,255,255,0.4)' }}
            className="fill-none"
            strokeWidth="8"
            strokeDasharray="283%"
            animate={{ strokeDashoffset: `${283 - (283 * progress) / 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
            strokeLinecap="round"
          />
        </svg>

        {/* Inner Content */}
        <div 
          onClick={handleTimerClick}
          className="z-10 flex flex-col items-center justify-center cursor-pointer group w-full h-full rounded-full"
        >
          <AnimatePresence mode="wait">
            {showSettings ? (
              <motion.div 
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center w-full px-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    style={{ color: timerColor }}
                    className="bg-transparent text-5xl font-bold text-center w-40 focus:outline-none border-b-2 border-white/10 transition-colors"
                    placeholder="00:00"
                  />
                  <button 
                    onClick={savePreset}
                    className="p-2 text-white/40 hover:text-green-500 transition-colors"
                    title="Salva Preset"
                  >
                    <Bookmark size={20} fill={presets.includes(timeInput) ? "currentColor" : "none"} />
                  </button>
                </div>
                <p className="text-[10px] text-white/40 mt-2 tracking-widest uppercase">MM:SS</p>
                
                {/* Color Picker */}
                <div className="mt-4 flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setTimerColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${timerColor === c.value ? 'scale-125 border-white' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>

                {/* Presets Grid */}
                <div className="mt-4 w-full max-h-24 overflow-y-auto scrollbar-hide">
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((p) => (
                      <div key={p} className="flex items-center bg-white/5 rounded-lg overflow-hidden group/preset">
                        <button 
                          onClick={() => loadPreset(p)}
                          className={`flex-1 py-2 text-[10px] font-bold transition-colors ${timeInput === p ? 'text-white' : 'text-white/60 hover:text-white'}`}
                          style={{ backgroundColor: timeInput === p ? timerColor : 'transparent', color: timeInput === p ? '#000' : '' }}
                        >
                          {p}
                        </button>
                        <button 
                          onClick={() => deletePreset(p)}
                          className="p-2 text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover/preset:opacity-100"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={startTimer}
                  className="mt-4 p-4 rounded-full bg-white text-black hover:bg-opacity-90 transition-colors shadow-lg shadow-white/10"
                >
                  <Play size={24} fill="currentColor" />
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="timer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="text-7xl font-bold tracking-tighter" style={{ color: timerColor }}>
                  {formatTime(timeLeft)}
                </div>
                <div className="mt-4 flex items-center gap-2 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                  <span className="text-[10px] uppercase tracking-widest">Tocca per {isRunning ? 'Pausa' : 'Avvia'}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Controls */}
      <div className="mt-12 flex gap-6">
        <button 
          onClick={resetTimer}
          className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          title="Reset"
        >
          <RotateCcw size={24} />
        </button>
        <button 
          onClick={toggleFloating}
          style={{ backgroundColor: timerColor }}
          className="px-8 py-4 rounded-2xl text-black font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
        >
          <ExternalLink size={20} />
          FLOATING MODE
        </button>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          title="Settings"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Android 15 Note */}
      <div className="fixed bottom-8 text-center px-6">
        <p className="text-white/20 text-[9px] uppercase tracking-[4px] leading-relaxed">
          Ottimizzato per Android 15+ <br/>
          Supporta Picture-in-Picture & PWA
        </p>
      </div>
    </div>
  );
}
