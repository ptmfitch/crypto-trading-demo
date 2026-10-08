import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";

export default getRequestConfig(async () => {
  return {
    locale: "en",
    messages: en,
    timeZone: "UTC",
  };
});
