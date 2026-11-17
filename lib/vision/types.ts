/** Provider-agnostic vision contract. Swapping provider = adding one file here. */
export type VisionImage = { base64: string; mediaType: string };

export type VisionRequest = {
  image: VisionImage;
  system: string;
  prompt: string;
  maxTokens?: number;
};

export type VisionProvider = {
  /** Shown in error notes so a failure names the provider that failed. */
  readonly name: string;
  /** Returns the model's raw text reply. Throws on transport/API errors. */
  analyse(req: VisionRequest): Promise<string>;
};
