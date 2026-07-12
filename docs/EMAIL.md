# Email notifications (Brevo)

StockPredict sends **transactional emails** when important events happen (same triggers as in-app notifications).

## Recommended: Brevo (what we use)

- **Free tier:** ~300 emails/day
- **Signup:** https://www.brevo.com/
- **Why:** Simple API, good free plan, no credit card for trial

### Setup steps

1. Create a Brevo account.
2. **Senders & IP** → add and verify your sender email (e.g. `noreply@yourdomain.com`).  
   For testing, Brevo may allow your own login email as sender.
3. **SMTP & API** → **API Keys** → create key → copy it.
4. Add to `.env`:

```env
BREVO_API_KEY=xkeysib-your-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=StockPredict
EMAIL_NOTIFICATIONS_ENABLED=true
WEB_ORIGIN=http://localhost:3000
```

5. Restart API: `npm run dev`
6. Check http://localhost:4000/health → `"email": true`
7. As admin, test: `POST /admin/test-email` with your JWT (or register a new user for welcome email)

### Emails sent automatically

| Event | When |
|-------|------|
| Welcome | User registers |
| Trade | Buy/sell matched |
| Market resolved | User wins payout |
| Price alert | YES price hits your target |

In-app bell notifications still work if email is off.

---

## Other services (alternatives)

You can swap Brevo for any provider with a REST API or SMTP. Common choices:

| Service | Best for | Free tier |
|---------|----------|-----------|
| **[Brevo](https://www.brevo.com/)** | Startups, EU-friendly | ~300/day |
| **[Resend](https://resend.com/)** | Developers, modern DX | 3,000/month |
| **[SendGrid](https://sendgrid.com/)** | Scale, Twilio ecosystem | 100/day |
| **[Amazon SES](https://aws.amazon.com/ses/)** | AWS deployments | Very cheap |
| **[Postmark](https://postmarkapp.com/)** | Deliverability focus | Trial only |
| **[Mailgun](https://www.mailgun.com/)** | APIs + logs | Limited free |

To use another provider, change `packages/platform/src/email.js` (same `sendEmail` interface) or use their SMTP with Nodemailer.

---

## Disable emails

```env
EMAIL_NOTIFICATIONS_ENABLED=false
```

Or remove `BREVO_API_KEY`. In-app notifications still work.
