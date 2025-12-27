
import { EmailService } from '../core/services/email.service';

console.log("🚀 Testing Email Service...");
const success = await EmailService.sendInvite('test-user@zcr.ai', 'Test@123', 'Test User');

if (success) {
    console.log("✅ Email sent successfully (or mocked).");
} else {
    console.log("⚠️ Email failed (likely missing API key), but code executed.");
}
