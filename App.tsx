/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { P5Canvas, P5CanvasRef } from './components/P5Canvas';
import { Terminal, parsePartialJson } from './components/Terminal';
import { generateNextSpinner } from './services/geminiService';
import { generateExportPack } from './utils/exportService'; 
import { SpinnerData, CandidateState, GlobalStats } from './types';

// Initial seed code: Material Design 3 Circular Progress Indicator
const PROGENITOR_CODE = `
  p.setup = () => {
    p.createCanvas(400, 400);
    p.colorMode(p.HSB, 360, 100, 100);
    p.noFill();
    p.strokeCap(p.ROUND);
    p.strokeWeight(20);
  };

  p.draw = () => {
    p.clear(); // Transparent background
    p.translate(p.width / 2, p.height / 2);

    const t = p.millis(); // Continuous time
    
    // 1. Continuous Rotation
    // Rotate steadily over time
    p.rotate(t * 0.0005);

    // 2. Breathing Arc
    // Sine wave creates a natural infinite loop without jumps
    const sineVal = p.sin(t * 0.002);
    
    const minLen = p.radians(20);
    const maxLen = p.radians(280);
    const arcLen = p.map(sineVal, -1, 1, minLen, maxLen);
    
    // 3. Dynamic Offset
    const easeOffset = p.map(sineVal, -1, 1, 0, p.PI * 0.5);
    p.rotate(easeOffset);

    // 4. Color Cycle
    const hue = (t * 0.05) % 360;
    p.stroke(hue, 80, 100);
    
    p.arc(0, 0, 300, 300, 0, arcLen);
  };
`;

const PROGENITOR_DATA: SpinnerData = {
  id: 1,
  mutationName: "Material Kinetic",
  reasoning: "The Progenitor. A perfect loop based on Material Design 3's indeterminate progress indicator. Features variable arc length, elastic rotation, and full-spectrum HSB cycling.",
  p5Code: PROGENITOR_CODE,
  timestamp: Date.now(),
  generationTimeMs: 0,
  tokensPerSecond: 0,
  totalTokens: 0,
  tpsHistory: [],
};

