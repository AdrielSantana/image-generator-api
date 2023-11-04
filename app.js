require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb' }));

const port = process.env.PORT || 3001;
const credentials = require("./google-cloud-config.json");
const { GoogleAuth } = require('google-auth-library');
const { Storage } = require('@google-cloud/storage');
const stream = require('stream');


app.post("/text-to-image", async (req, res) => {
  const { prompt, negativePrompt, CFG, steps } = req.body;
  const fileName = prompt.replace(/[^a-zA-Z0-9]/g, "_").slice(0, prompt.length < 20 ? prompt.length : 20) + '.jpg';
  console.log('Text to image', fileName, negativePrompt, CFG, steps)
  const secret = req.headers.authorization?.split(" ")[1];

  if (secret !== process.env.SECRET) {
    console.log('Invalid token')
    return res.json({ error: "Invalid token" });
  }
  console.log('Valid token')

  try {
    console.log('Try')
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const storage = new Storage({
      credentials
    });
    console.log('Auth')

    const token = await auth.getAccessToken();

    console.log('response')
    const response = await fetch(process.env.TEXT_TO_IMAGE_ENDPOINT_URL ?? "", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt,
            negative_prompt: negativePrompt,
            guindance_scale: CFG,
            num_inference_steps: steps,
            seed: -1,
            noise_level: 100
          },
        ],
      }),
    });


    const data = await response.json();

    console.log('Data fetched')

    if (data?.predictions[0]) {
      console.log('Found image')
      const image64 = data.predictions[0];
      const bufferStream = new stream.PassThrough();
      bufferStream.end(Buffer.from(image64, 'base64'));

      const bucket = storage.bucket(process.env.BUCKET_NAME ?? "");
      const file = bucket.file('text-to-image/' + fileName);
      bufferStream.pipe(file.createWriteStream({
        metadata: {
          contentType: 'image/jpeg',
        },
      }))
        .on('error', function (err) {
          console.log('Error uploading image', err)
        })
        .on('finish', function () {
          console.log('Finished uploading image')
          wss.broadcast({ image64 })
        });
    }

    return res.sendStatus(200)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
  }
})

app.post("/image-to-image", async (req, res) => {
  const { prompt, negativePrompt, image, strength, CFG, steps } =
    await req.body;
  const fileName = prompt.replace(/[^a-zA-Z0-9]/g, "_").slice(0, prompt.length < 20 ? prompt.length : 20) + '.jpg';
  console.log('Text to image', fileName, negativePrompt, CFG, steps)
  const secret = req.headers.authorization?.split(" ")[1];

  if (secret !== process.env.SECRET) {
    console.log('Invalid token')
    return res.json({ error: "Invalid token" });
  }
  console.log('Valid token')

  try {
    console.log('Try')
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const storage = new Storage({
      credentials
    });
    console.log('Auth')

    const token = await auth.getAccessToken();

    console.log('response')
    const response = await fetch(process.env.IMAGE_TO_IMAGE_ENDPOINT_URL ?? "", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt,
            image,
            negative_prompt: negativePrompt,
            guindance_scale: CFG,
            num_inference_steps: steps,
            strength: strength / 100,
            seed: -1,
            noise_level: 100
          },
        ],
      }),
    });

    const data = await response.json();

    console.log('Data fetched')

    if (data?.predictions[0]) {
      console.log('Found image')
      const image64 = data.predictions[0];
      const bufferStream = new stream.PassThrough();
      bufferStream.end(Buffer.from(image64, 'base64'));

      const bucket = storage.bucket(process.env.BUCKET_NAME ?? "");
      const file = bucket.file('image-to-image/' + fileName);
      bufferStream.pipe(file.createWriteStream({
        metadata: {
          contentType: 'image/jpeg',
        },
      }))
        .on('error', function (err) {
          console.log('Error uploading image', err)
        })
        .on('finish', function () {
          console.log('Finished uploading image')
          wss.broadcast({ image64 })
        });
    }

    return res.sendStatus(200)
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
  }
})

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 5 * 60 * 1000;
server.headersTimeout = 5 * 60 * 1000;

const appWs = require('./app-ws');
const wss = appWs(server)

