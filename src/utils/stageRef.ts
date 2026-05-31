import Konva from 'konva';

/** Module-level singleton — StageArea registers its stage here on mount. */
let _stage: Konva.Stage | null = null;

export const setGlobalStage = (s: Konva.Stage | null) => { _stage = s; };
export const getGlobalStage = () => _stage;
