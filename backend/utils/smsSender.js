const axios = require("axios");

const normalizePhilippineNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits)) {
    return digits;
  }

  if (/^639\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  return null;
};

const sendContactVerificationCode = async ({ number, code }) => {
  const normalizedNumber = normalizePhilippineNumber(number);

  if (!normalizedNumber) {
    throw new Error("A valid Philippine mobile number is required.");
  }

  const apiKey = process.env.SEMAPHORE_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "SMS verification is not configured. Set SEMAPHORE_API_KEY.",
    );
    error.code = "SMS_NOT_CONFIGURED";
    throw error;
  }

  const payload = new URLSearchParams({
    apikey: apiKey,
    number: normalizedNumber,
    message:
      "Your DentoGraph contact verification code is {otp}. " +
      "It expires in 10 minutes.",
    code,
  });

  if (process.env.SEMAPHORE_SENDER_NAME) {
    payload.append("sendername", process.env.SEMAPHORE_SENDER_NAME);
  }

  const response = await axios.post(
    "https://api.semaphore.co/api/v4/otp",
    payload.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 15000,
    },
  );

  return response.data;
};

module.exports = {
  normalizePhilippineNumber,
  sendContactVerificationCode,
};