import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Atom, Zap, Radiation, Activity, ShieldAlert, Cpu } from 'lucide-react';

interface CinematicPromoProps {
    onClose: () => void;
    theme?: 'dark' | 'light';
}

export const CinematicPromo: React.FC<CinematicPromoProps> = ({ onClose, theme = 'dark' }) => {
    const [step, setStep] = useState(0);

    const sequence = [
        {
            title: "INITIALIZING CORE",
            desc: "Waking the latent intelligence of the Gemini 3 Flash engine.",
            icon: <Cpu className="w-16 h-16 text-blue-500" />,
            duration: 2000
        },
        {
            title: "ENRICHING ISOTOPES",
            desc: "Feeding raw seed code into the digital centrifuge.",
            icon: <Radiation className="w-16 h-16 text-yellow-500 animate-spin-slow" />,
            duration: 2000
        },
        {
            title: "CHAIN REACTION",
            desc: "Exponential mutation of kinetic patterns through recursive feedback.",
            icon: <Activity className="w-16 h-16 text-red-500" />,
            duration: 2500
        },
        {
            title: "QAMANI EVOLVE",
            desc: "A Fusion-Grade Intelligence for the New Era of Creation.",
            icon: <Atom className="w-24 h-24 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]" />,
            duration: 5000
        }
    ];

    useEffect(() => {
        if (step < sequence.length) {
            const timer = setTimeout(() => {
                setStep(s => s + 1);
            }, sequence[step].duration);
            return () => clearTimeout(timer);
        } else {
            // End of sequence
            const endTimer = setTimeout(onClose, 1000);
            return () => clearTimeout(endTimer);
        }
    }, [step, onClose]);

    return (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden">
            {/* Background Grid/Effects */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
            </div>

            <AnimatePresence mode="wait">
                {step < sequence.length && (
                    <motion.div 
                        key={step}
                        initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 1.2, filter: "blur(20px)" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative flex flex-col items-center text-center space-y-8 px-6"
                    >
                        {/* Icon Container */}
                        <motion.div 
                            animate={{ 
                                y: [-10, 10, -10],
                                rotate: step === 1 ? [0, 360] : 0
                            }}
                            transition={{ 
                                y: { repeat: Infinity, duration: 4, ease: "easeInOut" },
                                rotate: { repeat: Infinity, duration: 10, ease: "linear" }
                            }}
                            className="p-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl relative"
                        >
                            {sequence[step].icon}
                            {/* Decorative pulses */}
                            <motion.div 
                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 rounded-full border border-blue-500/30"
                            />
                        </motion.div>

                        <div className="space-y-2">
                            <motion.h2 
                                initial={{ letterSpacing: "1em", opacity: 0 }}
                                animate={{ letterSpacing: "0.4em", opacity: 1 }}
                                className="text-2xl md:text-4xl font-black text-white uppercase tracking-[0.4em]"
                            >
                                {sequence[step].title}
                            </motion.h2>
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                className="h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto"
                            />
                            <p className="text-blue-400/60 font-mono text-xs uppercase tracking-widest max-w-sm">
                                {sequence[step].desc}
                            </p>
                        </div>

                        {/* Scanner Line Effect */}
                        <motion.div 
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                            className="absolute left-0 right-0 h-[2px] bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-[-1]"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip Button */}
            <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                whileHover={{ opacity: 1 }}
                onClick={onClose}
                className="absolute bottom-12 right-12 text-white/50 font-mono text-[10px] uppercase tracking-widest border border-white/20 p-2 rounded hover:bg-white/5 transition-all"
            >
                TERMINATE_PROMO
            </motion.button>

            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </div>
    );
};
