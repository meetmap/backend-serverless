"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetProcessing = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const stream_1 = require("stream");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const sharp_1 = __importDefault(require("sharp"));
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
process.env.NODE_ENV !== "development" && fluent_ffmpeg_1.default.setFfmpegPath("/opt/ffmpeg/ffmpeg");
class AssetProcessing {
    client;
    constructor(region) {
        this.client = new client_s3_1.S3Client({
            region,
        });
    }
    async uploadPicture(asset, bucket, destinationAssetKey, contentType) {
        await this.checkImageMetadata(asset);
        const upload = new lib_storage_1.Upload({
            client: this.client,
            params: {
                Bucket: bucket,
                Key: destinationAssetKey,
                Body: asset,
                ContentType: contentType,
            },
        });
        return await upload.done();
    }
    async checkImageMetadata(payload) {
        if (payload instanceof stream_1.Readable) {
            const transformer = (0, sharp_1.default)();
            payload.pipe(transformer);
            const metadata = await transformer.metadata();
            this.imageMetadataCheck(metadata);
            return;
        }
        if (payload instanceof Buffer) {
            const metadata = await (0, sharp_1.default)(payload).metadata();
            this.imageMetadataCheck(metadata);
            return;
        }
        throw new Error("Unknown payload type in checkImageMetadata");
    }
    imageMetadataCheck(metadata) {
        if (typeof metadata.width === "undefined" || typeof metadata.height === "undefined") {
            throw new Error("Invalid image provided, no metadata");
        }
        const aspectRatio = metadata.width / metadata.height;
        const minAspectRatio = 6 / 20;
        const maxAspectRatio = 20 / 6;
        if (aspectRatio < minAspectRatio) {
            throw new Error("Bad image provided, min aspect ratio is 6 / 16");
        }
        else if (aspectRatio > maxAspectRatio) {
            throw new Error("Bad image provided, max aspect ratio is 16 / 6");
        }
    }
    async getAssetStream(bucket, assetKey) {
        const asset = await this.client.send(new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: assetKey,
        }));
        if (!asset.Body) {
            throw new Error("Asset not found");
        }
        return asset.Body;
    }
    async createStreamUploader(bucket, assetKey, contentType, passThrough) {
        const upload = new lib_storage_1.Upload({
            client: this.client,
            params: {
                Bucket: bucket,
                Key: assetKey,
                Body: passThrough,
                ContentType: contentType,
            },
        });
        return upload;
    }
    getSharpImageResizer(size) {
        const resizer = (0, sharp_1.default)()
            .rotate()
            .resize(...size)
            .jpeg()
            .withMetadata();
        return resizer;
    }
    async imageProcessingPipline(bucket, originalAssetKey, destinationAssetKey, size, cb) {
        {
            const original = await this.getAssetStream(bucket, originalAssetKey);
            await this.checkImageMetadata(original);
        }
        {
            const resultContentType = "image/jpeg";
            const original = await this.getAssetStream(bucket, originalAssetKey);
            const resizer = this.getSharpImageResizer(size);
            const passThrough = new stream_1.PassThrough();
            const uploader = await this.createStreamUploader(bucket, destinationAssetKey, resultContentType, passThrough);
            passThrough.on("data", () => {
                console.log("trigger");
            });
            (0, stream_1.pipeline)(original, resizer, passThrough, (err) => {
                if (err) {
                    console.error("Pipeline failed", err);
                    throw new Error("Failed to process image");
                }
                else {
                    console.log("Pipeline succeed");
                }
            });
            await uploader.done();
        }
    }
    async videoProcessingPipline(bucket, assetKey, outputFolderPath) {
        const inputStream = await this.getAssetStream(bucket, assetKey);
        console.log("Recieved original");
        const tempDir = await (0, promises_1.mkdtemp)("/tmp/");
        console.log({ tempDir });
        const outputFile = `${tempDir}/index.mpd`;
        await await this.transcodeVideoToProgressive(inputStream, outputFile);
        console.log("Transcoded to progressive encoding.");
        const outFiles = await (0, promises_1.readdir)(tempDir);
        console.log("Uploading to s3");
        await Promise.all(outFiles.map(async (fileName) => {
            const passThrough = new stream_1.PassThrough();
            const currentFilePath = `${tempDir}/${fileName}`;
            const inputStream = (0, fs_1.createReadStream)(currentFilePath);
            inputStream.pipe(passThrough);
            const uploader = await this.createStreamUploader(bucket, `${outputFolderPath}/${fileName}`, undefined, passThrough);
            await uploader.done();
            await (0, promises_1.rm)(currentFilePath, { recursive: true });
        }));
        console.log("Uploaded");
        console.log("Cleaning up");
        await (0, promises_1.rm)(tempDir, { recursive: true });
        console.log("Cleaned up");
    }
    async transcodeVideoToProgressive(inputStream, output) {
        const bitrates = [500, 1000];
        const resolutions = ["640x360", "1280x720"];
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputStream)
                .outputOptions([
                "-strict experimental",
                "-c:v hevc",
                "-profile:v main",
                "-keyint_min 150",
                "-g 150",
                "-sc_threshold 0",
                "-b_strategy 0",
                "-use_timeline 1",
                "-use_template 1",
                "-init_seg_name init_$RepresentationID$.m4s",
                "-media_seg_name chunk_$RepresentationID$_$Number$.m4s",
                "-hls_playlist 1",
                "-threads 2",
                "-v 32",
            ])
                .format("dash")
                .outputOptions([
                `-s:v:${bitrates.indexOf(500)} ${resolutions[0]}`,
                `-b:v:${bitrates.indexOf(500)} ${bitrates[0]}k`,
            ])
                .outputOptions([
                `-s:v:${bitrates.indexOf(1000)} ${resolutions[1]}`,
                `-b:v:${bitrates.indexOf(1000)} ${bitrates[1]}k`,
            ])
                .output(output)
                .on("start", console.log)
                .on("end", () => {
                console.log("Conversion complete");
                resolve(null);
            })
                .on("codecData", (data) => {
                console.log("Input is " + data.audio + " audio with " + data.video + " video");
            })
                .on("stderr", (stderrLine) => {
                console.log("Stderr output: " + stderrLine);
            })
                .on("progress", function (progress) {
                console.log(`Processing: ${progress.percent}% done`);
            })
                .on("error", (err) => {
                console.log("An error occurred: ", err);
                reject(err);
            })
                .run();
        });
    }
}
exports.AssetProcessing = AssetProcessing;
