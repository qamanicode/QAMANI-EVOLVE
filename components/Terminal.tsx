/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SpinnerData, CandidateState, GlobalStats } from '../types';
import { StatsChart } from './StatsChart';

// --- Helper Functions ---

const highlightCode = (code: string) => {
    if (!code) return null;
    
    // Safety check for empty code
    if (code.trim().length === 0) return <div className="text-neutral-700 italic">// QAMANI code stream initializing...</div>;

    const lines = code.split('\n');
    return lines.map((line, i) => {
        // Simple highlighting regex
        let processedLine = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Highlight p.methods
        processedLine = processedLine.replace(/(p\.[a-zA-Z0-9]+)/g, '<span class="text-blue-400 font-bold">$1</span>');
        
        // Keywords
        processedLine = processedLine.replace(/\b(let|const|var|function|return|if|else|for|while|try|catch|new|import|export|from|p|p5)\b/g, '<span class="text-purple-400">$1</span>');
        
        // Strings
        processedLine = processedLine.replace(/(['"`].*?['"`])/g, '<span class="text-green-400">$1</span>');
        
        // Numbers
        processedLine = processedLine.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="text-orange-300">$1</span>');

        // Comments
        processedLine = processedLine.replace(/(\/\/.*)/g, '<span class="text-neutral-600 italic font-sans">$1</span>');

        return (
            <div key={i} className="flex gap-4 group/line border-l-2 border-transparent hover:border-blue-500/30 hover:bg-white/5 transition-all">
                <span className="w-8 flex-none text-neutral-800 text-right select-none group-hover/line:text-neutral-500 transition-colors bg-black font-mono text-[9px] py-px pr-2">{i + 1}</span>
                <span dangerouslySetInnerHTML={{ __html: processedLine }} className="flex-1 whitespace-pre-wrap break-all py-px" />
            </div>
        );
    });
};

export const parsePartialJson = (jsonStr: string) => {
    const result = { mutationName: "", reasoning: "", p5Code: "" };
    
    // Helper to extract value safely
    const extract = (key: string) => {
        // 1. Strict Match: Try to find key and value with a closing quote (completed field)
        // We use [^"]* to ensure we stop at the first closing quote
        const strictRegex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
        const strictMatch = jsonStr.match(strictRegex);
        if (strictMatch) return strictMatch[1];

        // 2. Loose Match: If not found, try to find key and take everything until end of string (streaming field)
        // This only matches if the string ENDS inside the value (no closing quote found)
        const looseRegex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)$`);
        const looseMatch = jsonStr.match(looseRegex);
        if (looseMatch) return looseMatch[1];
        
        return "";
    };

    result.mutationName = extract("mutationName");
    result.reasoning = extract("reasoning");
    
    // p5Code extraction
    let codeRaw = extract("p5Code");
    if (codeRaw) {
        result.p5Code = codeRaw
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\t/g, '  ');
    }

    return result;
};

// --- Sub-Component: TerminalPanel ---

interface TerminalPanelProps {
    data: SpinnerData | null;
    streamBuffer: string;
    isGenerating: boolean;
    tpsHistory: number[];
    generationStartTime: number;
    label: string;
    labelColorClass: string;
    showControls?: boolean;
    overlayPosition?: string;
    className?: string;
    allowInteraction?: boolean;
    sessionStats?: {
        avgTime: string;
        successRate: string;
        errorRate: string;
        totalAttempts: number;
        totalTokens: number;
        totalFailures: number;
    };
    theme?: 'dark' | 'light';
    error?: string;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({
    data,
    streamBuffer,
    isGenerating,
    tpsHistory,
    generationStartTime,
    label,
    labelColorClass,
    showControls,
    overlayPosition = "inset-x-0",
    className = "",
    allowInteraction = true,
    sessionStats,
    theme = 'dark',
    error
}) => {
    const [liveElapsed, setLiveElapsed] = useState(0);
    const [isCodeOpen, setIsCodeOpen] = useState(false);
    const codeScrollRef = useRef<HTMLPreElement>(null);
    const lastValidCodeRef = useRef<string>("");

    // Live timer & Auto-Open/Collapse Logic
    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            setIsCodeOpen(true); // Automatically expand to show streaming
            interval = setInterval(() => {
                setLiveElapsed(performance.now() - generationStartTime);
            }, 50);
        } else {
            setIsCodeOpen(false); // Automatically collapse when done
            setLiveElapsed(0);
        }
        return () => clearInterval(interval);
    }, [isGenerating, generationStartTime]);

    // Reset last valid code when starting a new generation
    useEffect(() => {
        if (isGenerating && streamBuffer.length < 10) {
            lastValidCodeRef.current = "";
        }
    }, [generationStartTime, isGenerating, streamBuffer]);

    // Derived Display Data
    const displayData = useMemo(() => {
        if (isGenerating && streamBuffer) {
            return parsePartialJson(streamBuffer);
        }
        return data || { mutationName: "", reasoning: "", p5Code: "" };
    }, [isGenerating, streamBuffer, data]);

    // Cache valid code to prevent flashing when the parser returns empty during a tricky chunk
    if (displayData.p5Code) {
        lastValidCodeRef.current = displayData.p5Code;
    }
    const codeToDisplay = displayData.p5Code || lastValidCodeRef.current;

    // Auto-scroll logic
    useEffect(() => {
        if (isCodeOpen && codeScrollRef.current) {
            codeScrollRef.current.scrollTop = codeScrollRef.current.scrollHeight;
        }
    }, [codeToDisplay, isCodeOpen]);

    const liveAvgTps = isGenerating && liveElapsed > 0 
        ? ((streamBuffer.length / 4) / (liveElapsed / 1000)).toFixed(1)
        : "0.0";
    
    const totalTokens = isGenerating 
        ? Math.round(streamBuffer.length / 4) 
        : (data?.totalTokens || 0);
        
    const timeValue = isGenerating 
        ? (liveElapsed / 1000).toFixed(1)
        : (data?.generationTimeMs ? (data.generationTimeMs / 1000).toFixed(1) : "0.0");

    const tpsValue = isGenerating ? liveAvgTps : data?.tokensPerSecond || 0;

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const code = data?.p5Code;
        if (!code) return;
    
        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const safeName = (data?.mutationName || 'spinner').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
        link.download = `spinner_${data?.id || 'gen'}_${safeName}.js`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`flex-1 flex flex-col justify-end min-w-0 last:border-r-0 relative group overflow-hidden transition-colors duration-500 ${className}
            ${theme === 'dark' ? 'bg-[#0a0a0a] border-r border-neutral-900/50' : 'bg-white border-r border-neutral-200'}`}>
            
            {/* 
                CODE OVERLAY (Fixed Position to break out of containers) 
                Sits behind metrics (z-30) but covers spinner.
            */}
            <AnimatePresence>
                {isCodeOpen && (
                    <motion.div 
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '110%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 150 }}
                        className={`fixed ${overlayPosition} top-14 bottom-0 z-[60] flex flex-col pt-0 pb-56 md:pb-80 px-0 border-b shadow-[0_-20px_60px_rgba(0,0,0,0.4)] transition-colors duration-500
                            ${theme === 'dark' ? 'bg-[#050505]/95 backdrop-blur-xl border-neutral-800' : 'bg-white/95 backdrop-blur-xl border-neutral-200'}`}
                    >
                         {/* NEW HEADER in Overlay (Acts as Collapse Trigger) */}
                         <div 
                            onClick={() => setIsCodeOpen(false)}
                            className={`flex-none h-11 flex items-center justify-between px-3 md:px-6 border-b border-t cursor-pointer select-none transition-colors group/header
                                ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800/80' : 'bg-neutral-100 border-neutral-200 hover:bg-neutral-200/80'}`}
                        >
                            <div className="flex items-center gap-3">
                                <motion.span 
                                    animate={{ y: [0, -2, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className={`text-[10px] font-bold ${theme === 'dark' ? 'text-blue-500' : 'text-blue-600'}`}
                                >
                                    ▼
                                </motion.span>
                                <span className={`text-[9px] font-bold uppercase tracking-[0.2em] transition-colors
                                    ${theme === 'dark' ? 'text-neutral-300 group-hover/header:text-white' : 'text-neutral-600 group-hover/header:text-black'}`}>
                                    Collapse Source Code
                                </span>
                                {isGenerating && <div className="flex gap-1 items-center px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 ml-2">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] text-blue-400 font-bold tracking-widest uppercase">Streaming</span>
                                </div>}
                            </div>

                            <div className="flex items-center gap-4">
                                {codeToDisplay && <span className={`text-[8px] font-mono uppercase tracking-widest px-2 py-1 rounded border transition-colors
                                    ${theme === 'dark' ? 'text-neutral-600 bg-black border-neutral-800' : 'text-neutral-400 bg-white border-neutral-200'}`}>
                                    {codeToDisplay.length} bytes</span>}
                                {showControls && data?.p5Code && (
                                    <button 
                                        onClick={handleDownload}
                                        disabled={!allowInteraction}
                                        tabIndex={allowInteraction ? 0 : -1}
                                        className={`flex items-center gap-2 px-3 py-1 rounded-sm transition-all text-[9px] uppercase tracking-[0.1em] font-bold border disabled:opacity-50
                                            ${theme === 'dark' ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-700' : 'bg-white hover:bg-neutral-50 text-neutral-600 hover:text-black border-neutral-200 shadow-sm'}`}
                                    >
                                        <span>Download Archive</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </button>
                                )}
                            </div>
                         </div>

                         <div  
                            className={`flex-1 overflow-auto custom-scrollbar transition-colors ${theme === 'dark' ? 'bg-[#020202]' : 'bg-neutral-50'}`}
                         >
                            {error && (
                                <div className="p-4 m-4 bg-red-950/20 border border-red-900/50 rounded text-red-500 font-mono text-[10px] space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                        <span className="font-bold tracking-widest uppercase">Process_Incident_Detected</span>
                                    </div>
                                    <div className="pl-4 border-l border-red-900/30 py-1 opacity-80 backdrop-blur-sm">
                                        {error}
                                    </div>
                                </div>
                            )}
                            <div ref={codeScrollRef} className={`p-4 md:px-8 py-8 font-mono text-[10px] md:text-xs transition-colors ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                {highlightCode(codeToDisplay)}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 
                BOTTOM CONTROL GROUP (Z-40 to stay above the code overlay)
            */}
            <div className={`relative z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] border-t flex flex-col max-h-full transition-colors duration-500
                ${theme === 'dark' ? 'bg-black border-neutral-900' : 'bg-white border-neutral-200'}`}>
                
                {/* TRIGGER BAR (EXPAND) */}
                <div 
                    onClick={() => setIsCodeOpen(true)}
                    className={`flex-none h-8 flex items-center justify-between px-3 md:px-6 border-b cursor-pointer select-none transition-all duration-300 group/trigger
                    ${isCodeOpen ? 'opacity-0 -translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'}
                    ${theme === 'dark' ? 'bg-neutral-900/40 hover:bg-neutral-900 border-neutral-900' : 'bg-neutral-50/40 hover:bg-neutral-100 border-neutral-200'}`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] transition-transform duration-300 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            ▲
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors
                            ${theme === 'dark' ? 'text-neutral-600 group-hover/trigger:text-neutral-400' : 'text-neutral-400 group-hover/trigger:text-neutral-600'}`}>
                            Expand Code Stream
                        </span>
                    </div>

                    {showControls && data?.p5Code && (
                        <button 
                            onClick={handleDownload}
                            disabled={!allowInteraction}
                            tabIndex={allowInteraction ? 0 : -1}
                            className={`flex items-center gap-2 px-2 py-0.5 rounded border transition-all text-[9px] uppercase tracking-wider font-medium disabled:opacity-50
                                ${theme === 'dark' ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-white border-neutral-800' : 'bg-white hover:bg-neutral-50 text-neutral-400 hover:text-black border-neutral-200'}`}
                        >
                            <span>JS</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                    )}
                </div>

                {/* INFO & DESCRIPTION */}
                <div className={`flex-shrink min-h-0 overflow-y-auto px-4 md:px-6 pt-3 pb-2 transition-all duration-500 custom-scrollbar max-h-32 md:max-h-40
                    ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
                     <div className="flex items-center gap-2 md:gap-3 mb-1">
                        <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-1.5 py-px rounded border ${labelColorClass}
                            ${theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                            {label}
                        </span>
                        <h2 className={`text-sm md:text-base font-bold tracking-tight leading-none truncate transition-colors
                            ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                            {displayData.mutationName || "..."}
                        </h2>
                    </div>
                    <p className={`text-[9px] md:text-[10px] leading-relaxed font-medium max-w-3xl transition-colors
                        ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        {displayData.reasoning || "..."}
                    </p>
                </div>

                {/* METRICS ROW */}
                <div className={`flex-none grid grid-cols-3 divide-x transition-colors duration-500 mt-2
                    ${theme === 'dark' ? 'bg-black divide-neutral-900 border-y border-neutral-900' : 'bg-white divide-neutral-100 border-y border-neutral-100'}`}>
                    <div className="p-2 md:p-3 flex flex-col justify-end items-end text-right">
                        <span className="text-[8px] md:text-[9px] text-neutral-600 uppercase tracking-[0.2em] mb-1">Time</span>
                        <div className="flex items-baseline gap-1 justify-end w-full">
                            <span className={`text-lg sm:text-xl md:text-3xl xl:text-4xl font-light font-mono tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
                                {timeValue}
                            </span>
                            <span className="text-[10px] md:text-xs text-neutral-600 font-mono">s</span>
                        </div>
                    </div>
                    <div className="p-2 md:p-3 flex flex-col justify-end items-end text-right">
                        <span className="text-[8px] md:text-[9px] text-neutral-600 uppercase tracking-[0.2em] mb-1">Speed</span>
                        <div className="flex items-baseline gap-1 justify-end w-full">
                            <span className={`text-lg sm:text-xl md:text-3xl xl:text-4xl font-light font-mono tracking-tighter ${isGenerating ? 'text-blue-400 animate-pulse' : (theme === 'dark' ? 'text-white' : 'text-neutral-900')}`}>
                                {tpsValue}
                            </span>
                            <span className="text-[10px] md:text-xs text-neutral-600 font-mono">tps</span>
                        </div>
                    </div>
                    <div className="p-2 md:p-3 flex flex-col justify-end items-end text-right">
                        <span className="text-[8px] md:text-[9px] text-neutral-600 uppercase tracking-[0.2em] mb-1">Tokens</span>
                        <div className="flex items-baseline gap-1 justify-end w-full">
                            <span className={`text-lg sm:text-xl md:text-3xl xl:text-4xl font-light font-mono tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
                                {totalTokens}
                            </span>
                        </div>
                    </div>
                </div>

                {/* DIAGNOSTICS HUB (New) */}
                {sessionStats && (
                    <div className={`flex-none border-b pb-1 transition-colors duration-500
                        ${theme === 'dark' ? 'bg-[#050505] border-neutral-900' : 'bg-neutral-50 border-neutral-100'}`}>
                        <div className={`grid grid-cols-3 divide-x border-b ${theme === 'dark' ? 'divide-neutral-900 border-neutral-900/50' : 'divide-neutral-200 border-neutral-200/50'}`}>
                            <div className="px-3 py-1.5 flex flex-col items-start">
                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-wider">Avg Gen</span>
                                <span className={`text-[10px] font-mono font-bold leading-none mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>{sessionStats.avgTime}s</span>
                            </div>
                            <div className="px-3 py-1.5 flex flex-col items-start">
                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-wider">Success %</span>
                                <span className={`text-[10px] font-mono font-bold leading-none mt-1 ${parseFloat(sessionStats.successRate) > 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                                    {sessionStats.successRate}%
                                </span>
                            </div>
                            <div className="px-3 py-1.5 flex flex-col items-start">
                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-wider">Attempts</span>
                                <span className={`text-[10px] font-mono font-bold leading-none mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>{sessionStats.totalAttempts}</span>
                            </div>
                        </div>
                        <div className={`grid grid-cols-3 divide-x ${theme === 'dark' ? 'divide-neutral-900' : 'divide-neutral-200'}`}>
                             <div className="px-3 py-1.5 flex flex-col items-start">
                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-wider">Err Rate</span>
                                <span className={`text-[10px] font-mono leading-none mt-0.5 ${parseFloat(sessionStats.errorRate) > 0 ? 'text-red-500' : 'text-neutral-500'}`}>
                                    {sessionStats.errorRate}%
                                </span>
                            </div>
                            <div className="px-3 py-1.5 flex flex-col items-start">
                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-wider">Net Tokens</span>
                                <span className={`text-[10px] font-mono leading-none mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>{sessionStats.totalTokens.toLocaleString()}</span>
                            </div>
                            <div className="px-3 py-1.5 flex flex-col items-start">
                                <span className="text-[7px] text-neutral-600 uppercase font-mono tracking-wider">Failures</span>
                                <span className={`text-[10px] font-mono leading-none mt-0.5 ${sessionStats.totalFailures > 0 ? 'text-red-900' : 'text-neutral-400'}`}>{sessionStats.totalFailures}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* CHART */}
                <div className={`flex-none h-20 md:h-28 w-full relative transition-colors duration-500
                    ${theme === 'dark' ? 'bg-neutral-900/10 bg-black' : 'bg-neutral-50/50 bg-white'}`}>
                     <StatsChart data={tpsHistory} label="" isLive={isGenerating} />
                </div>
            </div>
        </div>
    );
};

// --- Main Container ---

interface TerminalProps {
  currentData: SpinnerData | null;
  candidates: { a: CandidateState; b: CandidateState } | null;
  
  isGenerating: boolean;
  generationStartTime: number;
  history: SpinnerData[];
  currentIndex: number;
  
  isSelectionMode: boolean;
  mobileTab?: 'a' | 'b'; 
  allowInteraction?: boolean;
  stats: GlobalStats;
  theme?: 'dark' | 'light';
}

export const Terminal: React.FC<TerminalProps> = ({ 
    currentData,
    candidates,
    isGenerating,
    generationStartTime,
    history,
    currentIndex,
    isSelectionMode,
    mobileTab = 'a',
    allowInteraction = true,
    stats,
    theme = 'dark'
}) => {
    const sessionStats = useMemo(() => {
        const generationTimes = history
            .filter(h => h.generationTimeMs > 0)
            .map(h => h.generationTimeMs);
        
        const avg = generationTimes.length > 0 
            ? (generationTimes.reduce((a, b) => a + b, 0) / generationTimes.length / 1000).toFixed(2)
            : "0.00";
        
        const err = stats.attempts > 0 
            ? ((stats.failures / stats.attempts) * 100).toFixed(1)
            : "0.0";
            
        const success = stats.attempts > 0
            ? (((stats.attempts - stats.failures) / stats.attempts) * 100).toFixed(1)
            : "0.0";
            
        const totalTokens = history.reduce((acc, h) => acc + (h.totalTokens || 0), 0);
            
        return {
            avgTime: avg,
            errorRate: err,
            successRate: success,
            totalAttempts: stats.attempts,
            totalTokens: totalTokens,
            totalFailures: stats.failures
        };
    }, [history, stats]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] font-mono text-sm border-t border-neutral-800">
        <style>{`
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #262626;
                border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #404040;
            }
        `}</style>

        {/* --- CONTENT AREA (SPLIT OR SINGLE) --- */}
        <div className="flex-1 flex flex-row overflow-hidden">
            {isSelectionMode && candidates ? (
                <>
                    <TerminalPanel 
                        data={candidates.a.data}
                        streamBuffer={candidates.a.buffer}
                        isGenerating={isGenerating}
                        tpsHistory={candidates.a.tpsHistory}
                        generationStartTime={generationStartTime}
                        label="VARIANT A"
                        labelColorClass="text-blue-400 border-blue-900/50 bg-blue-900/10"
                        showControls={!isGenerating}
                        overlayPosition="left-0 w-full lg:w-1/2 border-r border-neutral-900"
                        className={`${mobileTab === 'b' ? 'hidden lg:flex' : 'flex'}`}
                        allowInteraction={allowInteraction}
                        sessionStats={sessionStats}
                        theme={theme}
                        error={candidates.a.error}
                    />
                    <div className="w-px bg-neutral-900 flex-none z-10 hidden lg:block" />
                    <TerminalPanel 
                        data={candidates.b.data}
                        streamBuffer={candidates.b.buffer}
                        isGenerating={isGenerating}
                        tpsHistory={candidates.b.tpsHistory}
                        generationStartTime={generationStartTime}
                        label="VARIANT B"
                        labelColorClass="text-purple-400 border-purple-900/50 bg-purple-900/10"
                        showControls={!isGenerating}
                        overlayPosition="right-0 w-full lg:w-1/2"
                        className={`${mobileTab === 'a' ? 'hidden lg:flex' : 'flex'}`}
                        allowInteraction={allowInteraction}
                        sessionStats={sessionStats}
                        theme={theme}
                        error={candidates.b.error}
                    />
                </>
            ) : (
                <TerminalPanel 
                    data={currentData}
                    streamBuffer=""
                    isGenerating={false}
                    tpsHistory={currentData?.tpsHistory || []}
                    generationStartTime={0}
                    label={`GEN ${currentData?.id || 1}`}
                    labelColorClass="text-white border-neutral-700 bg-neutral-800"
                    showControls={true}
                    overlayPosition="inset-x-0"
                    allowInteraction={allowInteraction}
                    sessionStats={sessionStats}
                    theme={theme}
                    error={currentData?.error}
                />
            )}
        </div>
    </div>
  );
};