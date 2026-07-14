import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();
console.log(JSON.stringify(keys, null, 2));
