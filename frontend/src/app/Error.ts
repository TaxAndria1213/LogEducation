/* eslint-disable @typescript-eslint/no-explicit-any */
import Notification from "./layouts/Notification";

// Example translations object, replace with your actual translations or import from the correct file
const translations: { [key: string]: string } = {
  "Unauthorized": "You are not authorized.",
  // Add more key-value pairs as needed
};

class ErrorHandler {
  static handle(error: any) {
    const message = error.response?.data?.status?.message;
    const translatedMessage = translations[message] || message;

    switch (error.response?.status) {
      case 401:
        if (!["login"].some((r) => window.location.href.includes(r))) {
          localStorage.clear();
          window.location.href = "/login";
        }
        new Notification(translatedMessage, 0);
        break;
      default:
        new Notification(translatedMessage, 0);
        break;
    }
  }
}

export default ErrorHandler;
