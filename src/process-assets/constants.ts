import { IAssetSize, SizeLabel } from "./types";

export const getImageSizes = (folderPath: string): IAssetSize[] => [
  {
    s3_key: `${folderPath}/${SizeLabel.EXTRA_SMALL}`,
    size_label: SizeLabel.EXTRA_SMALL,
    height: 48,
    width: 48,
  },
  {
    s3_key: `${folderPath}/${SizeLabel.SMALL}`,
    size_label: SizeLabel.SMALL,
    height: 96,
    width: 96,
  },
  {
    s3_key: `${folderPath}/${SizeLabel.MEDIUM}`,
    size_label: SizeLabel.MEDIUM,
    height: 204,
    width: 204,
  },
  {
    s3_key: `${folderPath}/${SizeLabel.LARGE}`,
    size_label: SizeLabel.LARGE,
    height: 512,
    width: 512,
  },
];
