import axios from "axios";
import config from "config";
import { Request, Response } from "express";
import { NotificationBuilder } from "../../graphql/modules/notification/notificationBuilder";
import logger from "../../helpers/logger";
import { MainConnection, startSession } from "../../helpers/mongo";
import { InsertNotification, NotificationTarget } from "../../libs/dal/notification";
import {
  PaypalTransactionsModel,
  PaypalTransactionsStatusEnum,
} from "../../libs/dal/paypalTransactions";
import { walletService } from "../../libs/dal/wallet";
import { GetWalletInfo } from "../../libs/usecases/wallet";
import { WalletTransactionBuilder } from "../../libs/usecases/wallet/wallet-transaction.builder";
import { OrderCode } from "../../packages/order-code";
import { paypalEventEnum } from "../type";

// Function to verify PayPal webhook signature
async function verifyWebhookSignature(
  transmissionId: string,
  transmissionTime: string,
  certUrl: string,
  transmissionSig: string,
  webhookId: string,
  body: any
): Promise<boolean> {
  try {
    // Get PayPal access token
    const accessToken = await getAccessToken();
    const auth_algo = "SHA256withRSA";
    // Verify webhook signature using PayPal API
    const paypalAPI = config.get<string>("paypal.apiUrl");
    const response = await axios({
      url: `${paypalAPI}/v1/notifications/verify-webhook-signature`,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        auth_algo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: body,
      },
    });

    const isValid = response.data.verification_status === "SUCCESS";

    return isValid;
  } catch (error) {
    logger.error("Error verifying PayPal webhook signature", { error });
    return false;
  }
}

