import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: process.env.SMTP_SECURE === "true",
  ...(process.env.SMTP_USER
    ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
    : {}),
})

const FROM = process.env.EMAIL_FROM || "noreply@saas-dev.local"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/verify-email/confirm?token=${encodeURIComponent(token)}`

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Verify your email address",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px">Verify your email</h2>
        <p style="color:#555;margin:0 0 24px">
          Click the button below to verify your email address.<br>
          This link expires in <strong>24 hours</strong>.
        </p>
        <a href="${url}"
           style="display:inline-block;padding:12px 28px;background:#000;color:#fff;
                  text-decoration:none;border-radius:6px;font-weight:500">
          Verify Email
        </a>
        <p style="color:#888;font-size:13px;margin:24px 0 0">
          If you didn't create an account, ignore this email.
        </p>
        <p style="color:#aaa;font-size:12px;margin:8px 0 0">
          Or copy this link: <span style="word-break:break-all">${url}</span>
        </p>
      </div>
    `,
  })
}
