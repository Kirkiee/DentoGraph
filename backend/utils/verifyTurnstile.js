const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "";
};

const verifyTurnstileToken = async ({ token, remoteIp }) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY is missing.");
    return {
      success: false,
      error: "CAPTCHA configuration is missing.",
    };
  }

  if (!token) {
    return {
      success: false,
      error: "Please complete the CAPTCHA verification.",
    };
  }

  try {
    const formData = new URLSearchParams();

    formData.append("secret", secretKey);
    formData.append("response", token);

    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      console.error("Turnstile verification failed:", result["error-codes"]);

      return {
        success: false,
        error: "CAPTCHA verification failed. Please try again.",
        details: result["error-codes"] || [],
      };
    }

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("Turnstile verification error:", error);

    return {
      success: false,
      error: "Unable to verify CAPTCHA at the moment. Please try again.",
    };
  }
};

const verifyTurnstileMiddleware = async (req, res, next) => {
  const { turnstileToken } = req.body || {};

  const verification = await verifyTurnstileToken({
    token: turnstileToken,
    remoteIp: getClientIp(req),
  });

  if (!verification.success) {
    return res.status(400).json({
      error: verification.error,
      captcha_required: true,
    });
  }

  return next();
};

module.exports = {
  verifyTurnstileToken,
  verifyTurnstileMiddleware,
};
