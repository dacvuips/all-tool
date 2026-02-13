export interface WebhookEvent {
  id: string;
  event_type: string;
  create_time: string;
  resource_type: string;
  resource: any;
  event_version: string;
  summary: string;
}

export interface PayPalCapture {
  id: string;
  status: string;
  amount: {
    value: string;
    currency_code: string;
  };
  payer: {
    email_address: string;
    payer_id: string;
    name: {
      given_name: string;
      surname: string;
    };
  };
  purchase_units: Array<{
    amount: {
      value: string;
      currency_code: string;
    };
  }>;
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units: Array<{
    amount: {
      value: string;
      currency_code: string;
    };
  }>;
}

export interface PayPalTransaction {
  orderId: string;
  status: string;
  amount: string;
  currency: string;
  payerEmail: string;
  payerId: string;
  timestamp: Date;
  captureData: PayPalCapture;
  eventType: string;
}

export interface PayPalOrderRecord {
  orderId: string;
  status: string;
  amount: string;
  currency: string;
  timestamp: Date;
  orderData: PayPalOrder;
  eventType: string;
}
