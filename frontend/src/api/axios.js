import axios from "axios";

const API = axios.create({
  baseURL: "https://api.dentograph.site",
});

export default API;