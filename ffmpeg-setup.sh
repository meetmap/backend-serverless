# https://www.serverless.com/blog/publish-aws-lambda-layers-serverless-framework/
mkdir ffmpeg-layer
cd ffmpeg-layer
curl -O https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz
tar xf ffmpeg-git-amd64-static.tar.xz
rm ffmpeg-git-amd64-static.tar.xz
mv ffmpeg-git-*-amd64-static ffmpeg
cd ..