# Email Configuration Guide

## Overview
The Smart Attendance System now includes email functionality for:
- Password reset emails
- Welcome emails for new users
- System notifications

## Development Setup (Default)
For development, the system uses **Ethereal Email** - a fake SMTP service that generates preview URLs instead of actually sending emails.

### No Configuration Required
The system will automatically:
1. Create a test Ethereal account
2. Generate preview URLs for emails
3. Display the preview URL in the console

### Testing Email Functionality
1. Start the server: `npm run dev`
2. Try the forgot password functionality
3. Check the console for email preview URLs
4. Click the preview URL to see the email

## Production Setup

### Option 1: Gmail SMTP
Add these environment variables to your `.env` file:

```env
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com
CLIENT_URL=https://yourdomain.com
```

**Note**: For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an "App Password" (not your regular password)
3. Use the app password in `SMTP_PASS`

### Option 2: SendGrid
```env
NODE_ENV=production
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
CLIENT_URL=https://yourdomain.com
```

### Option 3: Mailgun
```env
NODE_ENV=production
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
FROM_EMAIL=noreply@yourdomain.com
CLIENT_URL=https://yourdomain.com
```

### Option 4: Custom SMTP
```env
NODE_ENV=production
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
FROM_EMAIL=noreply@yourdomain.com
CLIENT_URL=https://yourdomain.com
```

## Email Templates

The system includes two email templates:

### 1. Password Reset Email
- Sent when user requests password reset
- Contains secure reset link with 15-minute expiry
- Professional HTML template with security warnings

### 2. Welcome Email
- Sent to new users after registration
- Contains login instructions and system overview
- Professional HTML template with feature highlights

## Testing

### Development Testing
1. Start the server
2. Register a new user or use forgot password
3. Check console for preview URLs
4. Click preview URLs to see email content

### Production Testing
1. Configure SMTP settings
2. Test with real email addresses
3. Check email delivery and formatting
4. Verify reset links work correctly

## Troubleshooting

### Common Issues

1. **Emails not sending in development**
   - Check console for Ethereal account creation
   - Look for preview URLs in console output

2. **Emails not sending in production**
   - Verify SMTP credentials
   - Check firewall/network restrictions
   - Verify FROM_EMAIL domain is authorized

3. **Reset links not working**
   - Ensure CLIENT_URL is correctly set
   - Check token expiry (15 minutes)
   - Verify frontend route handling

### Debug Mode
Set `NODE_ENV=development` to see detailed email logs and preview URLs.

## Security Notes

- Reset tokens expire in 15 minutes
- Tokens are single-use and invalidated after use
- Email addresses are validated before sending
- No sensitive data is logged in production
