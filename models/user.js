import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      trim: true
    },

    userName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    phone: {
      type: String,
      default: null
    },

    profileImage: {
      type: String,
      default: ""
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true
    },

    referredByCode: {
      type: String,
      default: null,
      trim: true
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true
    },


    password: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active"
    },
    authProviders: {
      google: { type: Boolean, default: false },
      local: { type: Boolean, default: false }
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }

  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);
export default User;
