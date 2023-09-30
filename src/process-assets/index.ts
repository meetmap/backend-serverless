import { type S3CreateEvent } from "aws-lambda";
import { AssetProcessing } from "./service";
import { getImageSizes } from "./constants";
import { exec } from "child_process";
//interfaces

export const imageHandler = async (event: S3CreateEvent) => {
  if (!event?.Records) {
    throw new Error("No records found");
  }
  console.log(`Found ${event.Records.length} records`);
  for (const record of event.Records) {
    const transformer = new AssetProcessing(record.awsRegion);
    const objKey = decodeURIComponent(record.s3.object.key);
    if (!objKey.endsWith("/_original__image")) {
      console.log("Skip not _orignal::image invocation");
      return;
    }
    const bucketName = record.s3.bucket.name;
    const folderPath = objKey.split("/").slice(0, -1).join("/");
    const sizes = getImageSizes(folderPath);
    for (const size of sizes) {
      console.log("Processing size", size.size_label);
      await transformer.imageProcessingPipline(bucketName, objKey, size.s3_key, [size.width, size.height]);
    }
  }
};

export const videoHandler = async (event: S3CreateEvent) => {
  if (!event?.Records) {
    throw new Error("No records found");
  }
  console.log(`Found ${event.Records.length} records`);
  for (const record of event.Records) {
    const transformer = new AssetProcessing(record.awsRegion);
    const objKey = decodeURIComponent(record.s3.object.key);
    if (!objKey.endsWith("/_original__video")) {
      console.log("Skip not _orignal::video invocation");
      return;
    }
    const bucketName = record.s3.bucket.name;
    const folderPath = [...objKey.split("/").slice(0, -1), "abr"].join("/");
    console.log("Processing video");
    await transformer.videoProcessingPipline(bucketName, objKey, folderPath);
  }
};
