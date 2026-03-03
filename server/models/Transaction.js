const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ["income", "expense"],
    required: true
  },
  status: {
    type: String,
    default: "Success"
  },
  description: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);