// Function to get PayPal access token
async function getAccessToken(): Promise<string> {
  const paypalAPI = config.get<string>("paypal.apiUrl");
  const clientId = config.get<string>("paypal.publicClientId");
  const clientSecret = config.get<string>("paypal.clientSecret");

  const tokenResponse = await axios.post(
    `${paypalAPI}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    }
  );
  return tokenResponse.data.access_token;
}

export default [
  {
    method: "post",
    path: "/api/paymentTracking/paypal",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        // Validate webhook payload
        if (!req.body || typeof req.body !== "object") {
          logger.error("Invalid PayPal webhook payload", { body: req.body });
          return res.status(400).json({ error: "Invalid webhook payload" });
        }

        // Check required security headers
        const transmissionId = req.headers["paypal-transmission-id"] as string;
        const transmissionTime = req.headers["paypal-transmission-time"] as string;
        const certUrl = req.headers["paypal-cert-url"] as string;
        const transmissionSig = req.headers["paypal-transmission-sig"] as string;

        const webhookId = config.get<string>("paypal.webhookId");

        if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig || !webhookId) {
          logger.error("Missing required PayPal webhook headers", { headers: req.headers });
          return res.status(400).json({ error: "Missing required security headers" });
        }

        // Verify webhook signature
        const isValid = await verifyWebhookSignature(
          transmissionId,
          transmissionTime,
          certUrl,
          transmissionSig,
          webhookId,
          req.body
        );

        if (!isValid) {
          logger.error("Invalid PayPal webhook signature", { headers: req.headers });
          return res.status(400).json({ error: "Invalid webhook signature" });
        }

        const eventType = req.body.event_type;
        const captureData = req.body.resource;

        if (!eventType) {
          logger.error("Missing event_type in PayPal webhook", { body: req.body });
          return res.status(400).json({ error: "Missing event_type" });
        }
        const webhookLog = {
          ...req.body,
          timestamp: new Date(),
          headers: req.headers,
        };
        await MainConnection.collection("paypal_webhook_logs").insertOne(webhookLog);

        // Handle different webhook events
        switch (eventType) {
          case paypalEventEnum.CHECKOUT_ORDER_APPROVED:
            const description = captureData.purchase_units[0].description;
            if (!captureData || !captureData.id || !description) {
              logger.error("Invalid CHECKOUT.ORDER.APPROVED payload", { captureData });
              return res.status(400).json({ error: "Invalid capture data" });
            }

            //Kiểm tra có phải order code của sàn hay không
            const orderCode = OrderCode.getOrderCodeFromText(description);
            const paypalTransactionProcessing = await PaypalTransactionsModel.findOne({
              code: orderCode,
              status: PaypalTransactionsStatusEnum.PROCESSING,
            });

            if (orderCode && paypalTransactionProcessing) {
              const session = await startSession();
              try {
                await session.withTransaction(async () => {
                  await PaypalTransactionsModel.findOneAndUpdate(
                    {
                      code: orderCode,
                      status: PaypalTransactionsStatusEnum.PROCESSING,
                    },
                    {
                      $set: {
                        status: PaypalTransactionsStatusEnum.CHECKOUT_ORDER_APPROVED,
                      },
                      $push: {
                        logs: [
                          {
                            status: PaypalTransactionsStatusEnum.CHECKOUT_ORDER_APPROVED,
                            createdAt: new Date(),
                            message: req.body.summary,
                            meta: { ...req.body, timestamp: new Date() },
                          },
                        ],
                      },
                    },
                    { session: session }
                  );
                });
              } catch (transactionError) {
                logger.error("Transaction error in PayPal webhook", {
                  error: transactionError,
                  orderCode,
                  paypalTransactionId: paypalTransactionProcessing._id,
                });
                throw transactionError;
              } finally {
                session.endSession();
              }

              return res.sendStatus(200);
            }
            break;

          case paypalEventEnum.PAYMENT_CAPTURE_COMPLETED:
            if (!captureData || !captureData.id) {
              logger.error("Invalid PAYMENT_CAPTURE_COMPLETED payload", { captureData });
              return res.status(400).json({ error: "Invalid capture data" });
            }
            if (captureData.status !== "COMPLETED") {
              logger.error("PayPal capture status is not COMPLETED", {
                status: captureData.status,
                paymentId: captureData.id,
              });
              return res.status(400).json({
                error: "Payment capture failed",
                status: captureData.status,
              });
            }

            //Kiểm tra có phải order code của sàn hay không
            const orderId = captureData.supplementary_data.related_ids.order_id;
            const paypalTransactionCheckoutOrderApproved = await PaypalTransactionsModel.findOne({
              orderId,
            });
            if (paypalTransactionCheckoutOrderApproved.paymentId) {
              return res.status(400).json({
                error: "Payment exist",
                status: captureData.status,
              });
            }

            if (paypalTransactionCheckoutOrderApproved) {
              const wallet = await GetWalletInfo.usecase.execute({
                ownerId: paypalTransactionCheckoutOrderApproved.customerId,
              });
              if (!wallet) {
                logger.error("Webhook wallet not found", {
                  paypalTransactionId: paypalTransactionCheckoutOrderApproved._id,
                  payPalOrderId: captureData.id,
                });
                return res.sendStatus(200);
              }

              const session = await startSession();
              try {
                await session.withTransaction(async () => {
                  await walletService.createTransaction({
                    transaction: new WalletTransactionBuilder(wallet)
                      .depositWithPaypal({
                        amount: paypalTransactionCheckoutOrderApproved.amount,
                        paypalOrderId: paypalTransactionCheckoutOrderApproved.orderId,
                        paypalTransactionId: paypalTransactionCheckoutOrderApproved._id,
                        description: "Add money to your wallet via PayPal.",
                      })
                      .build(),
                    session: session,
                  });

                  await PaypalTransactionsModel.findOneAndUpdate(
                    {
                      orderId,
                    },
                    {
                      $set: {
                        status: PaypalTransactionsStatusEnum.PAYMENT_CAPTURE_COMPLETED,
                        paymentId: captureData.id,
                      },
                      $push: {
                        logs: [
                          {
                            status: PaypalTransactionsStatusEnum.PAYMENT_CAPTURE_COMPLETED,
                            createdAt: new Date(),
                            message: req.body.summary,
                            meta: { ...req.body, timestamp: new Date() },
                          },
                        ],
                      },
                    },
                    { session: session }
                  );

                  const customerNotify = new NotificationBuilder(
                    "Add money to your wallet via PayPal.",
                    `You have successfully added ${paypalTransactionCheckoutOrderApproved.amount} USD to your wallet.`
                  )
                    .sendTo(
                      NotificationTarget.CUSTOMER,
                      paypalTransactionCheckoutOrderApproved.customerId
                    )
                    .wallet(wallet._id)
                    .build();

                  InsertNotification([customerNotify]);
                });
              } catch (transactionError) {
                logger.error("Transaction error in PayPal webhook", {
                  error: transactionError,
                  orderCode,
                  paypalTransactionId: paypalTransactionCheckoutOrderApproved._id,
                });
                throw transactionError;
              } finally {
                session.endSession();
              }

              return res.sendStatus(200);
            }

            break;

          default:
            // Log webhook data for debugging
            break;
        }

        res.sendStatus(200);
      } catch (error) {
        logger.error("Error processing PayPal webhook", {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : error,
          body: req.body,
          headers: req.headers,
        });
        res.status(500).json({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  },
];
