import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough, Readable, pipeline } from "stream";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { readdir, rm } from "fs/promises";

ffmpeg.setFfmpegPath("/opt/ffmpeg/ffmpeg");
export class AssetProcessing {
  private readonly client: S3Client;

  constructor(region: string) {
    this.client = new S3Client({
      region,
    });
  }
  public async uploadPicture(asset: Buffer, bucket: string, destinationAssetKey: string, contentType: string) {
    await this.checkImageMetadata(asset);

    const upload = new Upload({
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

  public async checkImageMetadata(payload: Readable | Buffer): Promise<void> {
    if (payload instanceof Readable) {
      const transformer = sharp();
      payload.pipe(transformer);
      const metadata = await transformer.metadata();
      this.imageMetadataCheck(metadata);
      return;
    }
    if (payload instanceof Buffer) {
      const metadata = await sharp(payload).metadata();
      this.imageMetadataCheck(metadata);
      return;
    }
    throw new Error("Unknown payload type in checkImageMetadata");
  }

  private imageMetadataCheck(metadata: sharp.Metadata) {
    if (typeof metadata.width === "undefined" || typeof metadata.height === "undefined") {
      throw new Error("Invalid image provided, no metadata");
    }
    const aspectRatio = metadata.width / metadata.height;

    // Change these values to what you consider "too extreme"
    const minAspectRatio = 6 / 20;
    const maxAspectRatio = 20 / 6;

    if (aspectRatio < minAspectRatio) {
      throw new Error("Bad image provided, min aspect ratio is 6 / 16");
    } else if (aspectRatio > maxAspectRatio) {
      throw new Error("Bad image provided, max aspect ratio is 16 / 6");
    }
  }

  public async getAssetStream(bucket: string, assetKey: string): Promise<Readable> {
    const asset = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: assetKey,
      })
    );
    if (!asset.Body) {
      throw new Error("Asset not found");
    }

    return asset.Body as Readable;
  }

  public async createStreamUploader(
    bucket: string,
    assetKey: string,
    contentType: string | undefined,
    passThrough: PassThrough
  ) {
    const upload = new Upload({
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

  public getSharpImageResizer(size: [number | undefined, number | undefined]) {
    const resizer = sharp()
      .rotate()
      .resize(...size)
      .jpeg()
      .withMetadata();
    return resizer;
  }

  public async imageProcessingPipline(
    bucket: string,
    originalAssetKey: string,
    destinationAssetKey: string,
    size: [number | undefined, number | undefined],
    cb?: (percentage: number) => Promise<void>
  ) {
    {
      const original = await this.getAssetStream(bucket, originalAssetKey);
      await this.checkImageMetadata(original);
    }
    {
      const resultContentType = "image/jpeg";
      const original = await this.getAssetStream(bucket, originalAssetKey);
      const resizer = this.getSharpImageResizer(size);
      const passThrough = new PassThrough();
      const uploader = await this.createStreamUploader(bucket, destinationAssetKey, resultContentType, passThrough);
      passThrough.on("data", () => {
        console.log("trigger");
      });
      pipeline(original, resizer, passThrough, (err) => {
        if (err) {
          console.error("Pipeline failed", err);
          throw new Error("Failed to process image");
        } else {
          console.log("Pipeline succeed");
        }
      });
      //   const queue = new AsyncQueue();
      //   uploader.on('httpUploadProgress', (progress) => {
      //     const percentage = Math.floor(
      //       ((progress.loaded ?? 0) / (progress.total ?? 0)) * 100,
      //     );
      //     if (cb) {
      //       ///needs to be because of race conditions
      //       queue.enqueue(async () => cb(percentage));
      //     }
      //   });
      await uploader.done();
    }
  }

  public async videoProcessingPipline(bucket: string, assetKey: string, outputFolderPath: string) {
    const inputStream = await this.getAssetStream(bucket, assetKey);

    const outputFolder = `/tmp/${outputFolderPath}`;
    const outputFile = `${outputFolder}/index.mpd`;

    await this.transcodeVideoToProgressive(inputStream, outputFile);
    console.log("Transcoded to progressive encoding.");
    //read dir and publish
    const outFiles = await readdir(outputFolder);
    // await Promise.all()
    console.log(outFiles.map((file) => file));
    //cleanupDir
    await rm(outputFolder, { recursive: true });
    // await uploader.done();
  }

  public async transcodeVideoToProgressive(inputStream: Readable, output: string) {
    const bitrates = [500, 1000]; // in kbps
    const resolutions = ["640x360", "1280x720"];

    return new Promise((resolve, reject) => {
      ffmpeg(inputStream)
        .outputOptions([
          // General options for ABR
          "-strict experimental",
          "-c:v hevc", // Use H.265 codec
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
        ])
        .format("dash")
        .outputOptions([
          // Specific options for 360p
          `-s:v:${bitrates.indexOf(500)} ${resolutions[0]}`,
          `-b:v:${bitrates.indexOf(500)} ${bitrates[0]}k`,
        ])
        .outputOptions([
          // Specific options for 720p
          `-s:v:${bitrates.indexOf(1000)} ${resolutions[1]}`,
          `-b:v:${bitrates.indexOf(1000)} ${bitrates[1]}k`,
        ])
        .output(output) // Name of the manifest file
        .on("start", console.log)
        .on("end", () => {
          console.log("Conversion complete");
          resolve(null);
        })
        .on("progress", function (progress: any) {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on("error", (err: any) => {
          console.log("An error occurred: ", err);
          reject(err);
        })
        .run();
    });
  }
}
