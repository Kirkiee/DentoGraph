import { API_BASE_URL } from "../config/api";

export const loginUser = async ({ email, password }) => {
  const loginUrl = `${API_BASE_URL}/users/login`;

  console.log("LOGIN URL:", loginUrl);

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const text = await response.text();

  console.log("STATUS:", response.status);
  console.log("RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Server returned non-JSON response. URL used: ${loginUrl}`);
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Login failed");
  }

  return data;
};