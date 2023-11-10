const crypto = require("node:crypto");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqsClient = new SQSClient();

const publicKey = crypto.createPublicKey(
  process.env.PUBLIC_KEY.replace(/\\n/g, "\n")
);

const verifySignature = (event) => {
  const signatureHeader = event.headers["x-signature"];

  if (!signatureHeader) {
    return false;
  }

  const signatureHeaderComponents = signatureHeader.split("|");
  const timestampComponent = signatureHeaderComponents.find((component) =>
    component.startsWith("t=")
  );

  if (!timestampComponent) {
    return false;
  }

  // Timestamp string
  const timestamp = +timestampComponent.split("=")[1];

  // If timestamp string is older than 5 seconds, reject
  if (Date.now() - timestamp > 5 * 1000) {
    return false;
  }

  const validationPayload = `${timestamp}.${event.body}`;
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(validationPayload);
  verify.end();

  const signatureComponents = signatureHeaderComponents.filter((component) =>
    component.startsWith("v=1,alg=rsa,sig=")
  );

  if (!signatureComponents.length) {
    return false;
  }

  let hasValidSignature = false;

  for (const signatureComponent of signatureComponents) {
    const signature = signatureComponent.replace("v=1,alg=rsa,sig=", "");

    if (!hasValidSignature) {
      hasValidSignature = verify.verify(publicKey, signature, "hex");
    }
  }

  return hasValidSignature;
};

exports.handler = async (event) => {
  const isVerified = verifySignature(event);

  if (!isVerified) {
    return {
      statusCode: 401,
    };
  }

  // Push to queue
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: event.body,
    })
  );

  return {
    statusCode: 200,
  };
};
