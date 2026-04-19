import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SpinnerData } from '../types';
import { P5Canvas } from './P5Canvas';

interface LineageViewProps {
    isOpen: boolean;
    onClose: () => void;
    history: SpinnerData[];
    currentIndex: number;
    onSelect: (index: number) => void;
    theme?: 'dark' | 'light';
}

export const LineageView: React.FC<LineageViewProps> = ({
    isOpen,
    onClose,
    history,
    currentIndex,
    onSelect,
    theme = 'dark'
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Sidebar */}
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={`relative w-80 max-w-[90vw] h-full flex flex-col shadow-2xl border-l transition-colors duration-500
                            ${theme === 'dark' ? 'bg-[#0a0a0a] border-neutral-800' : 'bg-white border-neutral-200'}`}
                    >
                        <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`}>
                            <div>
                                <h3 className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Lineage Tree</h3>
                                <p className="text-[10px] text-neutral-500 mt-1 uppercase font-mono">{history.length} Generations tracked</p>
                            </div>
                            <button 
                                onClick={onClose}
                                className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-neutral-900 text-neutral-500 hover:text-white' : 'hover:bg-neutral-100 text-neutral-400 hover:text-black'}`}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                            {history.map((item, idx) => (
                                <motion.div 
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => onSelect(idx)}
                                    className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-95
                                        ${idx === currentIndex 
                                            ? 'border-blue-500/50 bg-blue-500/5' 
                                            : `border-transparent ${theme === 'dark' ? 'bg-neutral-900/50 hover:border-neutral-800' : 'bg-neutral-50 hover:border-neutral-200 shadow-sm'}`
                                        }`}
                                >
                                    <div className="flex gap-4">
                                        <div className="w-16 h-16 rounded-lg bg-black border border-neutral-800 overflow-hidden flex-none">
                                            <div className="scale-[0.16] origin-top-left w-[400px] h-[400px]">
                                                <P5Canvas code={item.p5Code} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[8px] font-mono text-neutral-600 uppercase">Gen_{String(item.id).padStart(3, '0')}</span>
                                                {idx === currentIndex && (
                                                    <span className="text-[8px] px-1.5 py-px rounded bg-blue-500 text-white font-bold animate-pulse">ACTIVE</span>
                                                )}
                                            </div>
                                            <h4 className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>{item.mutationName}</h4>
                                            <p className="text-[9px] text-neutral-500 line-clamp-2 mt-1 leading-tight">{item.reasoning}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Connection Line */}
                                    {idx < history.length - 1 && (
                                        <div className="absolute top-full left-11 w-px h-4 bg-neutral-800 -z-10" />
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        <div className={`p-4 border-t ${theme === 'dark' ? 'border-neutral-800 bg-black' : 'border-neutral-100 bg-neutral-50'}`}>
                             <button 
                                onClick={onClose}
                                className={`w-full py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest border transition-all
                                    ${theme === 'dark' ? 'border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-900' : 'border-neutral-200 text-neutral-400 hover:text-black hover:bg-white shadow-sm'}`}
                             >
                                Close Explorer
                             </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
