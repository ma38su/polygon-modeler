export interface DisplayLayers {
  vertices: boolean;
  edges: boolean;
  faces: boolean;
  normals?: boolean;
}

export const DEFAULT_DISPLAY_LAYERS: Readonly<DisplayLayers> = {
  vertices: true,
  edges: true,
  faces: true,
  normals: false,
};
