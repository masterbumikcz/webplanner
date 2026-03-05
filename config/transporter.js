// Nastavení pro odesílání emailů pomocí Brevo API
const transporter = {
  sendMail: async ({ to, subject, text }) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "WebPlanner Application",
          email: process.env.GMAIL_USER,
        },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    return response.json();
  },
};

export default transporter;
