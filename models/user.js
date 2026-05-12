import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
    },

    userName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    phone: {
      type: String,
      default: null,
    },

    profileImage: {
      type: String,
      default: "",
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    referralInviteToken: {
      type: String,
      unique: true,
      sparse: true,
    },

    referredByCode: {
      type: String,
      default: null,
      trim: true,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    wallet: {
      balance: {
        type: Number,
        default: 0,
        min: 0,
      },
      transactions: [
        {
          type: {
            type: String,
            enum: ["credit", "debit"],
            required: true,
          },
          amount: {
            type: Number,
            required: true,
            min: 0,
          },
          balanceAfter: {
            type: Number,
            required: true,
            min: 0,
          },
          description: {
            type: String,
            required: true,
            trim: true,
          },
          orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
          },
          itemId: {
            type: mongoose.Schema.Types.ObjectId,
          },
          reference: {
            type: String,
            required: true,
            trim: true,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    authProviders: {
      google: { type: Boolean, default: false },
      local: { type: Boolean, default: false },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);
export default User;
