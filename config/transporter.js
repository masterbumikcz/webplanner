/*
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

console.log(
  `Transporter configured with Gmail user: ${process.env.GMAIL_USER}`
);
export default transporter;
*/

const transporter = {
  sendMail: async (mailOptions) => {
    const payload = {
      sender: {
        name: "WebPlanner Application",
        email: process.env.GMAIL_USER,
      },
      to: [{ email: mailOptions.to }],
      subject: mailOptions.subject,
      textContent: mailOptions.text,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error response from Brevo API:", errorData);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  },
};

console.log(
  "Transporter configured with Brevo API key: " + process.env.BREVO_API_KEY,
);
export default transporter;
