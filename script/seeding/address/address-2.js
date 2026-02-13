const { AddressModel } = require('../../../dist/graphql/modules/address/address.model');
let addressAr = [];
const { Workbook } = require('exceljs');
const fs = require('fs');

async function run() {

  const stream = fs.createReadStream('script/address.xlsx');
  const workbook = new Workbook();
  const streamWorkBook = await workbook.xlsx.read(stream);
  const worksheet = streamWorkBook.getWorksheet("Sheet1");
  const rows = worksheet.getSheetValues();

  let data = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    let province = data.find(p => p.pid === row[5]);
    if (!province) {
      province = {
        pid: row[5],
        pn: row[6],
        ds: []
      }
      data.push(province);
    }
    let district = province.ds.find(d => d.did === row[3]);
    if (!district) {
      district = {
        did: row[3],
        dn: row[4],
        ws: []
      }
      province.ds.push(district);
    }
    let ward = district.ws.find(w => w.wid === row[1]);
    if (!ward) {
      ward = {
        wid: row[1],
        wn: row[2],
      }
      district.ws.push(ward);
    }
  }

  await AddressModel.findOne({});
  const bulkInsert = AddressModel.collection.initializeUnorderedBulkOp();

  for (let province of data) {
    bulkInsert.insert({
      province: province.pn,
      provinceId: province.pid
    })
    console.log(province.pn)
    for (let district of province.ds) {
      bulkInsert.insert({
        province: province.pn,
        provinceId: province.pid,
        district: district.dn,
        districtId: district.did,
      });
      console.log(district.dn)
      for (let ward of district.ws) {
        bulkInsert.insert({
          province: province.pn,
          provinceId: province.pid,
          district: district.dn,
          districtId: district.did,
          ward: ward.wn,
          wardId: ward.wid,
        });
        console.log(ward.wn)
      }
    }
  }
  console.log('insterting', addressAr.length)
  if (bulkInsert.length > 0) {
    const result = await bulkInsert.execute();
    console.log('bulk result', result);
  }
}
run();
