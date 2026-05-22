(function () {
  let generatedErrorId = 0;
  const errorClassNames = [
    "border-red-500",
    "focus:border-red-500",
    "focus:ring-red-200",
  ];
  const successClassNames = ["border-green-500"];

  const resolveElement = (field) => {
    if (!field) return null;
    if (typeof field === "string") return document.querySelector(field);
    return field;
  };

  const getErrorElement = (field, explicitErrorId) => {
    const element = resolveElement(field);
    if (!element) return null;

    if (!element.id && !element.name && !element.dataset.generatedErrorId) {
      generatedErrorId += 1;
      element.dataset.generatedErrorId = `generatedField${generatedErrorId}`;
    }

    const errorId =
      explicitErrorId ||
      element.dataset.errorTarget ||
      `${element.id || element.name || element.dataset.generatedErrorId}Error`;

    let errorElement = document.getElementById(errorId);

    if (!errorElement) {
      errorElement = document.createElement("p");
      errorElement.id = errorId;
      errorElement.className = "field-error text-red-500 text-xs mt-1 min-h-[18px]";
      element.insertAdjacentElement("afterend", errorElement);
    }

    return errorElement;
  };

  const setFieldError = (field, message, explicitErrorId) => {
    const element = resolveElement(field);
    if (!element) return false;

    const errorElement = getErrorElement(element, explicitErrorId);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("hidden");
    }

    element.classList.add(...errorClassNames);
    element.classList.remove(...successClassNames);
    element.setAttribute("aria-invalid", "true");

    if (errorElement?.id) {
      element.setAttribute("aria-describedby", errorElement.id);
    }

    return false;
  };

  const clearFieldError = (field, explicitErrorId, markSuccess = false) => {
    const element = resolveElement(field);
    if (!element) return true;

    const errorElement = getErrorElement(element, explicitErrorId);
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.classList.add("hidden");
    }

    element.classList.remove(...errorClassNames);
    element.removeAttribute("aria-invalid");

    if (markSuccess) {
      element.classList.add(...successClassNames);
    } else {
      element.classList.remove(...successClassNames);
    }

    return true;
  };

  const validateField = (field, validator, options = {}) => {
    const element = resolveElement(field);
    if (!element || typeof validator !== "function") return true;

    const message = validator(element.value, element);
    if (message) {
      return setFieldError(element, message, options.errorId);
    }

    return clearFieldError(element, options.errorId, options.markSuccess);
  };

  const wireFieldValidation = (field, validator, options = {}) => {
    const element = resolveElement(field);
    if (!element) return;

    const events = options.events || ["input", "blur", "change"];
    events.forEach((eventName) => {
      element.addEventListener(eventName, () =>
        validateField(element, validator, options),
      );
    });
  };

  const validateFields = (fields) => {
    let firstInvalid = null;
    let valid = true;

    fields.forEach(({ field, validator, options = {} }) => {
      const element = resolveElement(field);
      const isValid = validateField(element, validator, options);

      if (!isValid) {
        valid = false;
        if (!firstInvalid) firstInvalid = element;
      }
    });

    if (firstInvalid?.focus) firstInvalid.focus();
    return valid;
  };

  const showActionError = (title, message, icon = "error") => {
    if (window.Swal) {
      return Swal.fire({
        icon,
        title,
        text: message,
        confirmButtonColor: "#e83e8c",
      });
    }

    alert(message);
    return null;
  };

  const redirectWithReasonPopup = async (payload) => {
    if (!payload?.redirect) return false;

    if (!window.Swal || !payload.message) {
      window.location.replace(payload.redirect);
      return true;
    }

    try {
      window.sessionStorage?.setItem("skipLoginReasonPopup", "1");
    } catch (error) {
      console.error("Unable to cache login popup state:", error);
    }

    await Swal.fire({
      icon: "warning",
      title: "Account Suspended",
      text: payload.message,
      confirmButtonColor: "#e83e8c",
      allowOutsideClick: false,
    });

    window.location.replace(payload.redirect);
    return true;
  };

  if (
    typeof window !== "undefined" &&
    window.fetch &&
    !window.__bellaFetchWrapped
  ) {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      try {
        const contentType = response.headers.get("content-type") || "";

        if (
          response.status === 401 &&
          contentType.includes("application/json")
        ) {
          const payload = await response.clone().json();

          if (await redirectWithReasonPopup(payload)) {
            return new Promise(() => {});
          }
        }
      } catch (error) {
        console.error("Bella fetch redirect handler error:", error);
      }

      return response;
    };

    window.__bellaFetchWrapped = true;
  }

  window.BellaForms = {
    setFieldError,
    clearFieldError,
    validateField,
    validateFields,
    wireFieldValidation,
    showActionError,
  };
})();
