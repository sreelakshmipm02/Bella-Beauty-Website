function validateAddressFields({
  fullName,
  phone,
  addressLine1,
  city,
  state,
  postalCode,
}) {
  if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) {
    return {
      isValid: false,
      field: !fullName
        ? "fullName"
        : !phone
          ? "phone"
          : !addressLine1
            ? "addressLine1"
            : !city
              ? "city"
              : !state
                ? "state"
                : "postalCode",
      title: "Missing Fields",
      message: "This field is required.",
      icon: "warning",
    };
  }

  if (!/^[a-zA-Z\s]{2,50}$/.test(fullName)) {
    return {
      isValid: false,
      field: "fullName",
      title: "Invalid Name",
      message:
        "Full Name must contain only letters and be at least 2 characters.",
      icon: "error",
    };
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return {
      isValid: false,
      field: "phone",
      title: "Invalid Phone",
      message: "Please enter a valid 10-digit Indian mobile number.",
      icon: "error",
    };
  }

  if (!/^[1-9][0-9]{5}$/.test(postalCode)) {
    return {
      isValid: false,
      field: "postalCode",
      title: "Invalid Pincode",
      message: "Please enter a valid 6-digit Pincode.",
      icon: "error",
    };
  }

  return { isValid: true };
}

window.validateAddressFields = validateAddressFields;
