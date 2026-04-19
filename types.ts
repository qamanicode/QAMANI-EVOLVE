/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface SpinnerData {
  id: number;
  mutationName: string;
  reasoning: string;
  p5Code: string;
  timestamp: number;
  generationTimeMs: number;
  tokensPerSecond: number;
  totalTokens: number;
  tpsHistory: number[]; // Time series of TPS sampled every 100ms
  error?: string; // Runtime or compilation error
  parentId?: number; // For lineage tracking
}

export interface GenerationStats {
  totalGenerations: number;
  avgTokensPerSec: number;
  lastGenerationTime: number;
}

export interface CandidateState {
  buffer: string;
  data: SpinnerData | null;
  tpsHistory: number[];
  error?: string;
}

export interface GlobalStats {
  attempts: number;
  failures: number;
}