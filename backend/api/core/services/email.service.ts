import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const EmailService = {
  async sendEmail({ to, subject, html }: EmailOptions) {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY is not configured. Email NOT sent.');
      console.log(`[DEBUG] Email to: ${to}, Subject: ${subject}`);
      return false; // Fail gracefully
    }

    try {
      const data = await resend.emails.send({
        from: 'zcrAI <noreply@zcr.ai>', // Or use your own verified domain
        to,
        subject,
        html,
      });

      if (data.error) {
        console.error('❌ Resend Error:', data.error);
        return false;
      }

      console.log(`✅ Email sent to ${to}: ${data.data?.id}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  },

  async sendOTP(to: string, otp: string) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🔐 Your Login Code</h2>
        <p>Use the following code to complete your login to zcrAI:</p>
        <h1 style="background: #f4f4f5; padding: 20px; text-align: center; letter-spacing: 5px; border-radius: 10px;">
          ${otp}
        </h1>
        <p>This code will expire in 5 minutes.</p>
        <hr />
        <p style="font-size: 12px; color: #71717a;">If you didn't request this, please ignore this email.</p>
      </div>
    `;
    return this.sendEmail({ to, subject: 'Your zcrAI Validation Code', html });
  },

  async sendPasswordReset(to: string, token: string) {
    const resetLink = `https://app.zcr.ai/reset-password?token=${token}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🔐 Reset Your Password</h2>
        <p>You requested a password reset. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #71717a; font-size: 14px;">Or copy this link: <a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <hr />
        <p style="font-size: 12px; color: #71717a;">If you didn't request this, please ignore this email.</p>
      </div>
    `;
    return this.sendEmail({ to, subject: 'Reset your zcrAI Password', html });
  }
};
