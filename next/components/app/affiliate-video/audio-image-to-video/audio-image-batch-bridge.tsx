export type AudioImageBatchBridgeActions = {
  generateAllImages: () => Promise<void>;
  generateAllVideos: () => Promise<void>;
};

let registeredActions: AudioImageBatchBridgeActions | null = null;

export function registerAudioImageBatchActions(
  actions: AudioImageBatchBridgeActions | null
) {
  registeredActions = actions;
}

export function getAudioImageBatchActions(): AudioImageBatchBridgeActions | null {
  return registeredActions;
}
