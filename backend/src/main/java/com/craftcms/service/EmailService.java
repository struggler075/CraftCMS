package com.craftcms.service;

import com.craftcms.model.SmtpSettings;
import com.craftcms.repository.SmtpSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Properties;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final SmtpSettingsRepository smtpRepo;

    public boolean isSmtpEnabled() {
        SmtpSettings smtp = smtpRepo.findById(1L).orElse(null);
        return smtp != null && smtp.isEnabled()
                && smtp.getHost() != null && !smtp.getHost().isBlank();
    }

    /**
     * Returns true if sent, false if SMTP is disabled (graceful bypass).
     * Throws RuntimeException if SMTP is enabled but misconfigured or send failed.
     */
    public boolean sendVerificationEmail(String to, String username, String token, String siteUrl) {
        SmtpSettings smtp = smtpRepo.findById(1L).orElse(null);

        // SMTP explicitly disabled → bypass verification silently
        if (smtp == null || !smtp.isEnabled()) {
            log.info("SMTP disabled — skipping verification email to {}", to);
            return false;
        }

        // SMTP enabled — validate config before trying
        if (smtp.getHost() == null || smtp.getHost().isBlank()) {
            throw new RuntimeException("SMTP включён, но хост не указан. Настройте SMTP в админке.");
        }
        if (smtp.getUsername() == null || !smtp.getUsername().contains("@")) {
            throw new RuntimeException("SMTP включён, но логин некорректен. Укажите email-адрес в поле «Логин».");
        }

        try {
            JavaMailSenderImpl sender = buildSender(smtp);
            String verificationUrl = siteUrl.replaceAll("/$", "") + "/verify-email?token=" + token;
            String html = buildHtml(username, verificationUrl, smtp.getFromName());

            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(smtp.getUsername(), smtp.getFromName());
            helper.setTo(to);
            helper.setSubject("Подтвердите ваш email — " + smtp.getFromName());
            helper.setText(html, true);
            sender.send(message);
            log.info("Verification email sent to {}", to);
            return true;
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Не удалось отправить письмо: " + e.getMessage(), e);
        }
    }

    public boolean sendPasswordResetEmail(String to, String username, String token, String siteUrl) {
        SmtpSettings smtp = smtpRepo.findById(1L).orElse(null);
        if (smtp == null || !smtp.isEnabled()) return false;
        if (smtp.getHost() == null || smtp.getHost().isBlank()) {
            throw new RuntimeException("SMTP включён, но хост не указан.");
        }
        try {
            JavaMailSenderImpl sender = buildSender(smtp);
            String resetUrl = siteUrl.replaceAll("/$", "") + "/reset-password?token=" + token;
            String html = buildPasswordResetHtml(username, resetUrl, smtp.getFromName());
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(smtp.getUsername(), smtp.getFromName());
            helper.setTo(to);
            helper.setSubject("Сброс пароля — " + smtp.getFromName());
            helper.setText(html, true);
            sender.send(message);
            log.info("Password reset email sent to {}", to);
            return true;
        } catch (Exception e) {
            log.error("Failed to send password reset email: {}", e.getMessage());
            throw new RuntimeException("Не удалось отправить письмо: " + e.getMessage(), e);
        }
    }

    private JavaMailSenderImpl buildSender(SmtpSettings s) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(s.getHost());
        sender.setPort(s.getPort() != null ? s.getPort() : 587);
        if (s.getUsername() != null) sender.setUsername(s.getUsername());
        if (s.getPassword() != null) sender.setPassword(s.getPassword());
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", s.getUsername() != null && !s.getUsername().isBlank() ? "true" : "false");
        if (s.isSsl()) {
            props.put("mail.smtp.ssl.enable", "true");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
        }
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        return sender;
    }

    private String buildPasswordResetHtml(String username, String resetUrl, String fromName) {
        return """
                <!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
                <body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0f;padding:48px 16px;">
                    <tr><td align="center">
                      <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
                        <tr><td style="background:#0f0f18;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 32px;">
                          <table width="100%%" cellpadding="0" cellspacing="0" border="0">
                            <tr><td align="center" style="padding-bottom:24px;">
                              <div style="width:72px;height:72px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:50%%;text-align:center;line-height:72px;font-size:32px;">&#128274;</div>
                            </td></tr>
                            <tr><td align="center" style="padding-bottom:8px;">
                              <h1 style="margin:0;color:#fafafa;font-size:22px;font-weight:700;">Сброс пароля</h1>
                            </td></tr>
                            <tr><td align="center" style="padding-bottom:24px;">
                              <p style="margin:0;color:#9898b3;font-size:14px;line-height:1.7;">
                                Привет, <strong style="color:#fafafa;">%s</strong>! Нажмите кнопку ниже чтобы сбросить пароль.<br>
                                Ссылка действительна <strong style="color:#fafafa;">1 час</strong>.
                              </p>
                            </td></tr>
                            <tr><td align="center" style="padding-bottom:24px;">
                              <a href="%s" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;">
                                Сбросить пароль
                              </a>
                            </td></tr>
                            <tr><td align="center">
                              <p style="margin:0 0 6px;color:#6b6b8a;font-size:12px;">Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
                              <a href="%s" style="color:#7c5cfc;font-size:11px;word-break:break-all;">%s</a>
                            </td></tr>
                          </table>
                        </td></tr>
                        <tr><td align="center" style="padding-top:20px;">
                          <p style="margin:0;color:#4a4a6a;font-size:12px;">%s</p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body></html>
                """.formatted(username, resetUrl, resetUrl, resetUrl, fromName);
    }

    private String buildHtml(String username, String verificationUrl, String fromName) {
        return """
                <!DOCTYPE html>
                <html lang="ru">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width,initial-scale=1">
                  <title>Подтверждение email</title>
                </head>
                <body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0f;padding:48px 16px;">
                    <tr>
                      <td align="center">
                        <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

                          <!-- Logo -->
                          <tr>
                            <td align="center" style="padding-bottom:28px;">
                              <table cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td style="width:48px;height:48px;background:#7c5cfc;border-radius:12px;text-align:center;vertical-align:middle;">
                                    <span style="font-size:22px;line-height:48px;">&#9749;</span>
                                  </td>
                                  <td style="padding-left:12px;vertical-align:middle;">
                                    <span style="color:#fafafa;font-size:18px;font-weight:700;letter-spacing:-0.3px;">%s</span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>

                          <!-- Card -->
                          <tr>
                            <td style="background:#0f0f18;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 32px;">
                              <table width="100%%" cellpadding="0" cellspacing="0" border="0">

                                <!-- Icon -->
                                <tr>
                                  <td align="center" style="padding-bottom:24px;">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                      <tr>
                                        <td style="width:72px;height:72px;background:rgba(124,92,252,0.12);border:1px solid rgba(124,92,252,0.25);border-radius:50%%;text-align:center;vertical-align:middle;">
                                          <span style="font-size:32px;line-height:72px;">&#9993;</span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>

                                <!-- Title -->
                                <tr>
                                  <td align="center" style="padding-bottom:8px;">
                                    <h1 style="margin:0;color:#fafafa;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Подтвердите ваш email</h1>
                                  </td>
                                </tr>

                                <!-- Greeting -->
                                <tr>
                                  <td align="center" style="padding-bottom:8px;">
                                    <p style="margin:0;color:#9898b3;font-size:15px;">Привет, <strong style="color:#fafafa;">%s</strong>!</p>
                                  </td>
                                </tr>

                                <!-- Description -->
                                <tr>
                                  <td align="center" style="padding-bottom:32px;">
                                    <p style="margin:0;color:#9898b3;font-size:14px;line-height:1.7;max-width:380px;">
                                      Для завершения регистрации нажмите кнопку ниже.<br>
                                      Ссылка действительна&nbsp;<strong style="color:#fafafa;">24&nbsp;часа</strong>.
                                    </p>
                                  </td>
                                </tr>

                                <!-- Button -->
                                <tr>
                                  <td align="center" style="padding-bottom:28px;">
                                    <a href="%s"
                                       style="display:inline-block;background:#7c5cfc;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;letter-spacing:0.1px;">
                                      &#10003;&nbsp; Подтвердить email
                                    </a>
                                  </td>
                                </tr>

                                <!-- Divider -->
                                <tr>
                                  <td style="padding-bottom:20px;">
                                    <table width="100%%" cellpadding="0" cellspacing="0" border="0">
                                      <tr>
                                        <td style="border-top:1px solid rgba(255,255,255,0.07);font-size:0;">&nbsp;</td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>

                                <!-- Link fallback -->
                                <tr>
                                  <td align="center">
                                    <p style="margin:0 0 6px;color:#6b6b8a;font-size:12px;">Если кнопка не работает, перейдите по ссылке:</p>
                                    <a href="%s" style="color:#7c5cfc;font-size:11px;word-break:break-all;text-decoration:none;">%s</a>
                                  </td>
                                </tr>

                              </table>
                            </td>
                          </tr>

                          <!-- Footer -->
                          <tr>
                            <td align="center" style="padding-top:24px;">
                              <p style="margin:0 0 4px;color:#4a4a6a;font-size:12px;">
                                Если вы не регистрировались — просто проигнорируйте это письмо.
                              </p>
                              <p style="margin:0;color:#4a4a6a;font-size:12px;">
                                %s &mdash; Not affiliated with Mojang Studios
                              </p>
                            </td>
                          </tr>

                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(fromName, username, verificationUrl, verificationUrl, verificationUrl, fromName);
    }
}
