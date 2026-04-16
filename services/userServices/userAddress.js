import Address from "../../models/address.js";
import AppError from "../../utils/AppError.js";

// Fetch all addresses for a user
export const getUserAddresses = async (userId) => {
    return await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};


export const addNewAddress = async (userId, data) => {
    // If this is the user's first address, make it default automatically
    const count = await Address.countDocuments({ userId });
    if (count === 0) data.isDefault = true;

    if (data.isDefault) {
        // Unset any existing default address
        await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const newAddress = new Address({
        userId,
        ...data
    });
    return await newAddress.save();
};

export const getAddressById = async (addressId, userId) => {
    return await Address.findOne({ _id: addressId, userId });
};


export const updateAddress = async (addressId, userId, data) => {
    if (data.isDefault) {
        await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }
    const updatedAddress = await Address.findOneAndUpdate({ _id: addressId, userId }, data, { new: true });
    if (!updatedAddress) {
        throw new AppError("Address not found", 404);
    }
    return updatedAddress;
};

export const deleteAddress = async (addressId, userId) => {
    const deletedAddress = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!deletedAddress) {
        throw new AppError("Address not found", 404);
    }
    return deletedAddress;
};

export const setAddressAsDefault = async (addressId, userId) => {
    // 1. Set all user's addresses to false
    await Address.updateMany({ userId }, { $set: { isDefault: false } });

    // 2. Set the selected address to true
    const defaultAddress = await Address.findOneAndUpdate(
        { _id: addressId, userId },
        { $set: { isDefault: true } },
        { new: true }
    );
    if (!defaultAddress) {
        throw new AppError("Address not found", 404);
    }
    return defaultAddress;
};
