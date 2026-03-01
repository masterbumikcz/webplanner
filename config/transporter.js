import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

console.log(
  `Transporter configured with Gmail user: ${process.env.GMAIL_USER}`,
);
export default transporter;
