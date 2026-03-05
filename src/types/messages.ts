export const MESSAGE_TYPE_CONFIG_CHANGED =
  `gl-bpmn-viewer-config-changed` as const;
export const MESSAGE_TYPE_CONTENT_SCRIPT_READY =
  `gl-bpmn-viewer-content-script-ready` as const;
export const MESSAGE_TYPE_DEBUG =
  `gl-bpmn-viewer-debug-message` as const;
export const MESSAGE_TYPE_DIFF_CONTENT_INIT =
  `gl-bpmn-viewer-content-init-diff` as const;
export const MESSAGE_TYPE_BLOB_CONTENT_INIT =
  `gl-bpmn-viewer-content-init-blob` as const;

export interface CommunicationMessage{
  type?: string;
  url: string;
  eventSource?: string;
}