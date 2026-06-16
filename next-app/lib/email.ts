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

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "重設您的密碼",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px">重設您的密碼</h2>
        <p style="color:#555;margin:0 0 24px">
          我們收到重設您帳戶密碼的請求。點擊下方按鈕設定新密碼。<br>
          此連結將於 <strong>1 小時</strong>後失效。
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 28px;background:#000;color:#fff;
                  text-decoration:none;border-radius:6px;font-weight:500">
          重設密碼
        </a>
        <p style="color:#888;font-size:13px;margin:24px 0 0">
          如果您沒有提出此請求，請忽略這封郵件，您的密碼不會有任何變動。
        </p>
        <p style="color:#aaa;font-size:12px;margin:8px 0 0">
          或複製此連結：<span style="word-break:break-all">${resetUrl}</span>
        </p>
      </div>
    `,
  })
}

export async function sendInviteEmail(to: string, inviteUrl: string, inviterName: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "您被邀請加入團隊",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px">您被邀請加入團隊</h2>
        <p style="color:#555;margin:0 0 24px">
          <strong>${inviterName}</strong> 邀請您加入團隊。<br>
          點擊下方按鈕以接受邀請。
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:12px 28px;background:#000;color:#fff;
                  text-decoration:none;border-radius:6px;font-weight:500">
          接受邀請
        </a>
        <p style="color:#888;font-size:13px;margin:24px 0 0">
          如果您不認識邀請者，可以安全地忽略這封郵件。
        </p>
        <p style="color:#aaa;font-size:12px;margin:8px 0 0">
          或複製此連結：<span style="word-break:break-all">${inviteUrl}</span>
        </p>
      </div>
    `,
  })
}
