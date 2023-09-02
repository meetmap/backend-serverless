export interface IAssetSize {
  size_label: SizeLabel;
  s3_key: string;
  width?: number; //for images, no need for videos
  height?: number; //for images, no need for videos
}

export enum SizeLabel {
  EXTRA_SMALL = "xs",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}
