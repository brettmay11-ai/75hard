const baseUrl = process.env.PUSH_APP_URL;
const token = process.env.PUSH_ADMIN_TOKEN;

if (!baseUrl || !token) {
  throw new Error("PUSH_APP_URL and PUSH_ADMIN_TOKEN are required");
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/push/schedule`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
});

if (!response.ok) throw new Error(await response.text());
console.log(await response.text());
