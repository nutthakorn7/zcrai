import { db } from '../infra/db'
import { systemConfig, subscriptions } from '../infra/db/schema'
import { BillingService } from '../core/services/billing.service'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'

async function verify() {
    console.log('🔐 Verifying Enterprise Licensing...')

    // 1. Generate a License Key (JWT)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_dev_key')
    const licenseKey = await new SignJWT({ 
        users: 999, 
        retention: 3650,
        type: 'enterprise'
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1y')
        .sign(secret)

    console.log('📝 Generated License Key:', licenseKey.slice(0, 20) + '...')

    // 2. Inject into DB
    await db.insert(systemConfig).values({
        key: 'license_key',
        value: licenseKey,
        description: 'Verification Key'
    }).onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: licenseKey }
    })
    console.log('✅ Injected License Key into DB')

    // 3. Check Billing Service
    const tenantId = 'system-tenant-id' // Dummy tenant
    const sub = await BillingService.getSubscription(tenantId)

    console.log('📊 Subscription Tier:', sub.tier)
    console.log('📈 Limits:', sub.limits)

    if (sub.tier === 'enterprise' && sub.limits.maxUsers === 999) {
        console.log('✅ SUCCESS: Enterprise License active and enforcing limits.')
    } else {
        console.error('❌ FAILED: Subscription did not reflect Enterprise License.')
        process.exit(1)
    }

    process.exit(0)
}

verify().catch(console.error)
