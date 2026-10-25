// How Scene Mode names an MC-707 scene: the row's place from the first scene, as the MC-707 shows it
// with Call Scene TYPE2 (8 banks of 16: 1-1 … 8-16).
//
// Reads: S.
import { sceneName } from '../zen/zc-scenes.js';
import { firstScene } from './model.js';

/** The MC-707 scene row i goes into ("1-3"), or "—" past the last one. */
export const sceneLabel = i => (firstScene() + i < 128 ? sceneName(firstScene() + i) : '—');
