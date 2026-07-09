import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

// Serviço central de envio de emails do backend. Em vez de deixar o
// Supabase Auth enviar (e formatar) os emails de autenticação, o backend
// gera os links ele próprio (ver AuthService.forgotPassword, que usa
// admin.generateLink) e manda-os com o nosso próprio HTML, através de um
// SMTP à nossa escolha (Gmail, Resend, etc. - configurado via env vars).
// Isto dá controlo total sobre o design, sem depender do editor de
// templates do Supabase (que em alguns planos só desbloqueia depois de
// configurar SMTP lá também).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  // Cria o transporter só na primeira utilização (não no arranque do
  // módulo) - assim um projeto que ainda não configurou SMTP continua a
  // arrancar normalmente, só falha (com log claro) quando de facto tenta
  // mandar um email.
  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      this.logger.error(
        'SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS em falta - não é possível enviar emails.',
      );
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      // Porta 465 = SSL implícito. Qualquer outra (587, a mais comum) usa
      // STARTTLS, negociado automaticamente pelo nodemailer quando
      // secure=false.
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    return this.transporter;
  }

  /**
   * Envia o email de "reset password" com o link já gerado (ver
   * admin.generateLink em AuthService.forgotPassword). Nunca lança - um
   * erro de envio aqui não deve rebentar o pedido HTTP nem revelar nada ao
   * cliente, só fica registado nos logs do servidor.
   */
  async sendPasswordResetEmail(to: string, actionLink: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) return;

    const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME ?? 'Productivity Maxing';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: 'Reset your Productivity Maxing password',
        html: renderPasswordResetEmail(actionLink, frontendUrl),
      });
      this.logger.log(`Email de reset de password enviado para ${to}`);
    } catch (err) {
      this.logger.error(
        `Erro ao enviar email de reset de password para ${to}`,
        err,
      );
    }
  }
}
// Mesmo template/estilo já usado no Supabase Dashboard (tabelas + CSS
// inline, para renderizar de forma consistente em Gmail/Outlook/Apple
// Mail), só que agora vive no código e recebe o link diretamente, sem
// depender de nenhuma variável {{ .ConfirmationURL }} do lado do Supabase.
function renderPasswordResetEmail(
  actionLink: string,
  frontendUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
  </head>
  <body style="margin:0; padding:0; background-color:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#171717; border:1px solid #262626; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="padding: 32px 32px 0 32px; text-align:center;">
                <img src="${frontendUrl}/logo.png" alt="Productivity Maxing Logo" width="44" height="44" style="display:inline-block; border-radius:10px; margin-bottom:20px;" />                <h1 style="margin:0; font-size:20px; line-height:28px; color:#fafafa; font-weight:700;">
                  Productivity Maxing
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 8px 32px;">
                <h2 style="margin:0 0 12px 0; font-size:18px; line-height:26px; color:#fafafa; font-weight:600;">
                  Reset your password
                </h2>
                <p style="margin:0 0 24px 0; font-size:14px; line-height:22px; color:#a3a3a3;">
                  We received a request to reset the password for your account. Click the button
                  below to choose a new one. This link is valid for a short time only.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 24px 32px;" align="center">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px; background-color:#7c3aed;">
                      <a href="${actionLink}"
                         style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 24px 32px;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#737373;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:6px 0 0 0; font-size:12px; line-height:18px; word-break:break-all;">
                  <a href="${actionLink}" style="color:#a78bfa; text-decoration:underline;">${actionLink}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px;">
                <hr style="border:none; border-top:1px solid #262626; margin:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px 32px 32px;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#737373;">
                  If you didn't request a password reset, you can safely ignore this email, your
                  password will not be changed.
                </p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
            <tr>
              <td style="padding: 20px 8px 0 8px; text-align:center;">
                <p style="margin:0; font-size:11px; line-height:16px; color:#525252;">
                  Productivity Maxing &middot; This is an automated message, please don't reply.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
