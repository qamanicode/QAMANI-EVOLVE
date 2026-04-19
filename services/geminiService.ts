/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { SpinnerData } from "../types";

// We use the Schema to ensure the AI returns parsable code and metadata every time.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    mutationName: {
      type: Type.STRING,
      description: "A cool, sci-fi sounding name for this specific mutation (e.g., 'Nebula Pulse', 'Quantum Drift').",
    },
    reasoning: {
      type: Type.STRING,
      description: "A single sentence explaining the evolutionary logic: what was kept and what was drastically changed.",
    },
    p5Code: {
      type: Type.STRING,
      description: "The function body for a p5.js instance mode sketch. DO NOT include 'new p5()'. Assume 'p' is the p5 instance passed as an argument. Use 'p.setup' and 'p.draw'. The canvas size is 400x400. Use HSB color mode or Hex codes. NO EXTERNAL LIBRARIES.",
    },
  },
  required: ["mutationName", "reasoning", "p5Code"],
};

export const generateNextSpinner = async (
  previousCode: string | null,
  previousId: number,
  onStreamUpdate: (text: string) => void
): Promise<SpinnerData> => {
  const startTime = performance.now();
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a high-performance creative coding AI specialized in p5.js, known as the QAMANI Evolution Engine.
    Your goal is to generate visually stunning, seamlessly looping kinetic art and loading indicators.
    
    CONSTRAINTS:
    1. The code must be the *body* of a function that accepts a p5 instance named 'p'.
    2. Example format:
       p.setup = () => { 
          p.createCanvas(400, 400); 
          p.colorMode(p.HSB, 360, 100, 100); 
       };
       p.draw = () => { 
          p.clear(); 
          // ... drawing logic
       };
    3. CANVAS & LAYOUT: 
       - The canvas size is 400x400.
       - IMPORTANT: Maximize the use of space. Fill the canvas.
       - Keep drawing elements within a 380x380 pixel safe zone centered on the canvas (Radius 190px).
       - Do not leave excessive empty space around the edges.
       - Focus on the 'QAMANI' aesthetic: fluid, organic, yet mathematically precise.
    
    4. CONTINUOUS ANIMATION:
       - The animation should be continuous, seamless, and hypnotic.
       - Do NOT force a loop reset using modulo (e.g., avoid t % 4000). 
       - Use 'p.millis()' or 'p.frameCount' directly to drive motion.
       - Use sine waves, rotation, and noise for natural, infinite flows.
    
    5. CURSOR LEGIBILITY:
       - These designs will be downscaled to 32x32 pixels for use as mouse cursors.
       - Use THICK strokes (strokeWeight > 15 relative to 400px canvas).
       - Avoid tiny details. Focus on bold, clear shapes and high contrast.
       - AVOID standard colors (red, blue). Use HSB or specific Hex.
       
    6. Evolution Logic:
       - If 'Previous Code' is provided: Analyze it. Keep 80% of the logic (lineage). Drastically mutate 20% (creativity).
       - If 'Previous Code' is null: Create a "Progenitor" seed spinner. Simple but elegant.
    
    7. NO BACKGROUNDS: The spinner must be floating on a transparent canvas. 
       - Use 'p.clear()' at the start of 'p.draw()'. 
       - Do NOT use 'p.background()'.
    
    8. SYNTAX: Do not wrap the code in markdown blocks (\`\`\`). Do not wrap the code in a closure. Just return the executable lines to go inside the wrapper function.
    9. FORMATTING: Use 2-space indentation and newlines to make the code readable in a pre-formatted block. Do not minify.
  `;

  const prompt = previousCode 
    ? `PREVIOUS SPINNER CODE:\n${previousCode}\n\nINSTRUCTION: take one component from the spinner that you like, to develop the next one.`
    : `INSTRUCTION: Generate the Progenitor (Gen 1). A pure, minimal geometric loop.`;

  let fullText = "";

  try {
    const streamResult = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    for await (const chunk of streamResult) {
      const chunkText = chunk.text || "";
      fullText += chunkText;
      onStreamUpdate(fullText);
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    
    // Parse the JSON
    const parsed = JSON.parse(fullText);
    
    // Calculate naive tokens/sec (approx 4 chars per token)
    const estimatedTokens = fullText.length / 4;
    const tps = (estimatedTokens / (durationMs / 1000));

    return {
      id: previousId + 1,
      mutationName: parsed.mutationName,
      reasoning: parsed.reasoning,
      p5Code: parsed.p5Code,
      timestamp: Date.now(),
      generationTimeMs: durationMs,
      tokensPerSecond: parseFloat(tps.toFixed(1)),
      totalTokens: Math.round(estimatedTokens),
      tpsHistory: [], // Placeholder, populated by the consumer
    };

  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
};