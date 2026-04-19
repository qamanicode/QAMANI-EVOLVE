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
}