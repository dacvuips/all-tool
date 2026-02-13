const { FarmerRewardModel } = require('../../dist/graphql/modules/farmer/farmerReward/farmerReward.model');
const axios = require('axios');
const _ = require('lodash');

async function main() {
  const rewards = await FarmerRewardModel.find({ receiveImagePath: { $exists: true }, receiveImageCapture: { $exists: false } })
    .select('_id receiveImagePath').lean().exec();

  console.log('non captured rewards', rewards.length);

  for (const reward of rewards) {
    const url = `https://s3.lt.mcom.app/loctroi-farmer-prod/${reward.receiveImagePath}`;
    console.log('convert url to base64....', url);
    const base64 = await _urlToBase64(url);
    console.log('convert base64 to capture....');
    const capture = await _base64ToCapture(base64);

    await FarmerRewardModel.updateOne({ _id: reward._id }, { $set: { receiveImageCapture: capture } }).exec();
    console.log('captured', {
      rewardId: reward._id,
      url: url,
      capture: capture
    });
  }
  console.log('done');
  process.exit();
}

main();

async function _urlToBase64(url) {
  return axios
    .get(url, {
      responseType: 'arraybuffer'
    })
    .then(response => Buffer.from(response.data, 'binary').toString('base64'))
}

async function _base64ToCapture(base64) {
  const api = 'https://clarifai.com/_api/v2/users/salesforce/apps/blip/models/general-english-image-caption-blip/versions/0a62e100eb4f481ebd37cbcc16a3be0e/outputs';
  const headers = { 'x-clarifai-session-token': 'icguz1o5m3yyve2ne76cz9vux9aq2b', 'Content-Type': 'text/plain' }
  const body = { "inputs": [ { "data": { "image": { "base64": base64 } } } ] };
  return axios
    .post(api, JSON.stringify(body), { headers })
    .then(response => _.get(response, 'data.outputs[0].data.text.raw'))
}