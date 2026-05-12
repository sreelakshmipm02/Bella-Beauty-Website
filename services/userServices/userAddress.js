import Address from "../../models/address.js";
import AppError from "../../utils/AppError.js";

const assignNewestAddressAsDefault = async (userId) => {
  const fallbackAddress = await Address.findOne({ userId }).sort({
    createdAt: -1,
  });

  if (fallbackAddress && !fallbackAddress.isDefault) {
    fallbackAddress.isDefault = true;
    await fallbackAddress.save();
  }
};

// Fetch all addresses for a user
export const getUserAddresses = async (userId) => {
  return await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};

export const addNewAddress = async (userId, data) => {
  // If this is the user's first address, make it default automatically
  const count = await Address.countDocuments({ userId });
  const shouldBeDefault = count === 0 || data.isDefault === true;

  if (shouldBeDefault) {
    // Unset any existing default address
    await Address.updateMany({ userId }, { $set: { isDefault: false } });
  }

  const newAddress = new Address({
    userId,
    ...data,
    isDefault: shouldBeDefault,
  });
  return await newAddress.save();
};

export const getAddressById = async (addressId, userId) => {
  return await Address.findOne({ _id: addressId, userId });
};

export const updateAddress = async (addressId, userId, data) => {
  const existingAddress = await Address.findOne({ _id: addressId, userId });

  if (!existingAddress) {
    throw new AppError("Address not found", 404);
  }

  const shouldBeDefault = data.isDefault === true || data.isDefault === "true";

  if (shouldBeDefault) {
    await Address.updateMany({ userId }, { $set: { isDefault: false } });
  }

  const updatedAddress = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    {
      ...data,
      isDefault: shouldBeDefault ? true : existingAddress.isDefault,
    },
    { new: true },
  );

  return updatedAddress;
};

export const deleteAddress = async (addressId, userId) => {
  const deletedAddress = await Address.findOneAndDelete({
    _id: addressId,
    userId,
  });
  if (!deletedAddress) {
    throw new AppError("Address not found", 404);
  }

  if (deletedAddress.isDefault) {
    await assignNewestAddressAsDefault(userId);
  }

  return deletedAddress;
};

export const setAddressAsDefault = async (addressId, userId) => {
  const targetAddress = await Address.findOne({ _id: addressId, userId });

  if (!targetAddress) {
    throw new AppError("Address not found", 404);
  }

  // 1. Set all user's addresses to false
  await Address.updateMany({ userId }, { $set: { isDefault: false } });

  // 2. Set the selected address to true
  const defaultAddress = await Address.findOneAndUpdate(
    { _id: addressId, userId },
    { $set: { isDefault: true } },
    { new: true },
  );
  return defaultAddress;
};
