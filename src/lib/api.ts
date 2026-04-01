import axios from "axios";



const API = axios.create({
  baseURL: "https://dagidev-teleexamai.hf.space",
});



API.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token"); 

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {

      const detail = error.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => (typeof d?.msg === "string" ? d.msg : "")).join(" ")
            : "";

      
      const looksLikeAuthFailure =
        /could not validate credentials|not authenticated|invalid token|token|signature/i.test(msg);

     
      if (looksLikeAuthFailure) {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }

      localStorage.removeItem("admin_token"); 
      window.location.href = "/login";

    }

    return Promise.reject(error);
  }
);

export default API;
