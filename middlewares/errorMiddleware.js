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
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
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
  });
};
