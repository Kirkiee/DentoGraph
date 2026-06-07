import axios from "axios";

const API = axios.create({
  baseURL: "https://dentograph.site/api",
});

export default API;