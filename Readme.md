## How to initialize if we don'have ffmpeg-layer
```
bash ffmpeg-setup.sh
```

## Warning
Since I am using m1 mac, it has arm arc, but aws lambda has x64, that's why we need to have sharp lib x64 arc.
```
rm -rf node_modules/sharp                     
npm install --arch=x64 --platform=linux sharp
```

**Before running deploy, ensure you have run command above.**

## Deploy
To deploy run:
```
yarn build-and-deploy
```

## Tests
If u have mac m1, run: 
```
rm -rf node_modules/sharp                     
yarn add sharp
```
To test u need run:
```
yarn test <function_name> --path <path_to_args_file>
```
`function_name` is name of the lambda function (serverless.yaml functions)


`path_to_args_file` file with args, example is test.json