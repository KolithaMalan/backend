const User = require('../models/User');
const { validationResult } = require('express-validator');
const crypto = require('crypto');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Check phone number
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: 'User with this phone number already exists'
            });
        }

        // Create user (default role is 'user')
        const user = await User.create({
            name,
            email,
            phone,
            password,
            role: 'user'
        });

        // Generate token
        const token = user.generateAuthToken();

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update online status
        user.isOnline = true;
        await user.save();

        // Generate token
        const token = user.generateAuthToken();

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
    try {
        // Update online status
        await User.findByIdAndUpdate(req.user._id, { isOnline: false });

        // Clear cookie
        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0)
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({
            success: true,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;

        const user = await User.findById(req.user._id);
        
        if (name) user.name = name;
        if (phone) user.phone = phone;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Forgot password - send reset token via email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your email address'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Save to user
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save({ validateBeforeSave: false });

        // Build reset URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        // Try to send email
        try {
            const { sendEmail } = require('../services/emailService');
            await sendEmail({
                to: user.email,
                subject: '🔑 Password Reset Request - RideManager',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                        <div style="background: white; padding: 30px; border-radius: 8px;">
                            <h1 style="color: #1a5f2a; margin-bottom: 20px;">🔑 Password Reset</h1>
                            
                            <p>Dear ${user.name},</p>
                            <p>You have requested to reset your password. Click the button below to set a new password:</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" 
                                   style="background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                                    Reset My Password
                                </a>
                            </div>
                            
                            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                                <p style="color: #e65100; margin: 0; font-size: 14px;">
                                    ⏰ This link expires in <strong>1 hour</strong>. If you didn't request a password reset, please ignore this email.
                                </p>
                            </div>
                            
                            <p style="color: #666; font-size: 12px; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:</p>
                            <p style="color: #1565c0; font-size: 12px; word-break: break-all;">${resetUrl}</p>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="color: #999; font-size: 11px; text-align: center;">This is an automated message from RideManager System</p>
                        </div>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Failed to send reset email:', emailError);
            // Don't fail the request if email fails - still return success
            // In development, log the reset URL for testing
            if (process.env.NODE_ENV === 'development') {
                console.log('\n🔑 PASSWORD RESET LINK (dev mode):');
                console.log(resetUrl);
                console.log('');
            }
        }

        // In development, also include the token in response for testing
        const responseData = {
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        };

        if (process.env.NODE_ENV === 'development') {
            responseData.resetUrl = resetUrl;
            responseData.token = resetToken;
        }

        res.status(200).json(responseData);
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing password reset',
            error: error.message
        });
    }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Hash the token from the URL to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token. Please request a new password reset.'
            });
        }

        // Set new password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successful! You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error resetting password',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword
};
