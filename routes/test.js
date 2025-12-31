const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');

// Test SendGrid email
router.get('/test-email', async (req, res) => {
    const { to } = req.query;
    
    if (!to) {
        return res.status(400).json({ error: 'Provide ?to=your@email.com' });
    }

    const result = await sendEmail({
        to,
        subject: 'Test Email from RideManager (Railway)',
        html: `
            <h1>✅ SendGrid is Working!</h1>
            <p>If you receive this email, SendGrid is properly configured.</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        `
    });

    res.json({
        result,
        config: {
            EMAIL_HOST: process.env.EMAIL_HOST,
            EMAIL_PORT: process.env.EMAIL_PORT,
            EMAIL_USER: process.env.EMAIL_USER?.substring(0, 10) + '...',
            EMAIL_FROM: process.env.EMAIL_FROM,
            hasApiKey: !!process.env.EMAIL_PASS
        }
    });
});

module.exports = router;