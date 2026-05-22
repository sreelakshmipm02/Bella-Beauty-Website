import AppError from "../utils/AppError.js";

const wantsJsonResponse = (req) => {
  const acceptHeader = req.headers.accept || "";
  const contentType = req.headers["content-type"] || "";

  return (
    req.xhr ||
    req.headers["x-requested-with"] === "XMLHttpRequest" ||
    contentType.includes("application/json") ||
    (!acceptHeader.includes("text/html") &&
      acceptHeader.includes("application/json"))
  );
};

export const notFound = (req, res, next) => {
  next(new AppError("We couldn't find the page you were looking for.", 404));
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;

  if (err.name === "CastError") {
    statusCode = 404;
  }

  const defaultMessages = {
    400: "That request could not be processed. Please check the details and try again.",
    401: "Please log in to continue.",
    403: "You do not have permission to access this page.",
    404: "We couldn't find the page you were looking for.",
    409: "Something changed while you were shopping. Please review the latest details and try again.",
    422: "Please fix the highlighted details and try again.",
    500: "Something went wrong on our side. Please try again in a moment.",
  };

  const rawMessage =
    err.name === "CastError"
      ? defaultMessages[404]
      : err.message || defaultMessages[500];
  const message =
    statusCode >= 500 && process.env.NODE_ENV !== "development"
      ? defaultMessages[500]
      : rawMessage;
  const errorList =
    typeof message === "string" && message.includes("|")
      ? message.split("|")
      : undefined;

  if (statusCode >= 500) {
    console.error("Global Error:", err);
  }

  if (wantsJsonResponse(req)) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: errorList,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }

  return res.status(statusCode).render("error", {
    title: `${statusCode} Error`,
    message,
    statusCode,
    errorList,
  });
};
