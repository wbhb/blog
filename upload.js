const fs = require('fs');
const path = require('path');
const util = require('util');

const gm = require("gm");

const chalk = require("chalk");

const AWS = require('aws-sdk');

const UploadPool = require('./lambda/lib/UploaderPool.js');

const dynamoDB = new AWS.DynamoDB();
const s3 = new AWS.S3();

const Help = require('./lambda/lib/Help.js');

const help = require('./upload.usage.json');

let args;

try {
  args = Help.parse(process.argv.slice(2), help);
} catch (e) {
  console.error(chalk`{red ${e.message}}`);
  process.exitCode = 1;
  process.exit();
}

const nodehun = require('nodehun');

let readFileAsync = util.promisify(fs.readFile);

let dict;

const configFile = require("./uploadrc.json");

const sizes = [{
    name: "full",
    width: 0,
    height: 0
  },{
    name: "w640",
    targetDimensions: [
      640
    ],
    width: 0,
    height: 0,
    ext: ".w640.jpg"
  }, {
    name: "w320",
    targetDimensions: [
      320
    ],
    width: 0,
    height: 0,
    ext: ".w320.jpg"
  }, {
    name: "w16",
    targetDimensions: [
      16
    ],
    width: 0,
    height: 0,
    ext: ".w16.png"
  }, {
    name: "thumb",
    targetDimensions: [
      320,
      320
    ],
    width: 0,
    height: 0,
    ext: ".thumb.jpg"
  }
];

(async () => {

  if (args.usage || args.help || args.h) {

    Help.show(help, {exit: true, exitCode: 0});
  }

  let files = [];

  if (args._.length <= 0) {
    throw new Error("No files given");
  } else {
    args._.forEach((inputFile) => {

      if (!fs.existsSync(inputFile)) {
        throw new Error(`Input File not found: ${inputFile}`);
      }

      const stat = fs.lstatSync(inputFile);

      if (stat.isDirectory()) {
        let extraFiles = fs.readdirSync(inputFile);
        files = [...files, ...extraFiles];
      }

      if (stat.isFile()) {
        files = [...files, inputFile];
      }
    });
  }

  files = files.filter((item) => {
    return /\.html/.test(item);
  });

  files = files.map((item) => {
    return path.basename(item, ".html");
  });

  for (let i = 0; i < files.length; i++) {

    const file = files[i];

    const HTMLpath = `${configFile.local.posts.htmlFolder}/${file}.html`;
    const JSONpath = `${configFile.local.posts.jsonFolder}/${file}.json`;

    if (!fs.existsSync(HTMLpath)) {
      throw new Error(`HTML File not found: ${HTMLpath}`);
    }

    if (!fs.existsSync(JSONpath)) {
      throw new Error(`JSON File not found: ${JSONpath}`);
    }

    let contents = fs.readFileSync(HTMLpath, "utf8");
    let json = JSON.parse(fs.readFileSync(JSONpath, "utf8"));

    if (!args.skipproofread) {
      await proofread(contents);
    }

    let putData = {
      "author": {
        "M": {
          "displayName": {
            "S": configFile.author.displayName
          }
        }
      },
      "content": {
        "S": contents
      },
      "id": {
        "S": file
      },
      "images": {
        "L": [
        ]
      },
      "timestamp": {
        "S": json.published
      },
      "title": {
        "S": json.title
      },
      "oldUrl": {
        "S": json.url
      }
    };

    let imgTest = /\$\{image\("(.*?)"\)\}/g;
    let result;
    let images = [];

    let uploader = new UploadPool(3);

    while ((result = imgTest.exec(contents)) !== null) {

      const img = result[1];
      images.push(img);

      putData.images.L.push({
        "S": img
      });

      if (!args.skipimages) {

        let imgJson = {
          "alt": {
            "S": "not specified"
          },
          "id": {
            "S": img
          },
          "placeholder": {},
          "width": {},
          "height": {},
          "sizes": {
            "M": {}
          }
        };

        const imageProcessor = processImage(img, sizes);

        for await (image of imageProcessor) {

          console.info(`Processed image file: ${image.id}`);

          uploader.addUpload({
            func: uploadS3Image,
            args: [image],
            cb: () => {
              console.info(`Uploaded image file: ${image.filename}`);
            }
          });
          imgJson.sizes.M[image.name] = {
            "M": {
              "url": {
                "S": image.url
              },
              "width": {
                "N": image.width.toString()
              },
              "height": {
                "N": image.height.toString()
              }
            }
          };

          // deal with special cases
          switch (image.name) {
            case "full":
              imgJson.width.N = image.width.toString();
              imgJson.height.N = image.height.toString();
              break;
            case "w16":
              const placeholderFilename = `${image.filename}`;
              const placeholderData = await new Promise((resolve) => {
                  fs.readFile(placeholderFilename, { encoding: 'base64' }, resolve)
                })
                .then((err, data) => {
                  if (!err) {
                    return `data:image/png;base64,${data}`;
                  } else {
                    throw(err);
                  }
                });
              imgJson.placeholder.S = placeholderData;
              break;
          }
        }

        uploader.addUpload({
          func: uploadDynamoDBObject,
          args: [
            imgJson,
            configFile.remote.AWS.DynamoDB.images.table
          ],
          cb: () => {
            console.info(`Uploaded image metadata: ${imgJson.id.S}`);
          }
        });
      }

    }

    if (!args.skipcontent) {
      if (images.length > 0) {
        putData.thumbnail = {
          S: images[0]
        };
      } else {
        putData.thumbnail = {
          S: "logo_new.png"
        };
      }

      uploader.addUpload({
        func: uploadDynamoDBObject,
        args: [
          putData,
          configFile.remote.AWS.DynamoDB.posts.table
        ],
        cb: () => {
          console.info(`Check upload at:\n${configFile.remote.posts.stagingURL}/${putData.id.S}`);
        }
      });
    }

    await uploader.flush();
  }

})();

