import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // simulate ramp-up of traffic from 1 to 100 users over 5 minutes.
  ],
  thresholds: {
    'http_req_duration': ['p(99)<1500'], // 99% of requests must complete below 1.5s
    'login success': ['p(99)<1500'], // 99% of requests must complete below 1.5s
  },
};


export default function () {
  const dev = "https://loctroi-farmer.mcom.app/graphql";
  const prod = "https://cndnkbv.app.loctroi.vn/graphql";
  const phone = '0916968263';
  const pin = '123123';
  const body = JSON.stringify({
    query: `mutation($phone: String!, $pin: String!) {
      loginFarmerByPin(
        phone: $phone,
        pin: $pin
      ) {
        farmer { id name }
        token
      }
    }`,
    variables: {
      phone: phone,
      pin: pin
    }
  })
  const params = {
    headers: {
      'Content-Type': 'application/json',
    }
  }
  const res = http.post(dev, body, params);

  check(res, {
    'login success': (r) => r.status == 200,
  })
}