export interface DisplayLayers {
  vertices: boolean;
  edges: boolean;
  faces: boolean;
}

export const DEFAULT_DISPLAY_LAYERS: Readonly<DisplayLayers> = {
  vertices: false,
  edges: false,
  faces: true,
};
