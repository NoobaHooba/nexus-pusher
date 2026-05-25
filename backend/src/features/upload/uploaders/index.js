const mavenUploader = require('./maven');
const npmUploader = require('./npm');
const nugetUploader = require('./nuget');
const pypiUploader = require('./pypi');
const dockerUploader = require('./docker');
const yumUploader = require('./yum');
const aptUploader = require('./apt');
const helmUploader = require('./helm');
const rawUploader = require('./raw');

const uploaderMap = {
  maven: mavenUploader,
  npm: npmUploader,
  nuget: nugetUploader,
  pypi: pypiUploader,
  docker: dockerUploader,
  yum: yumUploader,
  apt: aptUploader,
  helm: helmUploader,
  swift: rawUploader,
  terraform: rawUploader,
  raw: rawUploader,
};

function getUploader(type) {
  return uploaderMap[type] || null;
}

function isSupportedUploadType(type) {
  return Boolean(getUploader(type));
}

module.exports = {
  getUploader,
  isSupportedUploadType,
  uploaderMap,
};
