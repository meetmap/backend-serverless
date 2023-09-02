"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoHandler = exports.imageHandler = void 0;
const service_1 = require("./service");
const constants_1 = require("./constants");
const imageHandler = async (event) => {
    if (!event?.Records) {
        throw new Error("No records found");
    }
    console.log(`Found ${event.Records.length} records`);
    for (const record of event.Records) {
        const transformer = new service_1.AssetProcessing(record.awsRegion);
        const objKey = decodeURIComponent(record.s3.object.key);
        if (!objKey.endsWith("/_original__image")) {
            console.log("Skip not _orignal::image invocation");
            return;
        }
        const bucketName = record.s3.bucket.name;
        const folderPath = objKey.split("/").slice(0, -1).join("/");
        const sizes = (0, constants_1.getImageSizes)(folderPath);
        for (const size of sizes) {
            console.log("Processing size", size.size_label);
            await transformer.imageProcessingPipline(bucketName, objKey, size.s3_key, [size.width, size.height]);
        }
    }
};
exports.imageHandler = imageHandler;
const videoHandler = async (event) => {
    if (!event?.Records) {
        throw new Error("No records found");
    }
    console.log(`Found ${event.Records.length} records`);
    for (const record of event.Records) {
        const transformer = new service_1.AssetProcessing(record.awsRegion);
        const objKey = decodeURIComponent(record.s3.object.key);
        if (!objKey.endsWith("/_original__video")) {
            console.log("Skip not _orignal::video invocation");
            return;
        }
        const bucketName = record.s3.bucket.name;
        const folderPath = objKey.split("/").slice(0, -1).join("/");
        console.log("Processing video");
        await transformer.videoProcessingPipline(bucketName, objKey, folderPath);
    }
};
exports.videoHandler = videoHandler;
