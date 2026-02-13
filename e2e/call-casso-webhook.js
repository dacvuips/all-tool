const axios = require("axios");
const config = require('config');

async function main() {
  await axios.post("http://localhost:5555/api/paymentTracking/casso", {
    error: 0,
    data: [
      {
        id: 0,
        tid: "MA_GIAO_DICH_THU_NGHIEM",
        description: "ODI1A5B6U4PD",
        amount: 100000,
        cusum_balance: 25000000,
        when: "2023-02-13 22:47:45",
        bank_sub_acc_id: "88888888",
        subAccId: "88888888",
        bankName: "VPBank",
        bankAbbreviation: "VPB",
        virtualAccount: "",
        virtualAccountName: "",
        corresponsiveName: "NGUYEN VAN A",
        corresponsiveAccount: "8888888888",
        corresponsiveBankId: 970415,
        corresponsiveBankName: "VietinBank",
      },
    ],
  }, {
    headers: {
      "secure-token": config.get('casso.secret')
    }
  });

  console.log("Done");
  process.exit(0);
}

main();
