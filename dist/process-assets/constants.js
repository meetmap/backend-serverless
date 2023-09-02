"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImageSizes = void 0;
const types_1 = require("./types");
const getImageSizes = (folderPath) => [
    {
        s3_key: `${folderPath}/${types_1.SizeLabel.EXTRA_SMALL}`,
        size_label: types_1.SizeLabel.EXTRA_SMALL,
        height: 48,
        width: 48,
    },
    {
        s3_key: `${folderPath}/${types_1.SizeLabel.SMALL}`,
        size_label: types_1.SizeLabel.SMALL,
        height: 96,
        width: 96,
    },
    {
        s3_key: `${folderPath}/${types_1.SizeLabel.MEDIUM}`,
        size_label: types_1.SizeLabel.MEDIUM,
        height: 204,
        width: 204,
    },
    {
        s3_key: `${folderPath}/${types_1.SizeLabel.LARGE}`,
        size_label: types_1.SizeLabel.LARGE,
        height: 512,
        width: 512,
    },
];
exports.getImageSizes = getImageSizes;
