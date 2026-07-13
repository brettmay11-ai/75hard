import webPush from "web-push";

const { publicKey, privateKey } = webPush.generateVAPIDKeys();

console.log(JSON.stringify({ publicKey, privateKey }, null, 2));
