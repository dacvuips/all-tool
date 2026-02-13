import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // simulate ramp-up of traffic from 1 to 100 users over 5 minutes.
  ],
  thresholds: {
    'http_req_duration': ['p(99)<1500'], // 99% of requests must complete below 1.5s
  },
};


export default function () {
  const local = "http://localhost:5555/graphql";
  const dev = "https://loctroi-farmer.mcom.app/graphql";
  const prod = "https://cndnkbv.app.loctroi.vn/graphql";
  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkJhbyIsInJvbGUiOiJGQVJNRVIiLCJfaWQiOiI2MmY4NjY5MjY2ZWJlYzAwNWM0ZGVjYmYiLCJpYXQiOjE2NjA1NTkxNDMsImV4cCI6MTY2MzE1MTE0M30.28tDQnUqgllSQV7JBhLNAEe5ja7J5mBqY-vQogzHppY`;
  const body = JSON.stringify({
    query: `query {
      farmerGetMe {
          id name phone
          agencyLevel1 { id code name place { fullAddress } }
          agencyLevel2 { id code name place { fullAddress } }
          farmingInfos {
            id plantId area
            plant { id name }
          }
          farmingPlace { province district ward fullAddress }
          manager3c { id name place { province } }
      }
  }`,
    variables: { }
  })
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-token': token,
    }
  }
  http.post(local, body, params);
}