const express = require("express");
const Route = express.Router();

const media = require("../controllers/media");
const { upload } = require("../middleware/upload");

Route.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 20 },
  ]),
  media.upload_media
);

module.exports = Route;
