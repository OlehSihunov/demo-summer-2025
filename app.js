const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });
const s3 = new AWS.S3({ region: 'eu-central-1' });

const BUCKET_NAME = 'my-test-bucket-for-galery-26-06';

app.use(express.static('public'));
app.use(express.json());

/**
 * Upload endpoint
 */
app.post('/upload', upload.single('photo'), async (req, res) => {
  const file = req.file;
  const fileStream = fs.createReadStream(file.path);
  const s3Key = `uploads/${file.originalname}`;

  try {
    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: file.mimetype,
    }).promise();
    fs.unlinkSync(file.path); // Clean temp file
    res.redirect('/');
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Upload failed');
  }
});

/**
 * Gallery endpoint
 */
app.get('/gallery', async (req, res) => {
  try {
    const thumbs = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: 'thumbnails/',
    }).promise();

    const items = await Promise.all(thumbs.Contents.map(async (obj) => {
      const filename = path.basename(obj.Key, path.extname(obj.Key));
      const thumbUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${obj.Key}`;

      console.log("thumb url:" + filename)
      // 2. Try to find json JSON with metadata
      let labels = [];
      try {
        const metaObj = await s3.getObject({
          Bucket: BUCKET_NAME,
          Key: `metadata/${filename}.json`
        }).promise();
        console.log("Metadata: "+ metaObj)
        const meta = JSON.parse(metaObj.Body.toString('utf-8'));
        labels = meta.Labels?.map(l => l.Name) || [];
      } catch (e) {
        console.log("not meta  for file "+ filename)
      }

      return { thumbnailUrl: thumbUrl, labels };
    }));

    res.json(items);
  } catch (err) {
    console.error('Gallery error:', err);
    res.status(500).send('Gallery failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`📡 Server started on http://localhost:${PORT}`);
});
