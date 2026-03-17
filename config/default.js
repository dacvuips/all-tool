const dotenv = require('dotenv');

switch (process.env.NODE_ENV) {
  case 'test':
    dotenv.config({ path: '.env.test' });
    break;
  default: 
    dotenv.config();
}

module.exports = {
  "tz": "Asia/Ho_Chi_Minh",
  "secret": "my-secret",
  "domain": process.env.DOMAIN||"http://localhost:5555",
  "port":process.env.PORT|| 5555,
  "firebase": {
    "credential": {},
    "webConfig": {}
  },
  redis: {
    host: "127.0.0.1",
    port: 6379,
    password: undefined,
    prefix: undefined,
    backend: "single", // single, cluster, sentinel
    nodes: "",
    sentinel: {
      master: "mymaster",
      username: undefined,
      password: undefined,
    },
  },
  "next": {
    "enable": true,
    "devMode": false
  },
  "job": {
    "isWorker": true,
    "defines": "ALL",
    "skips": "NONE"
  },
  "mongo": {
    "main": "mongodb://db:27017/dev",
  },
  "format": {
    "date": "YYYY-MM-DD",
    "datetime": "YYYY-MM-DD HH:mm:ss",
  },
  "minio": {
    "endpoint": null,
    "port": 443,
    "bucket": "data",
    "accessKey": null,
    "secretKey": null,
  },
  "logger": {
    "debug": false,
  },
  "store": {
    "encryptionKey": null
  },
  "casso": {
    "secret": null,
    "apiKey": null,
  },
  "helmet": {
    "enable": true,
  },
  "sendgrid": {
    "apiKey": null,
  },
  "email": {
    "from": "midmanvn@gmail.com",
    "footer": "Midman Team",
  },
  "partnerFee": [
    { from: 0, unit: "fixed", value: 0 },
    { from: 500000, unit: "fixed", value: 20000 },
    { from: 600000, unit: "fixed", value: 50000 }

  ],
  "exchangeFee": [
    { from: 0, unit: "fixed", value: 0 },
    { from: 500000, unit: "fixed",  value: 10000 }
  ],
  "security": {
    "auth": {
      useSession: false,
    }
  },
  "paypal": {
    "webhookId": null,
    "publicClientId":null,
    "clientSecret":null,
    "apiUrl": process.env.NODE_ENV === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  },
  // Cấu hình SePay Payment Gateway (cổng thanh toán)
  "sepayPG": {
    "merchantId": null,      // Merchant ID từ my.sepay.vn
    "secretKey": null,       // Secret Key dùng để gọi API SePay PG (SDK)
    "ipnSecretKey": null,    // Secret Key riêng cho IPN webhook (Cổng thanh toán → Cấu hình → IPN)
    "sandboxMode": true,     // true = Sandbox, false = Production
  },
  "upload": {
    "uploadImageApiLink": null,
  },
  
}