async function* processImage(imagePath, sizes) {

  const resolvedImagePath = `${configFile.local.images.sourceFolder}/${imagePath}`;

  if (!fs.existsSync(resolvedImagePath)) {
    throw new Error(`Image File not found: ${resolvedImagePath}`);
  }

  const ext = path.extname(imagePath);
  const basename = path.basename(imagePath, ext);

  for (const size of sizes) {

    const readStream = fs.createReadStream(`${resolvedImagePath}`, (err) => {
      if (err) {
        throw(err);
      }
    });
    let imageEditor = gm(readStream, readStream.path);

    // always remove EXIF data
    imageEditor = imageEditor.noProfile();

    // resize, if desired
    if (size.targetDimensions) {
      imageEditor = imageEditor.resize(...size.targetDimensions);
    }

    imageEditor = imageEditor.size({bufferStream: true}, (err, dimensions) => {
      if (!err) {
        size.width = dimensions.width;
        size.height = dimensions.height;
      } else {
        throw(err);
      }
    });

    size.id     = `${basename}${size.ext||ext}`;
    size.filename = `${configFile.local.images.processFolder}/${size.id}`;
    size.key      = `${configFile.remote.images.folder}/${size.id}`;
    size.url      = `${configFile.remote.static.URL}/${size.key}`;

    const writeStream = fs.createWriteStream(size.filename);

    imageEditor.stream(size.filename)
    .pipe(writeStream);

    await new Promise((resolve) => {
      writeStream.on("finish", resolve);
    });

    yield size;

  }
}

function uploadS3Image(image) {
  return new Promise((resolve, reject) => {
    s3.putObject({
      Bucket: configFile.remote.AWS.S3.bucket,
      Key: `${image.key}`,
      Body: fs.createReadStream(`${image.filename}`, (err) => {
        throw(`could not create image: ${err}`);
      })
    }, (err) => {
      if (err) {
        reject(`image upload to S3 failed: ${err}`);
      } else {
        resolve();
      }
    });
  });
}

function uploadDynamoDBObject(data, table) {
  return new Promise((resolve, reject) => {
    dynamoDB.putItem({
      TableName: table,
      Item: data
    }, (err) => {
      if (err) {
        reject(`Upload to DynamoDB failed: ${err}`);
      } else {
        resolve();
      }
    });
  });
}

async function proofread(content) {
  if (!dict) {
    let affbuf = await readFileAsync(configFile.local.dictionary.aff);
    let dictbuf = await readFileAsync(configFile.local.dictionary.dic);

    dict = new nodehun(affbuf,dictbuf);
  }

  let removeHtml = /\<[^\>]*\>/g;
  let removeTemplates = /\$\{[^\}]*\}/g;
  let removePunctuation = /[^A-Za-z']/g;
  let matchWords = /^[A-Za-z]+'*[A-Za-z]*$/;

  let content_wordsOnly = content.replace(removeHtml, " ");
  content_wordsOnly = content_wordsOnly.replace(removeTemplates, " ");
  content_wordsOnly = content_wordsOnly.replace(removePunctuation, " ");

  let contentWords = content_wordsOnly.split(/\s/);

  contentWords = contentWords.filter((word) => {
    return matchWords.test(word);
  })

  contentWords.forEach((word) => {
    dict.spellSuggestions(word, (err, correct, suggestions, origWord) => {
  	  if (err) {
  	    throw(err);
  	  }
  	  if (correct) {
  	    return;
  	  } else {
  	    console.warn(chalk`{magenta Proofing:} ${origWord} is not in the dictionary replace with:`);
  	    suggestions.forEach((suggestion, index) => {
  	      console.info(chalk`\t{magenta ${index}:}\t${suggestion}`);
  	    });
  	  }
    });
  });
}
