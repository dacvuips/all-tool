import http from 'k6/http';

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // simulate ramp-up of traffic from 1 to 100 users over 5 minutes.
  ],
  thresholds: {
    'http_req_duration': ['p(99)<1500'], // 99% of requests must complete below 1.5s
  },
};


export default function () {
  const qrCode  = "HTTP://QR.LOCTROI.VN?REF=STORY.P_36FC2704D88445A";
  const dev = "https://loctroi-farmer.mcom.app/graphql";
  const prod = "https://cndnkbv.app.loctroi.vn/graphql";
  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkJhbyIsInJvbGUiOiJGQVJNRVIiLCJfaWQiOiI2MmY4NjY5MjY2ZWJlYzAwNWM0ZGVjYmYiLCJpYXQiOjE2NjA1NTkxNDMsImV4cCI6MTY2MzE1MTE0M30.28tDQnUqgllSQV7JBhLNAEe5ja7J5mBqY-vQogzHppY`;
  const body = JSON.stringify({
    query: `mutation {
        scanQR(qr: "${qrCode}") {
            id 
            campaign { id name } 
            farmer { id name phone }
            code scanIndex productCode 
            sales cumulativeSales
            prizes { prizeUsed prizeCode prizeName prizeImage prizeDesc prizeType scanIndex rule cumulativeSales meta }
            refPrize { prizeUsed prizeCode prizeName prizeImage prizeDesc prizeType scanIndex rule cumulativeSales meta }
        }
    }`
  })
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-token': token
    }
  }
  http.post(dev, body, params);
}