// --- Overlay Component for Streaming Text ---
const StreamingOverlay = ({ buffer, isVisible, accentColor, theme = 'dark' }: { buffer: string, isVisible: boolean, accentColor: string, theme?: 'dark' | 'light' }) => {
    const data = useMemo(() => parsePartialJson(buffer), [buffer]);
    
    // We only render if visible OR if there is content (to allow fade out)
    if (!isVisible && !buffer) return null;

    return (
        <div 
            className={`absolute inset-0 z-50 p-4 md:p-8 flex flex-col pointer-events-none transition-all duration-500 ease-out backdrop-blur-sm
            ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
            ${theme === 'dark' ? 'bg-black/90' : 'bg-white/90'}`}
        >
            {/* Inner container handles instant content hide when generation stops, preventing visual clash */}
            <div className={`flex flex-col h-full transition-opacity ${isVisible ? 'opacity-100 duration-500' : 'opacity-0 duration-0'}`}>
                <div className="flex-none mb-4 space-y-2">
                     <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${accentColor}`} />
                        <span className={`text-[10px] font-mono uppercase tracking-widest ${accentColor}`}>
                            Generating Mutation...
                        </span>
                     </div>
                     {data.mutationName && (
                          <h2 className={`text-xl md:text-2xl font-bold tracking-tight leading-none animate-in fade-in slide-in-from-left-2 duration-300
                            ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                             {data.mutationName}
                         </h2>
                     )}
                     {data.reasoning && (
                          <p className={`text-xs md:text-sm italic font-serif leading-relaxed animate-in fade-in slide-in-from-left-2 delay-100 duration-500 border-l-2 pl-3
                            ${theme === 'dark' ? 'text-neutral-400 border-neutral-800' : 'text-neutral-500 border-neutral-200'}`}>
                             {data.reasoning}
                         </p>
                     )}
                </div>
                
                <div className={`flex-1 min-h-0 relative mt-2 rounded border overflow-hidden
                    ${theme === 'dark' ? 'bg-neutral-950/50 border-neutral-900' : 'bg-neutral-50/50 border-neutral-200'}`}>
                    <pre className={`absolute inset-0 p-4 text-[10px] font-mono leading-relaxed overflow-hidden whitespace-pre-wrap break-all opacity-70
                        ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        {/* We only show the last 1000 chars to create a 'terminal stream' effect without scrolling */}
                        {data.p5Code || buffer.slice(-500) || "Initializing..."}
                        <span className={`inline-block w-2 h-4 align-middle ml-1 animate-pulse ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [history, setHistory] = useState<SpinnerData[]>([PROGENITOR_DATA]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [candidates, setCandidates] = useState<{ a: CandidateState; b: CandidateState } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [stats, setStats] = useState<GlobalStats>({ attempts: 0, failures: 0 });
  
  const [exportState, setExportState] = useState<{ variant: 'a' | 'b', progress: number } | null>(null);

  const [generationStartTime, setGenerationStartTime] = useState<number>(0);
  
  // Theme & Layout State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [viewLayout, setViewLayout] = useState<'desktop' | 'phone'>('desktop');
  
  // Mobile UI State
  const [mobileTab, setMobileTab] = useState<'a' | 'b'>('a');
  const touchStartRef = useRef<number>(0);
  
  const candidatesRef = useRef<{ a: CandidateState; b: CandidateState } | null>(null);
  const canvasARef = useRef<P5CanvasRef>(null);
  const canvasBRef = useRef<P5CanvasRef>(null);

  // LOGIC CHANGE: 
  // We allow currentIndex to go one step beyond history length (index == history.length) 
  // IF there are active candidates. This "phantom" slot represents the "Creation Zone".
  // This decoupling allows us to view the "Head" (index == history.length - 1) as a static history item.
  const isSelectionMode = candidates !== null && currentIndex === history.length;
  const currentHistorySpinner = history[currentIndex];

  // Safety clamp: If candidates disappear (e.g. error) and we are in phantom slot, retreat.
  useEffect(() => {
      if (!candidates && currentIndex >= history.length) {
          setCurrentIndex(Math.max(0, history.length - 1));
      }
  }, [candidates, history.length, currentIndex]);

  // Reset mobile tab when new candidates are generated
  useEffect(() => {
      if (candidates) {
          setMobileTab('a');
      }
  }, [candidates]);

  const handleEvolve = async (seedOverride?: SpinnerData) => {
    if (isGenerating) return;

    setIsGenerating(true);
    setGenerationStartTime(performance.now());
    setStats(prev => ({ ...prev, attempts: prev.attempts + 1 }));
    
    const initialCandidateState = { buffer: "", data: null, tpsHistory: [] };
    const newCandidates = {
        a: { ...initialCandidateState },
        b: { ...initialCandidateState }
    };
    setCandidates(newCandidates);
    candidatesRef.current = newCandidates;

    const seedSpinner = seedOverride || history[history.length - 1];
    const seedCode = seedSpinner ? seedSpinner.p5Code : null;
    const nextId = (Math.max(...history.map(h => h.id), seedSpinner?.id || 0)) + 1;

    try {
      const promiseA = generateNextSpinner(seedCode, nextId, (text) => updateCandidateStream('a', text));
      const promiseB = generateNextSpinner(seedCode, nextId, (text) => updateCandidateStream('b', text));

      const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

      setCandidates(prev => {
          if (!prev) return null;
          return {
              a: { ...prev.a, data: { ...resultA, tpsHistory: [...prev.a.tpsHistory] } },
              b: { ...prev.b, data: { ...resultB, tpsHistory: [...prev.b.tpsHistory] } }
          };
      });

    } catch (error) {
      console.error("Evolution failed", error);
      setStats(prev => ({ ...prev, failures: prev.failures + 1 }));
      setCandidates(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateCandidateStream = (variant: 'a' | 'b', text: string) => {
    setCandidates(prev => {
        if (!prev) return null;
        const updated = {
            ...prev,
            [variant]: { ...prev[variant], buffer: text }
        };
        candidatesRef.current = updated;
        return updated;
    });
  };

  const handleStart = () => {
      setHasStarted(true);
      handleEvolve();
      setCurrentIndex(1); // Jump to the new phantom slot
  };

  const handleSelect = (variant: 'a' | 'b') => {
      if (!candidates || !candidates[variant].data) return;
      if (exportState) return;
      
      const winner = candidates[variant].data!;
      setHistory(prev => [...prev, winner]);
      setCurrentIndex(prev => prev + 1); // Move to the NEXT phantom slot
      handleEvolve(winner);
  };

  const handleKeyDown = (e: React.KeyboardEvent, variant: 'a' | 'b') => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!isGenerating && candidates?.[variant].data && !exportState) {
              handleSelect(variant);
          }
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!isSelectionMode) return;
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStartRef.current - touchEnd;
      const threshold = 50; // min px to be considered a swipe

      if (Math.abs(diff) > threshold) {
          if (diff > 0) {
              // Swipe Left -> Go Next (A -> B)
              setMobileTab('b');
          } else {
              // Swipe Right -> Go Prev (B -> A)
              setMobileTab('a');
          }
      }
  };

  // Telemetry Recorder
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            const now = performance.now();
            const elapsedSeconds = (now - generationStartTime) / 1000;
            
            if (elapsedSeconds > 0 && candidatesRef.current) {
                const lenA = candidatesRef.current.a.buffer.length / 4; 
                const tpsA = lenA / elapsedSeconds;
                
                const lenB = candidatesRef.current.b.buffer.length / 4;
                const tpsB = lenB / elapsedSeconds;

                candidatesRef.current.a.tpsHistory.push(tpsA);
                candidatesRef.current.b.tpsHistory.push(tpsB);

                setCandidates(prev => {
                    if (!prev) return null;
                    return {
                        a: { ...prev.a, tpsHistory: [...prev.a.tpsHistory, tpsA] },
                        b: { ...prev.b, tpsHistory: [...prev.b.tpsHistory, tpsB] }
                    };
                });
            }
        }, 100);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationStartTime]);

  const actions = {
      onPrev: () => setCurrentIndex(c => Math.max(0, c - 1)),
      onNext: () => setCurrentIndex(c => Math.min(candidates ? history.length : history.length - 1, c + 1)),
      onMutate: () => {
          handleEvolve();
          setCurrentIndex(history.length); // Jump to phantom slot
      }, 
  };

  const handleExport = async (platform: 'windows' | 'linux' | 'chrome') => {
      if (!currentHistorySpinner) return;
      
      setExportState({ variant: 'a', progress: 0 }); // variant is a dummy here
      
      try {
          await generateExportPack({
              code: currentHistorySpinner.p5Code,
              platform,
              filename: `qamani_evolve_${currentHistorySpinner.id}`,
              onProgress: (p) => setExportState(prev => prev ? { ...prev, progress: p } : null)
          });
      } catch (err) {
          console.error("Export failed", err);
          alert("Export failed. Check console for details.");
      } finally {
          setExportState(null);
      }
  };

  const isInteractive = !isGenerating && !exportState;
  const maxIndex = candidates ? history.length : history.length - 1;

  // Modern Toggle Button Component
  const ModernToggle = ({ active, label, icon, onClick, activeColor }: { 
    active: boolean, 
    label: string, 
    icon: string, 
    onClick: () => void,
    activeColor: string 
  }) => (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: active ? activeColor : undefined }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`h-8 px-3 rounded-full flex items-center gap-2 border transition-all duration-300 text-[9px] uppercase font-bold tracking-[0.1em]
      ${active 
        ? `${activeColor} border-transparent text-white shadow-[0_0_15px_-3px_rgba(0,0,0,0.3)]` 
        : `bg-neutral-800/20 border-neutral-800 text-neutral-500 hover:text-neutral-300`}`}
    >
      <span className="text-[10px]">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
      {active && <motion.div layoutId={`${label}-dot`} className="w-1 h-1 bg-white rounded-full" />}
    </motion.button>
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Don't trigger if user is typing (not that we have inputs, but good practice)
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        // E for Evolve
        if (e.key.toLowerCase() === 'e' && !isGenerating && !exportState && !isSelectionMode) {
            actions.onMutate();
        }

        // 1 or 2 for selection
        if (isSelectionMode && !isGenerating && !exportState) {
            if (e.key === '1') handleSelect('a');
            if (e.key === '2') handleSelect('b');
        }

        // Arrows for navigation
        if (e.key === 'ArrowLeft') {
            if (currentIndex > 0) actions.onPrev();
        }
        if (e.key === 'ArrowRight') {
            if (currentIndex < maxIndex) actions.onNext();
        }

        // Escape to cancel evolution or go back
        if (e.key === 'Escape') {
            if (isSelectionMode && !isGenerating) {
                setCandidates(null);
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isGenerating, exportState, isSelectionMode, currentIndex, maxIndex, actions, candidates]);

  const hasApiKey = !!process.env.GEMINI_API_KEY;

  if (!hasApiKey) {
      return (
          <div className="min-h-screen bg-black text-neutral-400 flex items-center justify-center p-8 font-mono">
              <div className="max-w-md text-center space-y-4">
                  <h1 className="text-xl font-bold text-white">SYSTEM_HALT</h1>
                  <p>API_KEY missing. Process terminated.</p>
              </div>
          </div>
      )
  }

  return (
    <div className={`h-screen font-sans flex flex-col overflow-hidden relative transition-colors duration-700
      ${theme === 'dark' ? 'bg-[#020202] text-neutral-400' : 'bg-neutral-50 text-neutral-600'}`}>
      <style>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-text {
            background-size: 200% 200%;
            animation: gradientFlow 5s ease infinite;
        }
        .phone-shadow {
            box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5);
        }
      `}</style>

      {/* GLOBAL HEADER */}
      <div className={`flex-none h-14 flex items-center justify-between px-3 md:px-4 z-20 border-b transition-colors duration-500
        ${theme === 'dark' ? 'bg-black border-neutral-900' : 'bg-white border-neutral-200'}`}>
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 mr-2">
                 <span className="font-bold tracking-tight text-xs sm:text-sm hidden sm:inline-block">
                     <span className={theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}>QAMANI</span>
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400 animate-gradient-text">EVOLVE</span>
                 </span>
                 <div className={`h-4 w-px hidden sm:block ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
                  <div className="text-[9px] md:text-[10px] font-mono truncate py-1">
                    {!hasStarted ? "" : (isSelectionMode ? (
                        <div className="flex items-center gap-2">
                             <span className="text-blue-400 font-black tracking-[0.3em] drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]">QAMANI</span>
                             <div className={`w-1 h-1 rounded-full ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
                             <span className={`text-transparent bg-clip-text bg-gradient-to-r font-bold tracking-[0.15em]
                                ${theme === 'dark' ? 'from-neutral-400 to-neutral-600' : 'from-neutral-600 to-neutral-400'}`}>LIVE CODING</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                             <span className={`${theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'} font-medium tracking-widest`}>TIMELINE //</span>
                             <span className={`px-2 py-0.5 rounded-sm border font-bold tabular-nums tracking-tighter
                                ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-neutral-100 border-neutral-200 text-neutral-600'}`}>
                                {currentIndex + 1} <span className="text-neutral-500 mx-1">OF</span> {history.length}
                             </span>
                        </div>
                    ))}
                  </div>
            </div>

            {/* THEME & VIEW MODES (NEW) */}
            <div className="flex items-center gap-2 mr-2 md:mr-6">
                <ModernToggle 
                    active={theme === 'light'} 
                    label="Light" 
                    icon="☼" 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    activeColor="bg-blue-600"
                />
                <ModernToggle 
                    active={viewLayout === 'phone'} 
                    label="Phone" 
                    icon="📱" 
                    onClick={() => setViewLayout(viewLayout === 'desktop' ? 'phone' : 'desktop')}
                    activeColor="bg-purple-600"
                />
            </div>

            {hasStarted && (
                <div className="flex gap-2 flex-none">
                    <button 
                        onClick={actions.onPrev}
                        disabled={currentIndex === 0}
                        className="h-8 w-8 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white focus:outline-none focus:ring-2 focus:ring-neutral-700"
                    >
                        &lt;
                    </button>
                    
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isSelectionMode ? undefined : actions.onMutate}
                        disabled={isSelectionMode || isGenerating || !!exportState}
                        className={`
                            h-8 px-3 md:px-4 font-bold text-[9px] md:text-[10px] uppercase rounded border transition-all duration-300 tracking-wider flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black
                            ${isSelectionMode 
                                ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-default opacity-50' 
                                : 'bg-white hover:bg-neutral-200 border-white text-black shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                            }
                        `}
                    >
                        {isGenerating 
                            ? "PROCESSING..." 
                            : (isSelectionMode ? <span className="hidden md:inline">SELECT ON CANVAS</span> : "EVOLVE")
                        }
                        {isSelectionMode && <span className="md:hidden">SELECT</span>}
                    </motion.button>

                    <button 
                        onClick={actions.onNext}
                        disabled={currentIndex === maxIndex}
                        className="h-8 w-8 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white focus:outline-none focus:ring-2 focus:ring-neutral-700"
                    >
                        &gt;
                    </button>
                </div>
            )}

            {/* KEYBOARD SHORTCUTS HINT */}
            {hasStarted && !isGenerating && !exportState && (
                <div className="absolute top-16 left-4 z-30 pointer-events-none hidden md:block">
                    <div className="flex flex-col gap-1 opacity-20 hover:opacity-100 transition-opacity duration-500">
                        <div className="flex items-center gap-2 group">
                            <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[8px] font-mono text-neutral-400 group-hover:text-blue-400 transition-colors">E</kbd>
                            <span className="text-[8px] uppercase tracking-widest text-neutral-600 font-mono">Evolve</span>
                        </div>
                        <div className="flex items-center gap-2 group">
                            <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[8px] font-mono text-neutral-400 group-hover:text-purple-400 transition-colors">ARROWS</kbd>
                            <span className="text-[8px] uppercase tracking-widest text-neutral-600 font-mono">Navigate</span>
                        </div>
                        {isSelectionMode && (
                             <div className="flex items-center gap-2 group animate-pulse">
                                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[8px] font-mono text-neutral-400 group-hover:text-white transition-colors">1/2</kbd>
                                <span className="text-[8px] uppercase tracking-widest text-neutral-600 font-mono">Select</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
      </div>

      {/* VISUALS */}
      <div className={`flex-1 relative flex overflow-hidden ${viewLayout === 'phone' ? 'items-center justify-center py-12' : ''}`}>
           {/* Windows Phone Overlay Backdrop */}
           <AnimatePresence>
                {viewLayout === 'phone' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[5] bg-black/40 backdrop-blur-xl pointer-events-none"
                    />
                )}
           </AnimatePresence>

           <div className={`relative transition-all duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)]
                ${viewLayout === 'phone' 
                    ? 'w-[320px] h-[640px] bg-black rounded-[46px] border-[10px] border-neutral-900 phone-shadow overflow-hidden z-10 flex flex-col' 
                    : 'w-full h-full'}`}>
                
                {/* Phone Top Bar */}
                {viewLayout === 'phone' && (
                    <div className="flex-none h-8 px-8 flex items-center justify-between pointer-events-none">
                        <span className="text-[10px] font-bold text-neutral-600">LTE</span>
                        <span className="text-[10px] font-bold text-neutral-600 font-mono">15:48</span>
                        <div className="w-4 h-2 rounded-[2px] border border-neutral-700 relative">
                             <div className="absolute inset-px bg-green-900 w-2/3" />
                        </div>
                    </div>
                )}

                {/* Main Render Stage */}
                <div 
                    className={`flex-1 min-h-0 flex flex-col lg:flex-row relative transition-colors duration-500
                        ${theme === 'dark' ? 'bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)_inset]' : 'bg-white shadow-[0_0_50px_rgba(0,0,0,0.05)_inset]'}
                        ${viewLayout === 'phone' ? 'border-none' : 'border-b border-neutral-900'}`}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {!isSelectionMode ? (
            // SINGLE VIEW
            <div className="w-full h-full relative flex items-center justify-center">
                <P5Canvas code={currentHistorySpinner?.p5Code || ""} />
                
                {hasStarted && !isGenerating && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2 scale-90 sm:scale-100 origin-top-right">
                        <div className="bg-black/40 backdrop-blur-md border border-neutral-800 p-2 rounded-lg flex flex-col gap-1 shadow-2xl">
                            <span className="text-[7px] text-neutral-500 uppercase tracking-[0.3em] pl-1 mb-1">Export Pack</span>
                            <button 
                                onClick={() => handleExport('chrome')}
                                className="px-3 py-1.5 flex items-center gap-2 text-[9px] text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded font-mono uppercase tracking-wider group"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all" />
                                Chrome Cursor
                            </button>
                            <button 
                                onClick={() => handleExport('windows')}
                                className="px-3 py-1.5 flex items-center gap-2 text-[9px] text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded font-mono uppercase tracking-wider group"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 group-hover:shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all" />
                                Windows Cursor
                            </button>
                            <button 
                                onClick={() => handleExport('linux')}
                                className="px-3 py-1.5 flex items-center gap-2 text-[9px] text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded font-mono uppercase tracking-wider group"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 group-hover:shadow-[0_0_8px_rgba(249,115,22,0.5)] transition-all" />
                                Linux Spinner
                            </button>
                        </div>
                    </div>
                )}
                
                {hasStarted && currentIndex < maxIndex && (
                     <div className="absolute bottom-8 right-8 pointer-events-none">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest bg-neutral-900/80 px-2 py-1 rounded">
                            New Generation Ready &rarr;
                        </span>
                     </div>
                )}
            </div>
        ) : (
            // SPLIT VIEW
            <>
                {/* Mobile Navigation Controls */}
                <div className="lg:hidden absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex justify-between px-2 pointer-events-none">
                    <button 
                         onClick={(e) => { e.stopPropagation(); setMobileTab('a'); }}
                         className={`pointer-events-auto p-3 bg-neutral-900/80 text-white rounded-full border border-neutral-700 shadow-lg backdrop-blur-sm transition-all active:scale-95 ${mobileTab === 'a' ? 'opacity-0 cursor-default' : 'opacity-100'}`}
                         aria-label="Previous Variant"
                    >
                         <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    <button 
                         onClick={(e) => { e.stopPropagation(); setMobileTab('b'); }}
                         className={`pointer-events-auto p-3 bg-neutral-900/80 text-white rounded-full border border-neutral-700 shadow-lg backdrop-blur-sm transition-all active:scale-95 ${mobileTab === 'b' ? 'opacity-0 cursor-default' : 'opacity-100'}`}
                         aria-label="Next Variant"
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
                
                {/* Mobile Tab Indicators */}
                <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-2 pointer-events-none">
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${mobileTab === 'a' ? 'bg-white' : 'bg-neutral-800'}`} />
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${mobileTab === 'b' ? 'bg-white' : 'bg-neutral-800'}`} />
                </div>

                {/* Variant A */}
                {/* On mobile (< lg), only show if mobileTab is 'a'. On desktop (lg+), always show. */}
                <div 
                    onClick={() => isInteractive && candidates?.a.data && handleSelect('a')}
                    onKeyDown={(e) => handleKeyDown(e, 'a')}
                    tabIndex={isInteractive && candidates?.a.data ? 0 : -1}
                    role="button"
                    aria-label="Select Variant A"
                    className={`relative flex-1 border-b lg:border-b-0 lg:border-r border-neutral-900 flex-col items-center justify-center group cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/50 
                    ${mobileTab === 'b' ? 'hidden lg:flex' : 'flex'}`}
                >
                    <div className={`absolute inset-0 bg-neutral-950/80 opacity-0 ${exportState ? '' : 'group-hover:opacity-100 group-focus-visible:opacity-100'} transition-opacity duration-300 z-30 flex items-center justify-center backdrop-grayscale`}>
                        <span className="text-white font-mono text-sm tracking-[0.2em] uppercase border border-white/20 px-4 py-2 bg-black/50 backdrop-blur-md rounded">
                            Select Variant A
                        </span>
                    </div>

                    {/* Streaming Overlay A */}
                    {candidates && (
                        <StreamingOverlay 
                            buffer={candidates.a.buffer} 
                            isVisible={isGenerating} 
                            accentColor="bg-blue-500 text-blue-500" 
                            theme={theme}
                        />
                    )}

                    {candidates?.a.data ? (
                         <div className="w-full h-full flex items-center justify-center p-4 md:p-8 transition-all duration-500 group-hover:scale-105 group-focus-visible:scale-105 group-hover:opacity-40 group-focus-visible:opacity-40">
                             <P5Canvas ref={canvasARef} code={candidates.a.data.p5Code} />
                         </div>
                    ) : (
                         // Fallback loader
                         !isGenerating && (
                            <div className="flex flex-col items-center gap-4 opacity-50">
                                <span className="text-xs font-mono text-neutral-700">Waiting for stream...</span>
                            </div>
                         )
                    )}
                </div>

                {/* Variant B */}
                <div 
                    onClick={() => isInteractive && candidates?.b.data && handleSelect('b')}
                    onKeyDown={(e) => handleKeyDown(e, 'b')}
                    tabIndex={isInteractive && candidates?.b.data ? 0 : -1}
                    role="button"
                    aria-label="Select Variant B"
                    className={`relative flex-1 flex-col items-center justify-center group cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500/50
                    ${mobileTab === 'a' ? 'hidden lg:flex' : 'flex'}`}
                >
                    <div className={`absolute inset-0 bg-neutral-950/80 opacity-0 ${exportState ? '' : 'group-hover:opacity-100 group-focus-visible:opacity-100'} transition-opacity duration-300 z-30 flex items-center justify-center backdrop-grayscale`}>
                        <span className="text-white font-mono text-sm tracking-[0.2em] uppercase border border-white/20 px-4 py-2 bg-black/50 backdrop-blur-md rounded">
                            Select Variant B
                        </span>
                    </div>

                    {/* Streaming Overlay B */}
                    {candidates && (
                        <StreamingOverlay 
                            buffer={candidates.b.buffer} 
                            isVisible={isGenerating} 
                            accentColor="bg-purple-500 text-purple-500" 
                            theme={theme}
                        />
                    )}

                    {candidates?.b.data ? (
                         <div className="w-full h-full flex items-center justify-center p-4 md:p-8 transition-all duration-500 group-hover:scale-105 group-focus-visible:scale-105 group-hover:opacity-40 group-focus-visible:opacity-40">
                             <P5Canvas ref={canvasBRef} code={candidates.b.data.p5Code} />
                         </div>
                    ) : (
                         !isGenerating && (
                            <div className="flex flex-col items-center gap-4 opacity-50">
                                <span className="text-xs font-mono text-neutral-700">Waiting for stream...</span>
                            </div>
                         )
                    )}
                </div>
            </>
        )}
                </div>

                {/* Phone Bottom Navigation (Lumia Style) */}
                {viewLayout === 'phone' && (
                    <div className={`flex-none h-14 flex items-center justify-around z-50 border-t pointer-events-none pb-2 transition-colors duration-500
                        ${theme === 'dark' ? 'bg-black border-neutral-900/50' : 'bg-white border-neutral-200'}`}>
                        <span className={`text-xl transition-colors ${theme === 'dark' ? 'text-neutral-700' : 'text-neutral-300'}`}>←</span>
                        <div className={`w-7 h-7 border-2 rounded-full flex items-center justify-center transition-colors
                            ${theme === 'dark' ? 'border-neutral-700' : 'border-neutral-300'}`}>
                             <div className={`w-1.5 h-1.5 rounded-px transition-colors ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300'}`} />
                        </div>
                        <span className={`text-xl transition-colors ${theme === 'dark' ? 'text-neutral-700' : 'text-neutral-300'}`}>🔍</span>
                    </div>
                )}
           </div>
      </div>

        {/* EXPORT PROGRESS OVERLAY */}
        {exportState && (
            <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
                <div className="w-64 space-y-6">
                    <div className="space-y-1 text-center">
                        <div className="flex items-center justify-center gap-3">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                            <h2 className="text-white font-mono text-[10px] uppercase tracking-[0.4em]">Packaging Assets</h2>
                        </div>
                        <p className="text-neutral-500 text-[8px] uppercase tracking-widest">Compiling high-accuracy frames</p>
                    </div>
                    
                    <div className="relative h-[2px] w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                            style={{ width: `${exportState.progress}%` }}
                        />
                    </div>
                    
                    <div className="flex justify-between items-center font-mono">
                        <span className="text-[8px] text-neutral-600 uppercase tracking-widest">Progress</span>
                        <span className="text-[10px] text-white tabular-nums tracking-widest">{exportState.progress}%</span>
                    </div>
                </div>
                
                <div className="absolute bottom-12 text-center space-y-2 opacity-40">
                    <p className="text-[7px] text-neutral-500 uppercase tracking-[0.5em] animate-pulse">Establishing Kinetic Integrity</p>
                </div>
            </div>
        )}

        {/* CONSOLE / DATA VIEW */}
        <div className={`${!hasStarted ? 'h-[40vh]' : 'flex-none'} bg-[#080808] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 relative transition-[height] duration-500`}>
          <Terminal 
            currentData={currentHistorySpinner}
            candidates={candidates}
            isGenerating={isGenerating}
            generationStartTime={generationStartTime}
            history={history}
            currentIndex={currentIndex}
            isSelectionMode={isSelectionMode}
            mobileTab={mobileTab}
            allowInteraction={hasStarted}
            stats={stats}
            theme={theme}
        />

        {/* LANDING OVERLAY */}
        {!hasStarted && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-50 border-t border-neutral-800">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="animate-in fade-in zoom-in duration-700 slide-in-from-bottom-4 flex flex-col items-center"
                >
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tighter max-w-4xl leading-none">
                        QAMANI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-blue-400 animate-gradient-text">EVOLVE</span>
                    </h1>
                    
                    <motion.button 
                        whileHover={{ scale: 1.05, shadow: "0 0 30px rgba(255,255,255,0.3)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStart}
                        className="px-8 py-3 bg-white hover:bg-neutral-200 text-black font-bold text-xs tracking-[0.2em] rounded-sm transition-all duration-300 ring-offset-2 ring-offset-black focus:ring-2 focus:ring-white outline-none"
                    >
                        START EVOLVING
                    </motion.button>
                    
                    <div className="mt-8 text-[10px] text-neutral-600 font-mono uppercase tracking-widest hover:text-neutral-500 transition-colors">
                        Created by <span className="text-neutral-400 font-bold">QAMANI</span>
                    </div>
                </motion.div>
            </div>
        )}
      </div>
    </div>
  );
}